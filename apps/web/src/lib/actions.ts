import {
  addMonths,
  convertToMxn,
  findOpenLoan,
  generateDemoData,
  isDemoDoc,
  newId,
  nextOccurrence,
  normalizeText,
  splitCents,
  todayISO,
  COLLECTIONS,
  type Account,
  type CollectionMap,
  type CollectionName,
  type InstallmentPlan,
  type Recurring,
  type Rule,
  type Transaction,
} from '@fina/core';
import { ruleFromCorrection, type ParseContext, type ParsedEntry } from '@fina/parser';
import { getDocs, useData } from '@/stores/data';
import { toast, useUI } from '@/stores/ui';
import { useSession } from '@/stores/session';
import type { AnyDoc, Space, WriteOp } from './backend/types';

// ——————————————————— Cambios con "deshacer" ———————————————————

export interface Change {
  space: Space;
  col: CollectionName;
  before: AnyDoc | null;
  after: AnyDoc | null;
}

function toOps(changes: Change[]): WriteOp[] {
  return changes.map((c) =>
    c.after
      ? { type: 'put', space: c.space, col: c.col, doc: c.after }
      : { type: 'delete', space: c.space, col: c.col, id: c.before!.id },
  );
}

function invert(changes: Change[]): Change[] {
  return [...changes]
    .reverse()
    .map((c) => ({ space: c.space, col: c.col, before: c.after, after: c.before }));
}

export async function applyChanges(changes: Change[]): Promise<void> {
  if (!changes.length) return;
  await useData.getState().write(toOps(changes));
}

/** Aplica cambios y muestra un aviso con "Deshacer". */
export async function commitWithUndo(
  changes: Change[],
  message: string,
  extra?: { label: string; onClick: () => void },
) {
  await applyChanges(changes);
  const inverse = invert(changes);
  toast(message, 'success', [
    {
      label: 'Deshacer',
      onClick: () => {
        void applyChanges(inverse).then(() => toast('Listo, se deshizo.'));
      },
    },
    ...(extra ? [extra] : []),
  ]);
}

const now = () => new Date().toISOString();

export function currentSpace(): Space {
  const s = useData.getState();
  return s.household && s.spaceFilter === 'household' ? 'household' : 'personal';
}

function find<K extends CollectionName>(
  col: K,
  id: string | null | undefined,
): (CollectionMap[K] & { space: Space }) | undefined {
  if (!id) return undefined;
  return getDocs(col).find((d) => d.id === id);
}

function clean<T extends object>(doc: T): Omit<T, 'space'> {
  const { space: _s, ...rest } = doc as T & { space?: Space };
  return rest;
}

/** Igual que clean() pero tipado como documento genérico (para cambios de cualquier colección). */
function cleanAny(doc: object): AnyDoc {
  return clean(doc) as unknown as AnyDoc;
}

// ——————————————————— Cuentas por defecto ———————————————————

export function defaultAccountId(preferType?: Account['type']): string | null {
  const s = useData.getState();
  const accounts = s.data.accounts.filter((a) => !a.archived);
  if (preferType) {
    const pref = accounts.find((a) => a.type === preferType);
    if (pref) return pref.id;
  }
  if (s.settings.defaultAccountId && accounts.some((a) => a.id === s.settings.defaultAccountId))
    return s.settings.defaultAccountId;
  return (
    (
      accounts.find((a) => a.type === 'cash') ??
      accounts.find((a) => a.type === 'debit') ??
      accounts[0]
    )?.id ?? null
  );
}

export function newAccount(p: Partial<Account> & Pick<Account, 'name' | 'type'>): Account {
  return {
    id: newId(),
    institution: undefined,
    currency: 'MXN',
    openingBalanceCents: 0,
    color: '#64748b',
    icon: '',
    archived: false,
    aliases: [],
    createdAt: now(),
    ...p,
  };
}

