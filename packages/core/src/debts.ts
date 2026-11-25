import { addMonths, type ISODate } from './dates';

export interface DebtInput {
  id: string;
  name: string;
  balanceCents: number;
  annualRate: number;
  minPaymentCents: number;
}

export type DebtStrategy = 'snowball' | 'avalanche';

export interface DebtPlanResult {
  strategy: DebtStrategy;
  feasible: boolean;
  months: number;
  totalInterestCents: number;
  totalPaidCents: number;
  payoffDate: ISODate | null;
  order: Array<{ id: string; name: string; month: number; date: ISODate }>;
  /** Saldo total al final de cada mes (para graficar). */
  timeline: number[];
}

const MAX_MONTHS = 600;

/**
 * Simula pagar deudas con un presupuesto mensual fijo.
 * - Bola de nieve: primero la de MENOR saldo (motivación).
 * - Avalancha: primero la de MAYOR tasa (ahorra más intereses).
 * Los mínimos de las deudas liquidadas se "ruedan" a la siguiente.
 */
export function simulateDebtPayoff(
  debts: DebtInput[],
  monthlyBudgetCents: number,
  strategy: DebtStrategy,
  startDate: ISODate,
): DebtPlanResult {
  const state = debts.filter((d) => d.balanceCents > 0).map((d) => ({ ...d, balance: d.balanceCents }));
  const order: DebtPlanResult['order'] = [];
  const timeline: number[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const minSum = state.reduce((s, d) => s + Math.min(d.minPaymentCents, d.balance), 0);
  const infeasible = (): DebtPlanResult => ({
    strategy,
    feasible: false,
    months: Infinity,
    totalInterestCents: totalInterest,
    totalPaidCents: totalPaid,
    payoffDate: null,
    order,
    timeline,
  });
  if (state.length === 0) {
    return { strategy, feasible: true, months: 0, totalInterestCents: 0, totalPaidCents: 0, payoffDate: startDate, order, timeline };
  }
  if (monthlyBudgetCents < minSum) return infeasible();

  const sortTargets = () =>
    state
      .filter((d) => d.balance > 0)
      .sort((a, b) =>
        strategy === 'snowball' ? a.balance - b.balance || b.annualRate - a.annualRate : b.annualRate - a.annualRate || a.balance - b.balance,
      );

  while (state.some((d) => d.balance > 0)) {
    month++;
    if (month > MAX_MONTHS) return infeasible();
    // 1) intereses
    for (const d of state) {
      if (d.balance <= 0) continue;
      const interest = Math.round(d.balance * (d.annualRate / 12));
      d.balance += interest;
      totalInterest += interest;
    }
    // 2) mínimos
    let budget = monthlyBudgetCents;
    for (const d of state) {
      if (d.balance <= 0) continue;
      const pay = Math.min(d.minPaymentCents, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    // 3) extra al objetivo según estrategia (y en cascada si se liquida)
    for (const target of sortTargets()) {
      if (budget <= 0) break;
      const pay = Math.min(target.balance, budget);
      target.balance -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    for (const d of state) {
      if (d.balance <= 0 && !order.some((o) => o.id === d.id)) {
        order.push({ id: d.id, name: d.name, month, date: addMonths(startDate, month) });
      }
    }
    const remaining = state.reduce((s, d) => s + Math.max(0, d.balance), 0);
    timeline.push(remaining);
    // Si la deuda crece mes con mes, nunca se termina de pagar.
    if (month > 24 && timeline[month - 1]! >= timeline[month - 13]!) return infeasible();
  }
  return {
    strategy,
    feasible: true,
    months: month,
    totalInterestCents: totalInterest,
    totalPaidCents: totalPaid,
    payoffDate: addMonths(startDate, month),
    order,
    timeline,
  };
}

/** Compara ambas estrategias y dice cuánto ahorras con avalancha. */
export function compareStrategies(debts: DebtInput[], monthlyBudgetCents: number, startDate: ISODate) {
  const snowball = simulateDebtPayoff(debts, monthlyBudgetCents, 'snowball', startDate);
  const avalanche = simulateDebtPayoff(debts, monthlyBudgetCents, 'avalanche', startDate);
  return {
    snowball,
    avalanche,
    interestSavedWithAvalancheCents: snowball.feasible && avalanche.feasible ? snowball.totalInterestCents - avalanche.totalInterestCents : 0,
  };
}

/** Meses para liquidar una sola deuda pagando una cantidad fija. */
export function monthsToPayoff(balanceCents: number, annualRate: number, paymentCents: number): number {
  const r = annualRate / 12;
  if (paymentCents <= 0) return Infinity;
  if (r === 0) return Math.ceil(balanceCents / paymentCents);
  if (paymentCents <= balanceCents * r) return Infinity;
  return Math.ceil(-Math.log(1 - (r * balanceCents) / paymentCents) / Math.log(1 + r));
}
