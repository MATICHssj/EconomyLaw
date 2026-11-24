import { NON_SPENDING_CATEGORIES } from './categories';
import { addMonths, monthKey, type ISODate, type MonthKey } from './dates';
import { LIABILITY_TYPES, LIQUID_TYPES } from './institutions';
import { splitCents } from './money';
import type { Account, InstallmentPlan, Transaction } from './schemas';

/** Cómo afecta un movimiento a los saldos de las cuentas: [cuenta, delta]. */
export function txEffects(tx: Transaction): Array<[string, number]> {
  const amt = tx.amountMxnCents;
  const out: Array<[string, number]> = [];
  const from = tx.accountId;
  const to = tx.toAccountId ?? null;
  switch (tx.kind) {
    case 'expense':
    case 'loan_given':
    case 'loan_repaid':
    case 'tanda':
      if (from) out.push([from, -amt]);
      break;
    case 'income':
    case 'loan_received':
    case 'loan_collected':
      if (from) out.push([from, amt]);
      break;
    case 'transfer':
    case 'debt_payment':
    case 'investment':
      if (from) out.push([from, -amt]);
      if (to) out.push([to, amt]);
      break;
  }
  return out;
}

/** Saldo de cada cuenta = saldo inicial + efecto de todos sus movimientos (hasta una fecha opcional). */
export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
  upTo?: ISODate,
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const a of accounts) balances[a.id] = a.openingBalanceCents;
  for (const tx of transactions) {
    if (upTo && tx.date > upTo) continue;
    for (const [id, delta] of txEffects(tx)) {
      if (id in balances) balances[id] = (balances[id] ?? 0) + delta;
    }
  }
  return balances;
}

/** Dinero disponible: efectivo, débito, monederos y vales (no crédito ni inversiones). */
export function availableMoney(accounts: Account[], balances: Record<string, number>): number {
  return accounts
    .filter((a) => !a.archived && LIQUID_TYPES.has(a.type))
    .reduce((s, a) => s + (balances[a.id] ?? 0), 0);
}

/** Lo que debes en tarjetas/créditos (positivo). */
export function creditOwed(accounts: Account[], balances: Record<string, number>): number {
  return accounts
    .filter((a) => !a.archived && LIABILITY_TYPES.has(a.type))
    .reduce((s, a) => s + Math.max(0, -(balances[a.id] ?? 0)), 0);
}

export function isSpending(tx: Transaction): boolean {
  return tx.kind === 'expense' && !NON_SPENDING_CATEGORIES.has(tx.categoryId ?? '');
}

export function isIncome(tx: Transaction): boolean {
  return tx.kind === 'income' && !NON_SPENDING_CATEGORIES.has(tx.categoryId ?? '');
}

/** Monto que realmente cuenta como gasto tuyo (en compartidos, solo tu parte). */
export function spendingAmount(tx: Transaction): number {
  return tx.myShareCents ?? tx.amountMxnCents;
}

export interface SpendingItem {
  date: ISODate;
  categoryId: string;
  amountCents: number;
  tx: Transaction;
  /** Si viene de una compra a meses: número de mensualidad (1..n). */
  installment?: { n: number; of: number };
}

/**
 * Lista de "gastos efectivos". Las compras a meses (MSI) se reparten en mensualidades
 * para que el presupuesto de cada mes refleje lo que de verdad pagas ese mes.
 */
export function spendingItems(
  transactions: Transaction[],
  plans: InstallmentPlan[] = [],
  range?: { from: ISODate; to: ISODate },
): SpendingItem[] {
  const planById = new Map(plans.map((p) => [p.id, p]));
  const items: SpendingItem[] = [];
  const inRange = (d: ISODate) => !range || (d >= range.from && d <= range.to);
  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    const plan = tx.installmentPlanId ? planById.get(tx.installmentPlanId) : undefined;
    if (plan && plan.months > 1) {
      const parts = splitCents(spendingAmount(tx), plan.months);
      parts.forEach((amount, i) => {
        const date = addMonths(tx.date, i);
        if (inRange(date))
          items.push({
            date,
            categoryId: tx.categoryId ?? 'other',
            amountCents: amount,
            tx,
            installment: { n: i + 1, of: plan.months },
          });
      });
      continue;
    }
    if (inRange(tx.date)) items.push({ date: tx.date, categoryId: tx.categoryId ?? 'other', amountCents: spendingAmount(tx), tx });
  }
  return items;
}

export function sumBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    out[k] = (out[k] ?? 0) + value(it);
  }
  return out;
}

export interface PeriodSummary {
  spentCents: number;
  incomeCents: number;
  byCategory: Record<string, number>;
  count: number;
}

export function summarizePeriod(
  transactions: Transaction[],
  plans: InstallmentPlan[],
  from: ISODate,
  to: ISODate,
): PeriodSummary {
  const items = spendingItems(transactions, plans, { from, to });
  const byCategory = sumBy(items, (i) => i.categoryId, (i) => i.amountCents);
  const spentCents = items.reduce((s, i) => s + i.amountCents, 0);
  const incomeTx = transactions.filter((t) => isIncome(t) && t.date >= from && t.date <= to);
  const incomeCents = incomeTx.reduce((s, t) => s + t.amountMxnCents, 0);
  return { spentCents, incomeCents, byCategory, count: items.length + incomeTx.length };
}

/** Gasto e ingreso por mes (para gráficas y tasa de ahorro). */
export function monthlyTotals(
  transactions: Transaction[],
  plans: InstallmentPlan[] = [],
): Record<MonthKey, { spent: number; income: number }> {
  const out: Record<MonthKey, { spent: number; income: number }> = {};
  for (const it of spendingItems(transactions, plans)) {
    const k = monthKey(it.date);
    out[k] ??= { spent: 0, income: 0 };
    out[k].spent += it.amountCents;
  }
  for (const tx of transactions) {
    if (!isIncome(tx)) continue;
    const k = monthKey(tx.date);
    out[k] ??= { spent: 0, income: 0 };
    out[k].income += tx.amountMxnCents;
  }
  return out;
}

/** Top N categorías de un mapa categoría → monto. */
export function topEntries(map: Record<string, number>, n = 5): Array<[string, number]> {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
