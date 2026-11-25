import { addDays, addMonths, daysBetween, makeISODate, splitISO, type ISODate } from './dates';
import { splitCents } from './money';
import type { Account, InstallmentPlan, Transaction } from './schemas';

/**
 * Tarjetas de crédito "bien hechas" (como funcionan en México):
 * - Fecha de corte: se cierra el periodo y se genera el estado de cuenta.
 * - Fecha límite de pago: ~20 días después del corte.
 * - Pago para no generar intereses: compras del periodo + mensualidades MSI de ese corte.
 * - Pago mínimo: lo mínimo para no caer en mora (¡genera intereses!).
 */

function cutoffInMonth(year: number, month: number, cutoffDay: number): ISODate {
  return makeISODate(year, month, cutoffDay);
}

/** Fecha del último corte (<= hoy). */
export function lastCutoff(today: ISODate, cutoffDay: number): ISODate {
  const { year, month } = splitISO(today);
  const thisMonth = cutoffInMonth(year, month, cutoffDay);
  if (thisMonth <= today) return thisMonth;
  const prev = addMonths(makeISODate(year, month, 1), -1);
  const p = splitISO(prev);
  return cutoffInMonth(p.year, p.month, cutoffDay);
}

export function nextCutoff(today: ISODate, cutoffDay: number): ISODate {
  const last = lastCutoff(today, cutoffDay);
  const n = splitISO(addMonths(makeISODate(splitISO(last).year, splitISO(last).month, 1), 1));
  return cutoffInMonth(n.year, n.month, cutoffDay);
}

/** Fecha límite de pago de un corte: el primer día "dueDay" posterior al corte. */
export function dueDateForCutoff(cutoff: ISODate, dueDay: number): ISODate {
  const { year, month } = splitISO(cutoff);
  const sameMonth = makeISODate(year, month, dueDay);
  if (sameMonth > cutoff) return sameMonth;
  const n = splitISO(addMonths(makeISODate(year, month, 1), 1));
  return makeISODate(n.year, n.month, dueDay);
}

export interface CardStatement {
  accountId: string;
  /** Corte del estado de cuenta vigente (el último que ya cerró). */
  cutoffDate: ISODate;
  periodStart: ISODate;
  dueDate: ISODate;
  daysUntilDue: number;
  /** Pago para no generar intereses del último corte (estimado). */
  noInterestPaymentCents: number;
  /** Lo que ya pagaste después del corte. */
  paidSinceCutoffCents: number;
  /** Lo que aún falta pagar para no generar intereses. */
  remainingToPayCents: number;
  minimumPaymentCents: number;
  /** Compras hechas después del corte (irán al siguiente estado de cuenta). */
  currentPeriodChargesCents: number;
  nextCutoffDate: ISODate;
  /** Saldo total que debes (incluye MSI pendientes). */
  totalOwedCents: number;
  limitCents: number;
  availableCreditCents: number;
  utilizationPct: number;
  msiInStatementCents: number;
}

function chargesBetween(
  account: Account,
  txs: Transaction[],
  plans: InstallmentPlan[],
  from: ISODate,
  to: ISODate,
): { regular: number; msi: number; credits: number } {
  let regular = 0;
  let credits = 0;
  const planIds = new Set(plans.map((p) => p.id));
  for (const tx of txs) {
    if (tx.date < from || tx.date > to) continue;
    if (tx.accountId === account.id) {
      if ((tx.kind === 'expense' || tx.kind === 'loan_given' || tx.kind === 'tanda') && !(tx.installmentPlanId && planIds.has(tx.installmentPlanId))) {
        regular += tx.amountMxnCents;
      }
      if (tx.kind === 'income' || tx.kind === 'loan_collected') credits += tx.amountMxnCents; // reembolsos/bonificaciones
    }
  }
  let msi = 0;
  for (const plan of plans) {
    if (plan.accountId !== account.id) continue;
    const parts = splitCents(plan.totalCents, plan.months);
    parts.forEach((amount, i) => {
      const d = addMonths(plan.startDate, i);
      if (d >= from && d <= to) msi += amount;
    });
  }
  return { regular, msi, credits };
}

function paymentsBetween(account: Account, txs: Transaction[], from: ISODate, to: ISODate): number {
  return txs
    .filter((t) => t.toAccountId === account.id && (t.kind === 'debt_payment' || t.kind === 'transfer') && t.date >= from && t.date <= to)
    .reduce((s, t) => s + t.amountMxnCents, 0);
}

export function cardStatement(
  account: Account,
  txs: Transaction[],
  plans: InstallmentPlan[],
  balanceCents: number,
  today: ISODate,
): CardStatement | null {
  if (account.type !== 'credit' || !account.credit) return null;
  const { cutoffDay, dueDay, limitCents, minPaymentRate } = account.credit;
  const cutoff = lastCutoff(today, cutoffDay);
  const prevCutoff = lastCutoff(addDays(cutoff, -1), cutoffDay);
  const periodStart = addDays(prevCutoff, 1);
  const due = dueDateForCutoff(cutoff, dueDay);
  // Si ya pasó la fecha límite del último corte, el "vigente" es el siguiente.
  const { regular, msi, credits } = chargesBetween(account, txs, plans, periodStart, cutoff);
  const owed = Math.max(0, -balanceCents);
  const noInterest = Math.min(owed + paymentsBetween(account, txs, addDays(cutoff, 1), today), Math.max(0, regular + msi - credits));
  const paidSince = paymentsBetween(account, txs, addDays(cutoff, 1), today);
  const remaining = Math.max(0, noInterest - paidSince);
  const minimum = Math.min(remaining, Math.max(Math.round(noInterest * minPaymentRate), Math.round(limitCents * 0.0125)));
  const current = chargesBetween(account, txs, plans, addDays(cutoff, 1), today);
  return {
    accountId: account.id,
    cutoffDate: cutoff,
    periodStart,
    dueDate: due,
    daysUntilDue: daysBetween(today, due),
    noInterestPaymentCents: noInterest,
    paidSinceCutoffCents: paidSince,
    remainingToPayCents: remaining,
    minimumPaymentCents: minimum,
    currentPeriodChargesCents: current.regular,
    nextCutoffDate: nextCutoff(today, cutoffDay),
    totalOwedCents: owed,
    limitCents,
    availableCreditCents: Math.max(0, limitCents - owed),
    utilizationPct: limitCents > 0 ? Math.round((owed / limitCents) * 100) : 0,
    msiInStatementCents: msi,
  };
}

/** Interés mensual aproximado si solo pagas el mínimo (para mostrar el "costo" de no pagar completo). */
export function interestIfMinimum(balanceCents: number, annualRate: number): number {
  return Math.round(balanceCents * (annualRate / 12) * 1.16); // + IVA sobre intereses
}

/** Mejor día para comprar: justo después del corte (más días para pagar). */
export function bestPurchaseDay(cutoffDay: number): number {
  return (cutoffDay % 31) + 1;
}