/** Asegura que exista al menos una cuenta ("Mi dinero") para el nivel Básico. */
export function ensureAccountChanges(): { accountId: string; changes: Change[] } {
  const existing = defaultAccountId();
  if (existing) return { accountId: existing, changes: [] };
  const acc = newAccount({
    name: 'Mi dinero',
    type: 'cash',
    institution: 'cash',
    icon: '',
    color: '#16a34a',
  });
  return {
    accountId: acc.id,
    changes: [{ space: 'personal', col: 'accounts', before: null, after: acc }],
  };
}

// ——————————————————— Contexto del parser ———————————————————

export function parseContext(): ParseContext {
  const s = useData.getState();
  const people: Record<string, 'lent' | 'borrowed'> = {};
  for (const l of s.data.loans) if (!l.closed) people[l.person] = l.direction;
  return {
    today: todayISO(),
    accounts: s.data.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      aliases: a.aliases,
      archived: a.archived,
    })),
    rules: s.data.rules
      .filter((r) => r.match.contains || r.match.merchant)
      .sort((a, b) => b.priority - a.priority)
      .map((r) => ({
        pattern: normalizeText(r.match.contains ?? r.match.merchant ?? ''),
        categoryId: r.set.categoryId,
        accountId: r.set.accountId,
        tags: r.set.tags,
      })),
    people,
    fxRates: loadFxRates(),
  };
}

export function loadFxRates(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem('fina:fx');
    if (!raw) return undefined;
    return (JSON.parse(raw) as { rates: Record<string, number> }).rates;
  } catch {
    return undefined;
  }
}

/** Tipo de cambio del día desde una API gratuita (sin clave). Se guarda 12 h. */
export async function refreshFxRates(): Promise<void> {
  try {
    const raw = localStorage.getItem('fina:fx');
    if (raw && Date.now() - (JSON.parse(raw) as { at: number }).at < 12 * 3600_000) return;
    const res = await fetch('https://open.er-api.com/v6/latest/MXN');
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates) return;
    const rates: Record<string, number> = { MXN: 1 };
    for (const [k, v] of Object.entries(json.rates))
      if (v > 0) rates[k] = Math.round((1 / v) * 10000) / 10000;
    localStorage.setItem('fina:fx', JSON.stringify({ at: Date.now(), rates }));
  } catch {
    /* sin internet: se usan los tipos de cambio de respaldo */
  }
}

// ——————————————————— Guardar lo que escribe el usuario ———————————————————

export interface CommitOptions {
  space?: Space;
  source?: Transaction['source'];
  accountId?: string | null;
  categoryId?: string | null;
  silent?: boolean;
  /** Cuenta a usar si la frase no menciona ninguna (evita crear "Mi dinero" dos veces). */
  fallbackAccountId?: string;
}

