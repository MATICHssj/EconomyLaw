import {
  addDays,
  budgetProgress,
  cardStatement,
  computeBalances,
  dueRecurring,
  formatMoney,
  monthKey,
  monthStart,
  netWorth,
  advanceRecurring,
  occurrencesBetween,
  SettingsSchema,
  startOfWeek,
  summarizePeriod,
  todayISO,
  topEntries,
  weekday,
  type Account,
  type Budget,
  type Category,
  type Debt,
  type InstallmentPlan,
  type Investment,
  type Loan,
  type Recurring,
  type Settings,
  type Split,
  type Transaction,
} from '@fina/core';
import type { Pusher } from './lib/fcm';
import type { Store } from './lib/store';
import type { Messenger } from './lib/whatsapp';
import { stripUndefined } from './entries';

export interface CronDeps {
  store: Store;
  kv: KVNamespace;
  push: Pusher;
  wa?: Messenger;
  now?: () => Date;
}

const TZ = 'America/Mexico_City';

async function onceKey(kv: KVNamespace, key: string, ttlDays = 40): Promise<boolean> {
  if (await kv.get(key)) return false;
  await kv.put(key, '1', { expirationTtl: ttlDays * 86400 });
  return true;
}

/**
 * Tareas diarias (9:00 a. m. CDMX): avisos de pago de tarjeta, recurrentes,
 * presupuesto 80 %/100 %, resumen semanal (domingo), recurrentes automáticos,
 * foto mensual del patrimonio y limpieza de textos crudos (>30 días).
 */
export async function runDaily(deps: CronDeps): Promise<{ users: number; pushes: number }> {
  const { store, kv, push } = deps;
  const now = deps.now?.() ?? new Date();
  const today = todayISO(now, TZ);
  const uids = await store.listIds('users');
  let pushes = 0;

  // Códigos de vinculación vencidos
  for (const c of await store.query<{ id: string }>('linkCodes', [['expiresAtMs', '<', now.getTime()]], 500)) await store.delete(`linkCodes/${c.id}`);

  for (const uid of uids) {
    try {
      pushes += await runForUser(deps, uid, today, now);
    } catch (e) {
      console.error('cron user failed', uid, e);
    }
  }
  void kv;
  void push;
  return { users: uids.length, pushes };
}

