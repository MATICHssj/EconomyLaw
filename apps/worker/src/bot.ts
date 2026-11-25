import {
  APP_NAME,
  addDays,
  buildDefaultCategories,
  computeBalances,
  availableMoney,
  formatLongDate,
  formatMoney,
  monthKey,
  monthStart,
  startOfWeek,
  summarizePeriod,
  todayISO,
  topEntries,
  type Account,
  type Budget,
  type Category,
  type InstallmentPlan,
  type Loan,
  type Profile,
  type Rule,
  type Transaction,
  type Trip,
  type TxSource,
} from '@fina/core';
import { askAssistant, parseMany, type ParseContext, type ParsedEntry } from '@fina/parser';
import type { Env } from './env';
import { categorize, readReceipt, transcribe } from './lib/ai';
import { hashPhone } from './lib/crypto';
import type { Store } from './lib/store';
import type { Incoming, Messenger } from './lib/whatsapp';
import { entryToDocs } from './entries';

export interface BotDeps {
  env: Env;
  store: Store;
  wa: Messenger;
  kv: KVNamespace;
  now?: () => Date;
}

const TZ = 'America/Mexico_City';
const HELP = `Así me usas 👇
• *galleta 30* → anoto un gasto
• *+15000 quincena* → un ingreso
• *tacos 120, refresco 25* → varios a la vez
• *cena 900 entre 3* · *tv 12000 a 12 msi con nu*
• 🎤 Nota de voz o 📸 foto del ticket
Comandos: *saldo*, *hoy*, *semana*, *mes*, *presupuesto comida*, *cuentas*, *deshacer*, *desvincular*
También pregúntame: _¿cuánto llevo en uber este mes?_`;

const LINK_HELP = (appUrl: string) =>
  `¡Hola! 👋 Soy el bot de ${APP_NAME}. Para anotar tus gastos por aquí, primero vincula tu número:\n1. Abre la app (${appUrl})\n2. Ve a Más → WhatsApp → *Vincular*\n3. Mándame el mensaje que te aparece (vincular 123456)`;

async function once(kv: KVNamespace, key: string, ttl: number): Promise<boolean> {
  if (await kv.get(key)) return false;
  await kv.put(key, '1', { expirationTtl: ttl });
  return true;
}