/** Convierte una frase ya interpretada en documentos (movimiento + MSI, préstamo, recurrente…). */
export function entryToChanges(
  entry: ParsedEntry,
  opts: CommitOptions = {},
): { tx: Transaction; changes: Change[] } {
  const s = useData.getState();
  const space = opts.space ?? currentSpace();
  const uid = useSession.getState().user?.uid;
  const changes: Change[] = [];
  const stamp = now();

  let accountId = opts.accountId ?? entry.accountId ?? null;
  if (!accountId && entry.accountTypeHint) accountId = defaultAccountId(entry.accountTypeHint);
  if (!accountId && opts.fallbackAccountId) accountId = opts.fallbackAccountId;
  if (!accountId) {
    const ensured = ensureAccountChanges();
    accountId = ensured.accountId;
    changes.push(...ensured.changes);
  }
  let toAccountId = entry.toAccountId ?? null;

  const lowConfidence = entry.confidence < 0.6 && entry.kind === 'expense';
  const tx: Transaction = {
    id: newId(),
    kind: entry.kind,
    amountCents: entry.amountCents,
    currency: entry.currency,
    fxRate: entry.currency !== 'MXN' ? entry.fxRate : undefined,
    amountMxnCents: entry.amountMxnCents,
    accountId,
    toAccountId: null,
    categoryId:
      opts.categoryId ??
      entry.categoryId ??
      (entry.kind === 'expense' ? 'review' : entry.kind === 'income' ? 'other_income' : null),
    tags: entry.tags,
    description: entry.description,
    merchant: entry.merchant,
    date: entry.date,
    createdAt: stamp,
    updatedAt: stamp,
    source: opts.source ?? 'app',
    rawText: entry.rawText,
    status: lowConfidence && !opts.categoryId ? 'review' : 'cleared',
    reconciled: false,
    person: entry.person,
    attachments: [],
    createdBy: space === 'household' ? uid : undefined,
  };

  switch (entry.kind) {
    case 'debt_payment': {
      toAccountId ??= defaultAccountId('credit');
      if (toAccountId === accountId) accountId = defaultAccountId('debit');
      tx.accountId = accountId;
      tx.toAccountId = toAccountId;
      tx.categoryId = null;
      break;
    }
    case 'transfer': {
      if (entry.target === 'goal') {
        const goals = s.data.goals.filter((g) => !g.archived);
        const name = normalizeText(entry.targetName ?? '');
        const goal =
          goals.find((g) => name && normalizeText(g.name).includes(name)) ??
          goals.find((g) => g.type === 'emergency') ??
          goals[0];
        if (goal) {
          tx.goalId = goal.id;
          changes.push({
            space: goal.space,
            col: 'goals',
            before: clean(goal),
            after: { ...clean(goal), savedCents: goal.savedCents + entry.amountMxnCents },
          });
          toAccountId ??= goal.accountId ?? null;
        }
        toAccountId ??= defaultAccountId('savings');
        if (toAccountId === accountId) toAccountId = null;
      }
      tx.toAccountId = toAccountId;
      tx.categoryId = null;
      break;
    }
    case 'loan_given':
    case 'loan_received': {
      const loanId = newId();
      tx.loanId = loanId;
      tx.categoryId = null;
      changes.push({
        space,
        col: 'loans',
        before: null,
        after: {
          id: loanId,
          person: entry.person ?? 'Alguien',
          direction: entry.kind === 'loan_given' ? 'lent' : 'borrowed',
          amountCents: entry.amountMxnCents,
          paidCents: 0,
          createdAt: stamp,
          closed: false,
        },
      });
      break;
    }
    case 'loan_collected':
    case 'loan_repaid': {
      tx.categoryId = null;
      const loan = (
        entry.person
          ? findOpenLoan(
              s.data.loans,
              entry.person,
              entry.kind === 'loan_collected' ? 'lent' : 'borrowed',
            )
          : undefined
      ) as (typeof s.data.loans)[number] | undefined;
      if (loan) {
        tx.loanId = loan.id;
        const paid = loan.paidCents + entry.amountMxnCents;
        changes.push({
          space: loan.space,
          col: 'loans',
          before: clean(loan),
          after: { ...clean(loan), paidCents: paid, closed: paid >= loan.amountCents },
        });
      } else if (entry.kind === 'loan_collected' && entry.person) {
        // ¿Era su parte de un gasto compartido?
        const p = normalizeText(entry.person);
        const split = s.data.splits.find((sp) =>
          sp.participants.some((x) => !x.isMe && !x.paid && normalizeText(x.name) === p),
        );
        if (split) {
          tx.splitId = split.id;
          changes.push({
            space: split.space,
            col: 'splits',
            before: clean(split),
            after: {
              ...clean(split),
              participants: split.participants.map((x) =>
                normalizeText(x.name) === p ? { ...x, paid: true } : x,
              ),
            },
          });
        } else {
          tx.kind = 'income';
          tx.categoryId = 'other_income';
        }
      }
      break;
    }
    case 'investment': {
      tx.categoryId = 'investments';
      const name = normalizeText(entry.targetName ?? '');
      const inv = s.data.investments.find(
        (i) => !i.archived && (normalizeText(i.name).includes(name) || i.type === name),
      );
      const invId = inv?.id ?? newId();
      tx.investmentId = invId;
      const contribution = { date: entry.date, amountCents: entry.amountMxnCents };
      if (inv) {
        changes.push({
          space: inv.space,
          col: 'investments',
          before: clean(inv),
          after: {
            ...clean(inv),
            contributions: [...inv.contributions, contribution],
            currentValueCents: inv.currentValueCents + entry.amountMxnCents,
            updatedAt: stamp,
          },
        });
      } else {
        const type = (['cetes', 'afore', 'ppr', 'gbm'] as const).find((t) => name.includes(t));
        changes.push({
          space: 'personal',
          col: 'investments',
          before: null,
          after: {
            id: invId,
            name: entry.targetName ?? 'Inversión',
            type: type === 'gbm' ? 'stock' : (type ?? 'other'),
            contributions: [contribution],
            currentValueCents: entry.amountMxnCents,
            updatedAt: stamp,
            createdAt: stamp,
            archived: false,
          },
        });
      }
      break;
    }
    case 'tanda': {
      tx.categoryId = null;
      const tanda = s.data.tandas.find((t) => !t.archived);
      if (tanda) tx.tandaId = tanda.id;
      break;
    }
    case 'expense': {
      if (entry.splitCount && entry.splitCount > 1) {
        const parts = splitCents(entry.amountMxnCents, entry.splitCount);
        const splitId = newId();
        tx.splitId = splitId;
        tx.myShareCents = parts[0];
        changes.push({
          space,
          col: 'splits',
          before: null,
          after: {
            id: splitId,
            description: entry.description,
            totalCents: entry.amountMxnCents,
            date: entry.date,
            transactionId: tx.id,
            participants: parts.map((p, i) => ({
              name: i === 0 ? 'Yo' : `Persona ${i + 1}`,
              shareCents: p,
              paid: i === 0,
              isMe: i === 0,
            })),
            createdAt: stamp,
          },
        });
      }
      if (entry.installments && entry.installments > 1) {
        if (!entry.accountId && !opts.accountId)
          tx.accountId = defaultAccountId('credit') ?? tx.accountId;
        const plan: InstallmentPlan = {
          id: newId(),
          description: entry.description,
          totalCents: entry.amountMxnCents,
          months: entry.installments,
          paidMonths: 0,
          accountId: tx.accountId,
          startDate: entry.date,
          categoryId: tx.categoryId,
          annualRate: 0,
          transactionId: tx.id,
          createdAt: stamp,
        };
        tx.installmentPlanId = plan.id;
        changes.push({ space, col: 'installmentPlans', before: null, after: plan });
      }
      break;
    }
    default:
      break;
  }

  if (entry.recurrence && (entry.kind === 'expense' || entry.kind === 'income')) {
    const freq = entry.recurrence === 'biweekly' ? 'biweekly' : entry.recurrence;
    const rec: Recurring = {
      id: newId(),
      name: entry.merchant ?? entry.description,
      template: {
        kind: entry.kind,
        amountCents: entry.amountCents,
        currency: entry.currency,
        accountId: tx.accountId,
        toAccountId: null,
        categoryId: tx.categoryId,
        description: entry.description,
        merchant: entry.merchant,
        tags: entry.tags,
      },
      frequency: freq,
      nextDate: nextOccurrence(entry.date, freq),
      remindDaysBefore: 2,
      autoCreate: false,
      active: true,
      isSubscription: tx.categoryId === 'subscriptions',
      createdAt: stamp,
    };
    tx.recurringId = rec.id;
    changes.push({ space, col: 'recurring', before: null, after: rec });
  }

  changes.push({ space, col: 'transactions', before: null, after: tx });
  return { tx, changes };
}

