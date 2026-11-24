import { addDays, daysBetween, nextPayday, type ISODate, type PaydaySchedule } from './dates';
import { cardStatement, dueDateForCutoff } from './credit';
import { occurrencesBetween, type UpcomingItem } from './recurring';
import { isSpending, spendingAmount } from './balances';
import { tandaSchedule } from './tandas';
import type { Account, InstallmentPlan, Recurring, Tanda, Transaction } from './schemas';

export interface ProjectionEvent {
  date: ISODate;
  title: string;
  amountCents: number; // + entra, − sale
  type: UpcomingItem['type'] | 'daily';
}

export interface ProjectionResult {
  days: Array<{ date: ISODate; balanceCents: number }>;
  events: ProjectionEvent[];
  lowest: { date: ISODate; balanceCents: number };
  /** Promedio diario de gasto "libre" (no recurrente) de los últimos 60 días. */
  dailyBurnCents: number;
  /** Saldo estimado justo antes del siguiente día de pago. */
  beforeNextPayday: { date: ISODate; balanceCents: number } | null;
}

/** Gasto diario promedio que no viene de recurrentes (comida, antojos, transporte…). */
export function averageDailyDiscretionary(transactions: Transaction[], today: ISODate, lookbackDays = 60): number {
  const from = addDays(today, -lookbackDays);
  const total = transactions
    .filter((t) => isSpending(t) && !t.recurringId && !t.installmentPlanId && t.date > from && t.date <= today)
    .reduce((s, t) => s + spendingAmount(t), 0);
  const firstDate = transactions.reduce<ISODate | null>((min, t) => (!min || t.date < min ? t.date : min), null);
  const span = firstDate ? Math.min(lookbackDays, Math.max(7, daysBetween(firstDate, today) + 1)) : lookbackDays;
  return Math.round(total / span);
}

/**
 * Proyección de flujo de efectivo a N días: parte del dinero disponible y aplica
 * recurrentes, pagos de tarjeta, tandas, días de pago y el gasto diario promedio.
 */
export function projectCashFlow(params: {
  today: ISODate;
  days: number;
  startBalanceCents: number;
  accounts: Account[];
  balances: Record<string, number>;
  transactions: Transaction[];
  recurring: Recurring[];
  plans: InstallmentPlan[];
  tandas?: Tanda[];
  payday?: PaydaySchedule;
  /** Ingreso por quincena/pago si no hay un recurrente de ingreso registrado. */
  paycheckCents?: number;
  includeDailyBurn?: boolean;
}): ProjectionResult {
  const { today, days } = params;
  const to = addDays(today, days);
  const events: ProjectionEvent[] = [];

  for (const r of params.recurring.filter((x) => x.active)) {
    // Los recurrentes que van a una tarjeta se pagan en el pago de la tarjeta.
    const acc = params.accounts.find((a) => a.id === r.template.accountId);
    if (acc?.type === 'credit') continue;
    const sign = r.template.kind === 'income' ? 1 : r.template.kind === 'transfer' ? 0 : -1;
    if (sign === 0) continue;
    for (const date of occurrencesBetween(r, addDays(today, 1), to)) {
      events.push({ date, title: r.name, amountCents: sign * r.template.amountCents, type: 'recurring' });
    }
  }

  const hasIncomeRecurring = params.recurring.some((r) => r.active && r.template.kind === 'income');
  if (!hasIncomeRecurring && params.payday && params.paycheckCents) {
    let d = nextPayday(addDays(today, 1), params.payday);
    let guard = 0;
    while (d && d <= to && guard++ < 50) {
      events.push({ date: d, title: 'Día de pago', amountCents: params.paycheckCents, type: 'payday' });
      d = nextPayday(addDays(d, 1), params.payday);
    }
  }

  for (const acc of params.accounts.filter((a) => a.type === 'credit' && a.credit && !a.archived)) {
    const st = cardStatement(acc, params.transactions, params.plans, params.balances[acc.id] ?? 0, today);
    if (st && st.remainingToPayCents > 0 && st.dueDate > today && st.dueDate <= to) {
      events.push({ date: st.dueDate, title: `Pago ${acc.name}`, amountCents: -st.remainingToPayCents, type: 'card' });
    }
    // Siguiente corte: estimamos con las compras actuales del periodo.
    if (st) {
      const nextDue = dueDateForCutoff(st.nextCutoffDate, acc.credit!.dueDay);
      if (nextDue <= to && st.currentPeriodChargesCents > 0) {
        events.push({ date: nextDue, title: `Pago ${acc.name} (próximo corte)`, amountCents: -st.currentPeriodChargesCents, type: 'card' });
      }
    }
  }

  for (const t of params.tandas ?? []) {
    for (const round of tandaSchedule(t)) {
      if (round.date <= today || round.date > to) continue;
      events.push({ date: round.date, title: `Tanda ${t.name}`, amountCents: -t.contributionCents, type: 'tanda' });
      if (round.isMyTurn) events.push({ date: round.date, title: `Te toca la tanda ${t.name}`, amountCents: t.contributionCents * t.participants, type: 'tanda' });
    }
  }

  const burn = params.includeDailyBurn === false ? 0 : averageDailyDiscretionary(params.transactions, today);
  events.sort((a, b) => a.date.localeCompare(b.date));

  const series: ProjectionResult['days'] = [];
  let bal = params.startBalanceCents;
  let lowest = { date: today, balanceCents: bal };
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    if (i > 0) {
      bal -= burn;
      for (const e of events) if (e.date === date) bal += e.amountCents;
    }
    series.push({ date, balanceCents: bal });
    if (bal < lowest.balanceCents) lowest = { date, balanceCents: bal };
  }

  let beforeNextPayday: ProjectionResult['beforeNextPayday'] = null;
  const np = params.payday ? nextPayday(addDays(today, 1), params.payday) : null;
  if (np && np <= to) {
    const prev = series.find((s) => s.date === addDays(np, -1));
    if (prev) beforeNextPayday = { date: prev.date, balanceCents: prev.balanceCents };
  }

  return { days: series, events, lowest, dailyBurnCents: burn, beforeNextPayday };
}

/**
 * "Puedes gastar $X al día": dinero disponible menos compromisos hasta el próximo
 * pago (recurrentes, tarjetas, tandas), dividido entre los días que faltan.
 */
export function safeToSpendPerDay(params: {
  today: ISODate;
  availableCents: number;
  committedCents: number;
  nextPayday: ISODate | null;
}): { perDayCents: number; days: number; freeCents: number } {
  const days = params.nextPayday ? Math.max(1, daysBetween(params.today, params.nextPayday)) : 15;
  const free = params.availableCents - params.committedCents;
  return { perDayCents: Math.max(0, Math.floor(free / days)), days, freeCents: free };
}