async function rateLimited(kv: KVNamespace, key: string, max: number): Promise<boolean> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / 60_000)}`;
  const n = Number((await kv.get(bucket)) ?? '0') + 1;
  await kv.put(bucket, String(n), { expirationTtl: 120 });
  return n > max;
}

interface LoadedUser {
  uid: string;
  profile: Profile | null;
  accounts: Account[];
  categories: Category[];
  rules: Rule[];
  loans: Loan[];
}

async function loadUser(store: Store, uid: string): Promise<LoadedUser> {
  const [meta, accounts, categories, rules, loans] = await Promise.all([
    store.get<{ profile?: Profile }>(`users/${uid}`),
    store.list<Account>(`users/${uid}/accounts`),
    store.list<Category>(`users/${uid}/categories`),
    store.list<Rule>(`users/${uid}/rules`),
    store.list<Loan>(`users/${uid}/loans`),
  ]);
  return { uid, profile: meta?.profile ?? null, accounts, categories: categories.length ? categories : buildDefaultCategories(), rules, loans };
}

function parseCtx(u: LoadedUser, today: string): ParseContext {
  const people: Record<string, 'lent' | 'borrowed'> = {};
  for (const l of u.loans) if (!l.closed) people[l.person] = l.direction;
  return {
    today,
    accounts: u.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, institution: a.institution, aliases: a.aliases, archived: a.archived })),
    rules: u.rules.filter((r) => r.match.contains).map((r) => ({ pattern: r.match.contains!, categoryId: r.set.categoryId, accountId: r.set.accountId, tags: r.set.tags })),
    people,
  };
}

export async function handleMessage(deps: BotDeps, msg: Incoming): Promise<void> {
  const { env, store, wa, kv } = deps;
  const now = deps.now?.() ?? new Date();
  const today = todayISO(now, TZ);
  // Idempotencia: Meta puede reenviar el mismo mensaje.
  if (!(await once(kv, `msg:${msg.id}`, 48 * 3600))) return;
  const phoneHash = await hashPhone(msg.from, env.PHONE_HASH_SALT ?? 'fina');
  if (await rateLimited(kv, phoneHash, 20)) {
    if (await once(kv, `rlwarn:${phoneHash}:${Math.floor(Date.now() / 60_000)}`, 120)) await wa.text(msg.from, '⏳ Vas muy rápido. Espera un minutito y sigo.');
    return;
  }
  const link = await store.get<{ uid: string }>(`waLinks/${phoneHash}`);

  if (!link) {
    const m = msg.text?.trim().match(/^vincular\s+(\d{6})$/i);
    if (!m) return wa.text(msg.from, LINK_HELP(env.APP_URL));
    const code = m[1]!;
    const lc = await store.get<{ uid: string; expiresAtMs: number }>(`linkCodes/${code}`);
    if (!lc || lc.expiresAtMs < now.getTime()) {
      await rateLimited(kv, `link:${phoneHash}`, 5);
      return wa.text(msg.from, '❌ Ese código no es válido o ya venció. Genera uno nuevo en la app (Más → WhatsApp).');
    }
    await store.commit([{ set: { path: `waLinks/${phoneHash}`, data: { uid: lc.uid, linkedAt: now.toISOString() } } }, { delete: `linkCodes/${code}` }]);
    return wa.text(msg.from, `✅ ¡Listo! Ya puedes mandarme tus gastos. Prueba: *galleta 30*\n\n${HELP}`);
  }

  const uid = link.uid;
  // Ventana de 24 h de WhatsApp: solo entonces podemos escribirle gratis (resumen semanal).
  await kv.put(`lastSeen:${uid}`, String(now.getTime()), { expirationTtl: 24 * 3600 });
  await kv.put(`phone:${uid}`, msg.from, { expirationTtl: 24 * 3600 });

  if (msg.type === 'button' && msg.buttonId) return handleButton(deps, uid, msg, today);

  let text = msg.text?.trim() ?? '';
  let source: TxSource = 'whatsapp';
  if (msg.type === 'audio' && msg.mediaId) {
    const { bytes } = await wa.downloadMedia(msg.mediaId);
    const t = await transcribe(env, bytes);
    if (!t) return wa.text(msg.from, '🎤 No pude escuchar el audio. ¿Me lo escribes?');
    await wa.text(msg.from, `🎤 Entendí: “${t}”`);
    text = t;
    source = 'voice';
  } else if (msg.type === 'image' && msg.mediaId) {
    const { bytes } = await wa.downloadMedia(msg.mediaId);
    const r = await readReceipt(env, bytes).catch(() => null);
    if (!r?.total) return wa.text(msg.from, '📸 No pude leer el total del ticket. Escríbemelo, por ejemplo: *oxxo 87.50*');
    const phrase = `${r.merchant ?? 'ticket'} ${r.total}`;
    const key = crypto.randomUUID().slice(0, 8);
    await kv.put(`rcpt:${uid}:${key}`, JSON.stringify({ phrase, date: r.date }), { expirationTtl: 3600 });
    return wa.buttons(msg.from, `📸 Leí tu ticket:\n🏪 ${r.merchant ?? 'Comercio'}\n💵 ${formatMoney(Math.round(r.total * 100))}${r.date ? `\n📅 ${formatLongDate(r.date)}` : ''}\n\n¿Lo guardo?`, [
      { id: `rcpt:${key}`, title: '✅ Guardar' },
      { id: `rcptno:${key}`, title: '❌ No' },
    ]);
  } else if (msg.type === 'other') {
    return wa.text(msg.from, 'Por ahora entiendo texto, notas de voz y fotos de tickets 🙂');
  }
  if (!text) return;
  await processText(deps, uid, msg.from, text, source, today);
}

async function processText(deps: BotDeps, uid: string, to: string, text: string, source: TxSource, today: string, dateOverride?: string | null) {
  const { store, wa, kv, env } = deps;
  const lower = text.toLowerCase().trim();
  const u = await loadUser(store, uid);

  // ——— Comandos ———
  if (/^(ayuda|help|hola|menu|menú|\?)$/.test(lower)) return wa.text(to, HELP);
  if (lower === 'desvincular') {
    const hash = await hashPhone(to, env.PHONE_HASH_SALT ?? 'fina');
    await store.delete(`waLinks/${hash}`);
    return wa.text(to, '👋 Listo, desvinculé tu número. Puedes volver a vincularlo desde la app cuando quieras.');
  }
  if (lower === 'deshacer') {
    const last = await kv.get(`last:${uid}`);
    if (!last) return wa.text(to, 'No hay nada reciente que deshacer.');
    await undo(store, uid, last.split(','));
    await kv.delete(`last:${uid}`);
    return wa.text(to, '↩️ Listo, lo deshice.');
  }
  if (lower === 'cuentas' || lower === 'saldo') {
    const txs = await store.list<Transaction>(`users/${uid}/transactions`);
    const balances = computeBalances(u.accounts, txs);
    const lines = u.accounts.filter((a) => !a.archived).map((a) => `${a.icon} ${a.name}: ${formatMoney(a.type === 'credit' ? Math.max(0, -(balances[a.id] ?? 0)) : (balances[a.id] ?? 0))}${a.type === 'credit' ? ' (debes)' : ''}`);
    return wa.text(to, `💰 Disponible: *${formatMoney(availableMoney(u.accounts, balances))}*\n${lines.join('\n') || 'Aún no tienes cuentas.'}`);
  }
  const period = ({ hoy: [today, 'Hoy'], semana: [startOfWeek(today), 'Esta semana'], mes: [monthStart(monthKey(today)), 'Este mes'] } as Record<string, [string, string]>)[lower];
  if (period) {
    const [from, label] = period;
    const txs = await store.query<Transaction>(`users/${uid}/transactions`, [['date', '>=', from]]);
    const plans = await store.list<InstallmentPlan>(`users/${uid}/installmentPlans`);
    const s = summarizePeriod(txs, plans, from, today);
    const catName = (id: string) => {
      const c = u.categories.find((x) => x.id === id);
      return c ? `${em(c.emoji)} ${c.name}` : id;
    };
    const top = topEntries(s.byCategory, 5).map(([c, v]) => `• ${catName(c)}: ${formatMoney(v)}`);
    return wa.text(to, `📊 *${label}* llevas *${formatMoney(s.spentCents)}* en gastos${s.incomeCents ? ` y te entraron ${formatMoney(s.incomeCents)}` : ''}.\n${top.join('\n')}`);
  }

  // ——— Preguntas ———
  if (/^¿|\?$|^(cu[aá]nto|en qu[eé]|me alcanza|qui[eé]n me debe|presupuesto|gastos hormiga|mis gastos hormiga)/i.test(lower)) {
    const [txs, budgets, plans] = await Promise.all([store.list<Transaction>(`users/${uid}/transactions`), store.list<Budget>(`users/${uid}/budgets`), store.list<InstallmentPlan>(`users/${uid}/installmentPlans`)]);
    const a = askAssistant(text, { today, transactions: txs, categories: u.categories, accounts: u.accounts, budgets, plans, loans: u.loans, payday: u.profile?.payday });
    if (a.intent !== 'unknown') return wa.text(to, a.text.replace(/\bi:[a-z_]+/g, '•'));
  }

  // ——— Movimientos ———
  const results = parseMany(text, parseCtx(u, today));
  const entries = results.filter((r): r is { ok: true; entry: ParsedEntry } => r.ok).map((r) => r.entry);
  if (!entries.length) {
    const first = results[0];
    return wa.text(to, first && !first.ok ? `🤔 ${first.message}` : 'No entendí. Escribe *ayuda* para ver ejemplos.');
  }
  for (const e of entries) {
    if (dateOverride) e.date = dateOverride;
    if (e.kind === 'expense' && e.confidence < 0.6 && !e.categoryId) {
      const cat = await categorize(env, e.rawText).catch(() => null);
      if (cat) e.categoryId = cat;
    }
  }
  const trips = entries.some((e) => e.kind === 'expense')
    ? await store.list<Trip>(`users/${uid}/trips`).catch(() => [] as Trip[])
    : [];
  const ctx = { uid, accounts: u.accounts, loans: u.loans, trips };
  const created: Transaction[] = [];
  const ops: Array<{ set: { path: string; data: object } }> = [];
  for (const e of entries) {
    const { tx, writes } = entryToDocs(e, ctx, source);
    created.push(tx);
    for (const w of writes) ops.push({ set: { path: w.path, data: w.data } });
  }
  await store.commit(ops);
  const ids = created.map((t) => t.id).join(',');
  await kv.put(`last:${uid}`, ids, { expirationTtl: 24 * 3600 });

  if (created.length > 1) {
    const lines = created.map((t) => `• ${catLabel(u, t)} ${t.description} — ${formatMoney(t.amountCents, { currency: t.currency, decimals: 2 })}`);
    const total = created.filter((t) => t.kind === 'expense').reduce((s, t) => s + (t.myShareCents ?? t.amountMxnCents), 0);
    return wa.buttons(to, `✅ Guardé ${created.length} movimientos\n${lines.join('\n')}\nTotal gastos: ${formatMoney(total)}`, [{ id: `undo:${ids}`, title: '↩️ Deshacer' }]);
  }
  const t = created[0]!;
  const acc = u.accounts.find((a) => a.id === t.accountId);
  const extra: string[] = [];
  if (t.installmentPlanId && entries[0]!.installments) extra.push(`🗓️ ${entries[0]!.installments} MSI de ${formatMoney(Math.round(t.amountMxnCents / entries[0]!.installments))}`);
  if (t.myShareCents !== undefined) extra.push(`👥 Tu parte: ${formatMoney(t.myShareCents)} (el resto queda por cobrar)`);
  if (t.recurringId) extra.push('🔁 Lo guardé como recurrente');
  if (t.kind === 'expense' && t.categoryId && t.categoryId !== 'review') {
    const budgetLine = await budgetStatus(store, uid, t.categoryId, today, u);
    if (budgetLine) extra.push(budgetLine);
  }
  const body = [
    t.status === 'review' ? '✅ Guardado (¿me ayudas con la categoría?)' : '✅ Guardado',
    `${catEmoji(u, t)} ${t.description} — ${formatMoney(t.amountCents, { currency: t.currency, decimals: 2 })}`,
    `📁 ${catName(u, t)} · ${acc?.icon ?? '💵'} ${acc?.name ?? 'Sin cuenta'} · 📅 ${t.date === today ? 'Hoy' : formatLongDate(t.date)}`,
    ...extra,
  ].join('\n');
  const buttons = t.kind === 'expense' || t.kind === 'income' ? [{ id: `cat:${t.id}`, title: '✏️ Categoría' }, { id: `acc:${t.id}`, title: '💳 Cuenta' }, { id: `undo:${t.id}`, title: '↩️ Deshacer' }] : [{ id: `undo:${t.id}`, title: '↩️ Deshacer' }];
  return wa.buttons(to, body, buttons);
}

/** Las categorías con ícono de la app guardan "i:nombre"; en WhatsApp usamos un emoji neutro. */
function em(e: string | undefined): string {
  return !e || e.startsWith('i:') ? '•' : e;
}

function catOf(u: LoadedUser, t: Transaction): Category | undefined {
  return u.categories.find((c) => c.id === t.categoryId);
}
function catEmoji(u: LoadedUser, t: Transaction) {
  return (catOf(u, t) ? em(catOf(u, t)!.emoji) : undefined) ?? (t.kind === 'transfer' ? '🔁' : t.kind === 'debt_payment' ? '💳' : t.kind.startsWith('loan') ? '🤝' : '💸');
}
function catName(u: LoadedUser, t: Transaction) {
  return catOf(u, t)?.name ?? { transfer: 'Transferencia', debt_payment: 'Pago de tarjeta', loan_given: 'Préstamo', loan_received: 'Préstamo', loan_collected: 'Te pagaron', loan_repaid: 'Pagaste', investment: 'Inversión', tanda: 'Tanda', expense: 'Por revisar', income: 'Ingreso' }[t.kind];
}
function catLabel(u: LoadedUser, t: Transaction) {
  return catEmoji(u, t);
}

async function budgetStatus(store: Store, uid: string, categoryId: string, today: string, u: LoadedUser): Promise<string | null> {
  const mk = monthKey(today);
  const budget = await store.get<Budget>(`users/${uid}/budgets/${mk}`);
  const line = budget?.lines?.[categoryId];
  if (!line?.assignedCents) return null;
  const txs = await store.query<Transaction>(`users/${uid}/transactions`, [['date', '>=', monthStart(mk)]]);
  const plans = await store.list<InstallmentPlan>(`users/${uid}/installmentPlans`);
  const spent = summarizePeriod(txs, plans, monthStart(mk), today).byCategory[categoryId] ?? 0;
  const pct = Math.round((spent / line.assignedCents) * 100);
  const c = u.categories.find((x) => x.id === categoryId);
  return `${pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢'} ${c?.name ?? 'Categoría'} este mes: ${formatMoney(spent)} de ${formatMoney(line.assignedCents)} (${pct} %)`;
}