export async function commitEntries(
  entries: ParsedEntry[],
  opts: CommitOptions = {},
): Promise<Transaction[]> {
  const ensured = ensureAccountChanges();
  const all: Change[] = [...ensured.changes];
  const txs: Transaction[] = [];
  for (const e of entries) {
    const { tx, changes } = entryToChanges(e, { ...opts, fallbackAccountId: ensured.accountId });
    all.push(...changes);
    txs.push(tx);
  }
  if (opts.silent) {
    await applyChanges(all);
    return txs;
  }
  const first = txs[0]!;
  const msg =
    txs.length > 1 ? `${txs.length} movimientos guardados` : `Guardado: ${first.description}`;
  await commitWithUndo(
    all,
    msg,
    txs.length === 1
      ? { label: 'Editar', onClick: () => useUI.getState().editTx(first.id) }
      : undefined,
  );
  return txs;
}

// ——————————————————— Editar / borrar movimientos ———————————————————

export async function saveTransaction(
  tx: Transaction & { space?: Space },
  opts: { learn?: boolean } = {},
): Promise<void> {
  const prev = find('transactions', tx.id);
  const space = prev?.space ?? tx.space ?? currentSpace();
  const updated: Transaction = { ...clean(tx as Transaction & { space: Space }), updatedAt: now() };
  if (updated.currency === 'MXN') updated.amountMxnCents = updated.amountCents;
  else if (
    !prev ||
    prev.amountCents !== updated.amountCents ||
    prev.currency !== updated.currency
  ) {
    const { amountMxnCents, rate } = convertToMxn(
      updated.amountCents,
      updated.currency,
      loadFxRates(),
    );
    updated.amountMxnCents = amountMxnCents;
    updated.fxRate = rate;
  }
  if (updated.status === 'review' && updated.categoryId && updated.categoryId !== 'review')
    updated.status = 'cleared';
  const changes: Change[] = [
    { space, col: 'transactions', before: prev ? clean(prev) : null, after: updated },
  ];
  // Aprende de la corrección: la próxima vez "galleta" ya irá a la categoría elegida.
  if (
    opts.learn !== false &&
    prev &&
    prev.categoryId !== updated.categoryId &&
    updated.categoryId &&
    updated.rawText
  ) {
    const pattern = ruleFromCorrection({
      merchant: updated.merchant,
      description: updated.description,
      rawText: updated.rawText,
    });
    if (pattern) {
      const existing = getDocs('rules').find(
        (r) => r.learned && normalizeText(r.match.contains ?? '') === pattern,
      );
      const rule: Rule = existing
        ? { ...clean(existing), set: { ...existing.set, categoryId: updated.categoryId } }
        : {
            id: newId(),
            match: { contains: pattern },
            set: { categoryId: updated.categoryId },
            priority: 10,
            learned: true,
            hits: 0,
            createdAt: now(),
          };
      changes.push({
        space: 'personal',
        col: 'rules',
        before: existing ? clean(existing) : null,
        after: rule,
      });
    }
  }
  if (prev && updated.installmentPlanId && prev.amountCents !== updated.amountCents) {
    const plan = find('installmentPlans', updated.installmentPlanId);
    if (plan)
      changes.push({
        space: plan.space,
        col: 'installmentPlans',
        before: clean(plan),
        after: { ...clean(plan), totalCents: updated.amountMxnCents, accountId: updated.accountId },
      });
  }
  await commitWithUndo(changes, prev ? 'Cambios guardados' : 'Movimiento guardado');
}

