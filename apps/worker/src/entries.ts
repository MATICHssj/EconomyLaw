import {
  convertToMxn,
  findOpenLoan,
  newId,
  nextOccurrence,
  splitCents,
  tripForNewExpense,
  type Account,
  type InstallmentPlan,
  type Loan,
  type Recurring,
  type Split,
  type Transaction,
  type Trip,
  type TxSource,
} from '@fina/core';
import type { ParsedEntry } from '@fina/parser';

export interface UserContext {
  uid: string;
  accounts: Account[];
  loans: Loan[];
  /** Viajes: los gastos hechos durante uno se le asignan solos. */
  trips?: Trip[];
}

export interface DocWrite {
  path: string;
  data: object;
}

/**
 * Versión del servidor de "frase → documentos" (la app tiene la suya con
 * deshacer local). Devuelve el movimiento y los documentos relacionados.
 */
export function entryToDocs(entry: ParsedEntry, ctx: UserContext, source: TxSource, now = new Date()): { tx: Transaction; writes: DocWrite[] } {
  const base = `users/${ctx.uid}`;
  const stamp = now.toISOString();
  const writes: DocWrite[] = [];
  const active = ctx.accounts.filter((a) => !a.archived);
  const byType = (t: Account['type']) => active.find((a) => a.type === t)?.id ?? null;

  let accountId = entry.accountId ?? (entry.accountTypeHint ? byType(entry.accountTypeHint) : null) ?? byType('cash') ?? byType('debit') ?? active[0]?.id ?? null;
  if (!accountId) {
    const acc: Account = { id: newId(), name: 'Mi dinero', type: 'cash', institution: 'cash', currency: 'MXN', openingBalanceCents: 0, color: '#16a34a', icon: '💵', archived: false, aliases: [], createdAt: stamp };
    ctx.accounts.push(acc);
    writes.push({ path: `${base}/accounts/${acc.id}`, data: acc });
    accountId = acc.id;
  }

  const tx: Transaction = {
    id: newId(),
    kind: entry.kind,
    amountCents: entry.amountCents,
    currency: entry.currency,
    fxRate: entry.currency !== 'MXN' ? entry.fxRate : undefined,
    amountMxnCents: entry.amountMxnCents,
    accountId,
    toAccountId: null,
    categoryId: entry.categoryId ?? (entry.kind === 'expense' ? 'review' : entry.kind === 'income' ? 'other_income' : null),
    tags: entry.tags,
    description: entry.description,
    merchant: entry.merchant,
    date: entry.date,
    createdAt: stamp,
    updatedAt: stamp,
    source,
    rawText: entry.rawText.slice(0, 500),
    status: entry.kind === 'expense' && !entry.categoryId ? 'review' : 'cleared',
    reconciled: false,
    person: entry.person,
    attachments: [],
  };

  switch (entry.kind) {
    case 'debt_payment':
      tx.toAccountId = entry.toAccountId ?? byType('credit');
      if (tx.toAccountId === tx.accountId) tx.accountId = byType('debit') ?? tx.accountId;
      tx.categoryId = null;
      break;
    case 'transfer':
      tx.toAccountId = entry.toAccountId ?? (entry.target === 'goal' ? byType('savings') : null);
      tx.categoryId = null;
      break;
    case 'loan_given':
    case 'loan_received': {
      const loan: Loan = { id: newId(), person: entry.person ?? 'Alguien', direction: entry.kind === 'loan_given' ? 'lent' : 'borrowed', amountCents: entry.amountMxnCents, paidCents: 0, createdAt: stamp, closed: false };
      tx.loanId = loan.id;
      tx.categoryId = null;
      writes.push({ path: `${base}/loans/${loan.id}`, data: loan });
      ctx.loans.push(loan);
      break;
    }
    case 'loan_collected':
    case 'loan_repaid': {
      tx.categoryId = null;
      const loan = entry.person ? findOpenLoan(ctx.loans, entry.person, entry.kind === 'loan_collected' ? 'lent' : 'borrowed') : undefined;
      if (loan) {
        tx.loanId = loan.id;
        loan.paidCents += entry.amountMxnCents;
        loan.closed = loan.paidCents >= loan.amountCents;
        writes.push({ path: `${base}/loans/${loan.id}`, data: loan });
      } else if (entry.kind === 'loan_collected') {
        tx.kind = 'income';
        tx.categoryId = 'other_income';
      }
      break;
    }
    case 'investment':
      tx.categoryId = 'investments';
      break;
    case 'tanda':
      tx.categoryId = null;
      break;
    case 'expense': {
      if (entry.splitCount && entry.splitCount > 1) {
        const parts = splitCents(entry.amountMxnCents, entry.splitCount);
        const split: Split = {
          id: newId(),
          description: entry.description,
          totalCents: entry.amountMxnCents,
          date: entry.date,
          transactionId: tx.id,
          participants: parts.map((p, i) => ({ name: i === 0 ? 'Yo' : `Persona ${i + 1}`, shareCents: p, paid: i === 0, isMe: i === 0 })),
          createdAt: stamp,
        };
        tx.splitId = split.id;
        tx.myShareCents = parts[0];
        writes.push({ path: `${base}/splits/${split.id}`, data: split });
      }
      if (entry.installments && entry.installments > 1) {
        if (!entry.accountId) tx.accountId = byType('credit') ?? tx.accountId;
        const plan: InstallmentPlan = { id: newId(), description: entry.description, totalCents: entry.amountMxnCents, months: entry.installments, paidMonths: 0, accountId: tx.accountId, startDate: entry.date, categoryId: tx.categoryId, annualRate: 0, transactionId: tx.id, createdAt: stamp };
        tx.installmentPlanId = plan.id;
        writes.push({ path: `${base}/installmentPlans/${plan.id}`, data: plan });
      }
      break;
    }
    default:
      break;
  }

  if (entry.recurrence && (entry.kind === 'expense' || entry.kind === 'income')) {
    const rec: Recurring = {
      id: newId(),
      name: entry.merchant ?? entry.description,
      template: { kind: entry.kind, amountCents: entry.amountCents, currency: entry.currency, accountId: tx.accountId, toAccountId: null, categoryId: tx.categoryId, description: entry.description, merchant: entry.merchant, tags: entry.tags },
      frequency: entry.recurrence,
      nextDate: nextOccurrence(entry.date, entry.recurrence),
      remindDaysBefore: 2,
      autoCreate: false,
      active: true,
      isSubscription: tx.categoryId === 'subscriptions',
      createdAt: stamp,
    };
    tx.recurringId = rec.id;
    writes.push({ path: `${base}/recurring/${rec.id}`, data: rec });
  }

  const trip = ctx.trips ? tripForNewExpense(ctx.trips, tx) : null;
  if (trip) tx.tripId = trip.id;

  writes.push({ path: `${base}/transactions/${tx.id}`, data: stripUndefined(tx) });
  return { tx, writes };
}

/** Para notificaciones de banco/correo (monto ya conocido). */
export function noticeToTx(p: { uid: string; amountCents: number; currency: string; kind: 'expense' | 'income'; description: string; merchant?: string; categoryId?: string | null; date: string; accountId: string | null; source: TxSource; rawText?: string }, now = new Date()): Transaction {
  const stamp = now.toISOString();
  const { amountMxnCents, rate } = convertToMxn(p.amountCents, p.currency);
  return stripUndefined({
    id: newId(),
    kind: p.kind,
    amountCents: p.amountCents,
    currency: p.currency,
    fxRate: p.currency !== 'MXN' ? rate : undefined,
    amountMxnCents,
    accountId: p.accountId,
    toAccountId: null,
    categoryId: p.categoryId ?? (p.kind === 'income' ? 'other_income' : 'review'),
    tags: [],
    description: p.description.slice(0, 120),
    merchant: p.merchant,
    date: p.date,
    createdAt: stamp,
    updatedAt: stamp,
    source: p.source,
    rawText: p.rawText?.slice(0, 500),
    status: p.categoryId ? 'cleared' : 'review',
    reconciled: false,
    attachments: [],
  });
}

export function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