async function runForUser(deps: CronDeps, uid: string, today: string, now: Date): Promise<number> {
  const { store, kv, push } = deps;
  const base = `users/${uid}`;
  const meta = await store.get<{ settings?: Partial<Settings> }>(base);
  if (!meta) return 0;
  const settings = SettingsSchema.parse(meta.settings ?? {});
  const mk = monthKey(today);
  const prevStart = monthStart(monthKey(addDays(monthStart(mk), -1)));
  const [accounts, recurring, plans, txsRecent, categories] = await Promise.all([
    store.list<Account>(`${base}/accounts`),
    store.list<Recurring>(`${base}/recurring`),
    store.list<InstallmentPlan>(`${base}/installmentPlans`),
    store.query<Transaction>(`${base}/transactions`, [['date', '>=', prevStart]]),
    store.list<Category>(`${base}/categories`),
  ]);
  let sent = 0;
  const notify = async (key: string, title: string, body: string, url: string) => {
    if (!(await onceKey(kv, `n:${uid}:${key}`))) return;
    sent += await push.send(uid, { title, body, url, tag: key });
  };

  // 1) Recurrentes automáticos (renta, quincena fija…)
  const autos = dueRecurring(recurring, today);
  if (autos.length) {
    const ops: Array<{ set: { path: string; data: object } }> = [];
    for (const { recurring: r, dates } of autos) {
      for (const d of dates) {
        const stamp = now.toISOString();
        const tx: Transaction = stripUndefined({ id: `rec_${r.id}_${d}`, kind: r.template.kind, amountCents: r.template.amountCents, currency: r.template.currency, amountMxnCents: r.template.amountCents, accountId: r.template.accountId, toAccountId: r.template.toAccountId ?? null, categoryId: r.template.categoryId, tags: r.template.tags, description: r.template.description || r.name, merchant: r.template.merchant, date: d, createdAt: stamp, updatedAt: stamp, source: 'recurring', status: 'cleared', reconciled: false, recurringId: r.id, attachments: [] });
        ops.push({ set: { path: `${base}/transactions/${tx.id}`, data: tx } });
      }
      ops.push({ set: { path: `${base}/recurring/${r.id}`, data: { ...r, ...advanceRecurring(r, dates.length) } } });
    }
    await store.commit(ops);
  }

  // 2) Pagos de tarjeta
  if (settings.notifications.cardDue) {
    const allTxs = await store.list<Transaction>(`${base}/transactions`);
    const balances = computeBalances(accounts, allTxs);
    for (const a of accounts.filter((x) => x.type === 'credit' && x.credit && !x.archived)) {
      const st = cardStatement(a, allTxs, plans, balances[a.id] ?? 0, today);
      if (!st || st.remainingToPayCents <= 0) continue;
      if (st.daysUntilDue === settings.notifications.cardDueDaysBefore || st.daysUntilDue === 1 || st.daysUntilDue === 0) {
        const when = st.daysUntilDue === 0 ? 'HOY' : st.daysUntilDue === 1 ? 'mañana' : `en ${st.daysUntilDue} días`;
        await notify(`card:${a.id}:${st.dueDate}:${st.daysUntilDue}`, `💳 ${a.name}: pagas ${when}`, `Paga ${formatMoney(st.remainingToPayCents)} para no generar intereses (mínimo ${formatMoney(st.minimumPaymentCents)}).`, `/#/cuentas/${a.id}`);
      }
    }
    // 3) Foto mensual del patrimonio
    const snapId = mk;
    if (!(await store.get(`${base}/snapshots/${snapId}`))) {
      const [investments, debts, loans, splits] = await Promise.all([store.list<Investment>(`${base}/investments`), store.list<Debt>(`${base}/debts`), store.list<Loan>(`${base}/loans`), store.list<Split>(`${base}/splits`)]);
      const nw = netWorth({ accounts, balances, investments, debts, loans, splits });
      await store.set(`${base}/snapshots/${snapId}`, { id: snapId, netWorthCents: nw.netWorthCents, assetsCents: nw.assetsCents, liabilitiesCents: nw.liabilitiesCents, createdAt: now.toISOString() });
    }
  }

  // 4) Recordatorios de recurrentes
  if (settings.notifications.recurring) {
    for (const r of recurring.filter((x) => x.active && !x.autoCreate && x.template.kind !== 'income')) {
      const target = addDays(today, r.remindDaysBefore);
      if (occurrencesBetween(r, target, target).length) {
        await notify(`rec:${r.id}:${target}`, `🔔 ${r.name} ${r.remindDaysBefore === 0 ? 'hoy' : r.remindDaysBefore === 1 ? 'mañana' : `en ${r.remindDaysBefore} días`}`, `${formatMoney(r.template.amountCents)}. Toca para marcarlo como pagado.`, '/#/recurrentes');
      }
    }
  }

  // 5) Presupuesto al 80 % y 100 %
  if (settings.notifications.budgetAlerts) {
    const budget = await store.get<Budget>(`${base}/budgets/${mk}`);
    if (budget) {
      const s = summarizePeriod(txsRecent, plans, monthStart(mk), today);
      for (const l of budgetProgress(budget, s.byCategory)) {
        const c = categories.find((x) => x.id === l.categoryId);
        if (l.status === 'over') await notify(`b100:${mk}:${l.categoryId}`, `🔴 Te pasaste en ${c?.name ?? 'una categoría'}`, `Llevas ${formatMoney(l.spentCents)} de ${formatMoney(l.assignedCents)}.`, '/#/presupuesto');
        else if (l.status === 'warn') await notify(`b80:${mk}:${l.categoryId}`, `🟡 Vas al ${l.pct} % en ${c?.name ?? 'una categoría'}`, `Te quedan ${formatMoney(l.availableCents)} para el resto del mes.`, '/#/presupuesto');
      }
    }
  }

  // 6) Resumen semanal (domingo)
  if (settings.notifications.weeklySummary && weekday(today) === 0) {
    const from = startOfWeek(today);
    const s = summarizePeriod(txsRecent, plans, from, today);
    if (s.spentCents > 0) {
      const top = topEntries(s.byCategory, 1)[0];
      const c = top ? categories.find((x) => x.id === top[0]) : undefined;
      const pct = top ? Math.round((top[1] / s.spentCents) * 100) : 0;
      const body = `Esta semana gastaste ${formatMoney(s.spentCents)}${c ? `, sobre todo en ${c.name.toLowerCase()} (${pct} %)` : ''}.`;
      await notify(`week:${today}`, '📊 Tu resumen semanal', body, '/#/reportes');
      // Por WhatsApp solo si escribió en las últimas 24 h (mensaje de servicio gratuito).
      if (deps.wa && (await kv.get(`lastSeen:${uid}`))) {
        const phone = await kv.get(`phone:${uid}`);
        if (phone) await deps.wa.text(phone, `📊 ${body}`);
      }
    }
  }

  // 7) Privacidad: borrar textos originales de más de 30 días
  const cutoff = addDays(today, -30);
  for (const t of txsRecent.filter((x) => x.rawText && x.createdAt.slice(0, 10) < cutoff)) await store.patch(`${base}/transactions/${t.id}`, { rawText: undefined });

  return sent;
}