export async function deleteTransaction(id: string): Promise<void> {
  const tx = find('transactions', id);
  if (!tx) return;
  const changes: Change[] = [
    { space: tx.space, col: 'transactions', before: clean(tx), after: null },
  ];
  const plan = find('installmentPlans', tx.installmentPlanId);
  if (plan)
    changes.push({ space: plan.space, col: 'installmentPlans', before: clean(plan), after: null });
  const split = find('splits', tx.splitId);
  if (split && split.transactionId === tx.id)
    changes.push({ space: split.space, col: 'splits', before: clean(split), after: null });
  const loan = find('loans', tx.loanId);
  if (loan) {
    if (tx.kind === 'loan_given' || tx.kind === 'loan_received')
      changes.push({ space: loan.space, col: 'loans', before: clean(loan), after: null });
    else {
      const paid = Math.max(0, loan.paidCents - tx.amountMxnCents);
      changes.push({
        space: loan.space,
        col: 'loans',
        before: clean(loan),
        after: { ...clean(loan), paidCents: paid, closed: paid >= loan.amountCents },
      });
    }
  }
  const goal = find('goals', tx.goalId);
  if (goal)
    changes.push({
      space: goal.space,
      col: 'goals',
      before: clean(goal),
      after: { ...clean(goal), savedCents: Math.max(0, goal.savedCents - tx.amountMxnCents) },
    });
  await commitWithUndo(changes, 'Movimiento borrado');
}