async function undo(store: Store, uid: string, txIds: string[]) {
  const ops: Array<{ delete: string }> = [];
  for (const id of txIds) {
    const tx = await store.get<Transaction>(`users/${uid}/transactions/${id}`);
    if (!tx) continue;
    ops.push({ delete: `users/${uid}/transactions/${id}` });
    if (tx.installmentPlanId) ops.push({ delete: `users/${uid}/installmentPlans/${tx.installmentPlanId}` });
    if (tx.splitId) ops.push({ delete: `users/${uid}/splits/${tx.splitId}` });
    if (tx.recurringId) ops.push({ delete: `users/${uid}/recurring/${tx.recurringId}` });
    if (tx.loanId && (tx.kind === 'loan_given' || tx.kind === 'loan_received')) ops.push({ delete: `users/${uid}/loans/${tx.loanId}` });
  }
  await store.commit(ops);
}

async function handleButton(deps: BotDeps, uid: string, msg: Incoming, today: string) {
  const { store, wa, kv } = deps;
  const id = msg.buttonId!;
  const [action, a, b] = id.split(':') as [string, string, string | undefined];
  if (action === 'undo') {
    await undo(store, uid, a.split(','));
    return wa.text(msg.from, '↩️ Listo, lo deshice.');
  }
  if (action === 'cat') {
    const u = await loadUser(store, uid);
    const tx = await store.get<Transaction>(`users/${uid}/transactions/${a}`);
    const type = tx?.kind === 'income' ? 'income' : 'expense';
    // WhatsApp muestra máx. 10 opciones: primero las que más usas, luego las más comunes.
    const recent = await store.query<Transaction>(`users/${uid}/transactions`, [['date', '>=', addDays(today, -90)]]);
    const uses = new Map<string, number>();
    for (const t of recent) if (t.categoryId) uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1);
    const common = type === 'income' ? ['salary', 'freelance', 'sales', 'bonus', 'refunds', 'gifts_received', 'returns', 'other_income'] : ['food', 'groceries', 'snacks', 'transport', 'gas', 'coffee', 'delivery', 'shopping', 'utilities', 'health', 'entertainment', 'subscriptions', 'home', 'other'];
    const rank = (id: string) => -(uses.get(id) ?? 0) * 100 + (common.includes(id) ? common.indexOf(id) : 50);
    const cats = u.categories.filter((c) => c.type === type && !c.archived && !['review', 'adjustment'].includes(c.id) && c.id !== tx?.categoryId).sort((x, y) => rank(x.id) - rank(y.id)).slice(0, 10);
    return wa.list(msg.from, '¿En qué categoría va?', 'Elegir categoría', cats.map((c) => ({ id: `setcat:${a}:${c.id}`, title: `${em(c.emoji)} ${c.name}` })));
  }
  if (action === 'setcat' && b) {
    await store.patch(`users/${uid}/transactions/${a}`, { categoryId: b, status: 'cleared', updatedAt: new Date().toISOString() });
    // Aprende: la próxima vez esa palabra irá a la categoría elegida.
    const tx = await store.get<Transaction>(`users/${uid}/transactions/${a}`);
    const word = (tx?.merchant ?? tx?.description ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).find((w) => w.length >= 3);
    if (word) await store.set(`users/${uid}/rules/learn_${word.replace(/[^a-z0-9]/g, '')}`, { id: `learn_${word.replace(/[^a-z0-9]/g, '')}`, match: { contains: word }, set: { categoryId: b }, priority: 10, learned: true, hits: 0, createdAt: new Date().toISOString() });
    return wa.text(msg.from, `👍 Cambiado. La próxima vez “${word ?? 'eso'}” irá directo ahí.`);
  }
  if (action === 'acc') {
    const u = await loadUser(store, uid);
    const accs = u.accounts.filter((x) => !x.archived).slice(0, 10);
    if (!accs.length) return wa.text(msg.from, 'Aún no tienes cuentas. Agrégalas en la app.');
    return wa.list(msg.from, '¿Con qué cuenta pagaste?', 'Elegir cuenta', accs.map((x) => ({ id: `setacc:${a}:${x.id}`, title: `${x.icon} ${x.name}` })));
  }
  if (action === 'setacc' && b) {
    await store.patch(`users/${uid}/transactions/${a}`, { accountId: b, updatedAt: new Date().toISOString() });
    return wa.text(msg.from, '👍 Cuenta cambiada.');
  }
  if (action === 'rcpt') {
    const raw = await kv.get(`rcpt:${uid}:${a}`);
    if (!raw) return wa.text(msg.from, 'Ese ticket ya expiró. Mándame la foto otra vez.');
    await kv.delete(`rcpt:${uid}:${a}`);
    const { phrase, date } = JSON.parse(raw) as { phrase: string; date: string | null };
    return processText(deps, uid, msg.from, phrase, 'receipt', today, date);
  }
  if (action === 'rcptno') {
    await kv.delete(`rcpt:${uid}:${a}`);
    return wa.text(msg.from, 'Ok, no lo guardé.');
  }
  return wa.text(msg.from, HELP);
}

export { addDays };