// ——————————————————— CRUD genérico ———————————————————

export async function saveDoc<K extends CollectionName>(
  col: K,
  doc: CollectionMap[K] & { space?: Space },
  message?: string,
): Promise<void> {
  const prev = find(col, doc.id);
  const space =
    prev?.space ??
    doc.space ??
    (col === 'accounts' || col === 'budgets' || col === 'goals' || col === 'recurring'
      ? currentSpace()
      : 'personal');
  const change: Change = { space, col, before: prev ? cleanAny(prev) : null, after: cleanAny(doc) };
  if (message) await commitWithUndo([change], message);
  else await applyChanges([change]);
}

export async function deleteDoc(
  col: CollectionName,
  id: string,
  message = 'Eliminado',
): Promise<void> {
  const prev = find(col, id);
  if (!prev) return;
  await commitWithUndo([{ space: prev.space, col, before: cleanAny(prev), after: null }], message);
}

// ——————————————————— Recurrentes ———————————————————

/** Registra un pago recurrente (botón "Ya lo pagué") y avanza su siguiente fecha. */
export async function payRecurring(
  rec: Recurring & { space?: Space },
  date = todayISO(),
): Promise<void> {
  const prev = find('recurring', rec.id);
  const stamp = now();
  const { amountMxnCents, rate } = convertToMxn(
    rec.template.amountCents,
    rec.template.currency,
    loadFxRates(),
  );
  const tx: Transaction = {
    id: newId(),
    kind: rec.template.kind,
    amountCents: rec.template.amountCents,
    currency: rec.template.currency,
    fxRate: rec.template.currency !== 'MXN' ? rate : undefined,
    amountMxnCents,
    accountId: rec.template.accountId ?? defaultAccountId(),
    toAccountId: rec.template.toAccountId ?? null,
    categoryId: rec.template.categoryId,
    tags: rec.template.tags,
    description: rec.template.description || rec.name,
    merchant: rec.template.merchant,
    date,
    createdAt: stamp,
    updatedAt: stamp,
    source: 'recurring',
    status: 'cleared',
    reconciled: false,
    recurringId: rec.id,
    attachments: [],
  };
  const space = prev?.space ?? 'personal';
  await commitWithUndo(
    [
      { space, col: 'transactions', before: null, after: tx },
      {
        space,
        col: 'recurring',
        before: prev ? clean(prev) : null,
        after: {
          ...clean(rec as Recurring & { space: Space }),
          nextDate: nextOccurrence(rec.nextDate, rec.frequency),
        },
      },
    ],
    `${rec.name} registrado`,
  );
}

/** Al abrir la app: registra los recurrentes automáticos que ya vencieron. */
export async function processDueRecurring(): Promise<number> {
  const s = useData.getState();
  const today = todayISO();
  const changes: Change[] = [];
  let count = 0;
  for (const r of s.data.recurring) {
    if (!r.active || !r.autoCreate || r.nextDate > today) continue;
    let next = r.nextDate;
    let guard = 0;
    while (next <= today && guard++ < 24) {
      const stamp = now();
      changes.push({
        space: r.space,
        col: 'transactions',
        before: null,
        after: {
          id: `rec_${r.id}_${next}`,
          kind: r.template.kind,
          amountCents: r.template.amountCents,
          currency: r.template.currency,
          amountMxnCents: convertToMxn(r.template.amountCents, r.template.currency, loadFxRates())
            .amountMxnCents,
          accountId: r.template.accountId,
          toAccountId: r.template.toAccountId ?? null,
          categoryId: r.template.categoryId,
          tags: r.template.tags,
          description: r.template.description || r.name,
          merchant: r.template.merchant,
          date: next,
          createdAt: stamp,
          updatedAt: stamp,
          source: 'recurring',
          status: 'cleared',
          reconciled: false,
          recurringId: r.id,
          attachments: [],
        },
      });
      count++;
      next = nextOccurrence(next, r.frequency);
    }
    changes.push({
      space: r.space,
      col: 'recurring',
      before: clean(r),
      after: { ...clean(r), nextDate: next },
    });
  }
  if (changes.length) await applyChanges(changes);
  return count;
}

// ——————————————————— MSI manual ———————————————————

export function installmentPlanFromForm(p: {
  description: string;
  totalCents: number;
  months: number;
  accountId: string | null;
  startDate: string;
  paidMonths: number;
  categoryId: string | null;
  annualRate: number;
}) {
  const stamp = now();
  const plan: InstallmentPlan = { id: newId(), ...p, createdAt: stamp };
  const tx: Transaction = {
    id: newId(),
    kind: 'expense',
    amountCents: p.totalCents,
    currency: 'MXN',
    amountMxnCents: p.totalCents,
    accountId: p.accountId,
    toAccountId: null,
    categoryId: p.categoryId ?? 'shopping',
    tags: [],
    description: `${p.description} a ${p.months} MSI`,
    date: p.startDate,
    createdAt: stamp,
    updatedAt: stamp,
    source: 'app',
    status: 'cleared',
    reconciled: false,
    installmentPlanId: plan.id,
    attachments: [],
  };
  plan.transactionId = tx.id;
  return { plan, tx };
}

// ——————————————————— Datos de ejemplo ———————————————————

export async function loadDemoData(): Promise<void> {
  const demo = generateDemoData(todayISO());
  const changes: Change[] = [];
  for (const col of COLLECTIONS) {
    for (const doc of (demo[col] ?? []) as AnyDoc[]) {
      const existing = find(col, doc.id);
      // No pisar un presupuesto real del usuario con el de ejemplo.
      if (col === 'budgets' && existing && !isDemoDoc(existing)) continue;
      changes.push({
        space: 'personal',
        col,
        before: existing ? cleanAny(existing) : null,
        after: doc,
      });
    }
  }
  await applyChanges(changes);
  const s = useData.getState();
  if (!s.profile?.monthlyIncomeCents) await s.updateProfile({ monthlyIncomeCents: 2900000 });
  toast('Datos de ejemplo cargados: 3 meses ficticios. Puedes borrarlos en Ajustes.', 'success');
}

export async function clearDemoData(): Promise<void> {
  const ops: WriteOp[] = [];
  const s = useData.getState();
  for (const col of COLLECTIONS) {
    for (const d of s.data[col] as Array<AnyDoc & { space: Space; demo?: boolean }>) {
      if (isDemoDoc(d) || (d as Transaction).id?.startsWith('rec_demo_'))
        ops.push({ type: 'delete', space: d.space, col, id: d.id });
    }
  }
  await s.write(ops);
  toast('Datos de ejemplo borrados.', 'success');
}

export function hasDemoData(): boolean {
  return useData.getState().data.transactions.some((t) => isDemoDoc(t));
}

// ——————————————————— Migración local → nube ———————————————————

export async function uploadLocalData(): Promise<number> {
  const { LocalBackend } = await import('./backend/local');
  const local = new LocalBackend();
  const { meta, data } = await local.exportAll();
  local.dispose();
  const ops: WriteOp[] = [];
  for (const col of COLLECTIONS)
    for (const doc of data[col] ?? []) ops.push({ type: 'put', space: 'personal', col, doc });
  await useData.getState().write(ops);
  if (meta.profile) await useData.getState().updateProfile(meta.profile);
  if (meta.settings) await useData.getState().updateSettings(meta.settings);
  return ops.length;
}

export { addMonths };
