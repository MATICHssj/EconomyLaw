import { addMonthsKey, daysBetween, monthEnd, monthStart, type ISODate, type MonthKey } from './dates';
import { percent } from './money';
import type { Budget, Category } from './schemas';

export type BudgetStatus = 'ok' | 'warn' | 'over' | 'empty';

export interface BudgetLineProgress {
  categoryId: string;
  assignedCents: number;
  /** Lo que viene acumulado del mes anterior (solo con "rollover"). */
  carriedCents: number;
  spentCents: number;
  availableCents: number;
  pct: number;
  status: BudgetStatus;
}

export function lineStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? 'over' : 'empty';
  const p = spent / limit;
  if (p >= 1) return 'over';
  if (p >= 0.8) return 'warn';
  return 'ok';
}

/**
 * Progreso de cada línea del presupuesto del mes. Con rollover, lo que sobró
 * (o faltó) el mes anterior se suma a lo disponible de este mes.
 */
export function budgetProgress(
  budget: Budget | undefined,
  spentByCategory: Record<string, number>,
  previous?: { budget: Budget | undefined; spentByCategory: Record<string, number> },
): BudgetLineProgress[] {
  if (!budget) return [];
  return Object.entries(budget.lines)
    .filter(([, line]) => line.assignedCents > 0 || line.rollover)
    .map(([categoryId, line]) => {
      let carried = 0;
      if (line.rollover && previous?.budget) {
        const prevLine = previous.budget.lines[categoryId];
        if (prevLine) carried = prevLine.assignedCents - (previous.spentByCategory[categoryId] ?? 0);
      }
      const spent = spentByCategory[categoryId] ?? 0;
      const limit = line.assignedCents + carried;
      return {
        categoryId,
        assignedCents: line.assignedCents,
        carriedCents: carried,
        spentCents: spent,
        availableCents: limit - spent,
        pct: percent(spent, limit),
        status: lineStatus(spent, limit),
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

export interface FiftyThirtyTwenty {
  incomeCents: number;
  groups: Array<{
    group: 'needs' | 'wants' | 'savings';
    label: string;
    targetPct: number;
    targetCents: number;
    actualCents: number;
    actualPct: number;
    status: BudgetStatus;
  }>;
}

const GROUP_LABELS = { needs: 'Necesidades', wants: 'Gustos', savings: 'Ahorro y deudas' } as const;

/**
 * Método 50/30/20: 50 % necesidades, 30 % gustos, 20 % ahorro/deudas.
 * "Ahorro" incluye categorías de grupo savings (ahorro, inversiones, abonos extra).
 */
export function fiftyThirtyTwenty(
  incomeCents: number,
  spentByCategory: Record<string, number>,
  categories: Category[],
  savedCents = 0,
): FiftyThirtyTwenty {
  const groupOf = new Map(categories.map((c) => [c.id, c.group]));
  const totals = { needs: 0, wants: 0, savings: savedCents };
  for (const [catId, amount] of Object.entries(spentByCategory)) {
    const g = groupOf.get(catId) ?? 'wants';
    if (g === 'needs' || g === 'wants' || g === 'savings') totals[g] += amount;
  }
  const targets = { needs: 50, wants: 30, savings: 20 } as const;
  return {
    incomeCents,
    groups: (['needs', 'wants', 'savings'] as const).map((group) => {
      const targetCents = Math.round((incomeCents * targets[group]) / 100);
      const actual = totals[group];
      return {
        group,
        label: GROUP_LABELS[group],
        targetPct: targets[group],
        targetCents,
        actualCents: actual,
        actualPct: percent(actual, incomeCents),
        // En ahorro, quedarse corto es lo "malo".
        status:
          group === 'savings'
            ? actual >= targetCents
              ? 'ok'
              : actual >= targetCents * 0.5
                ? 'warn'
                : 'over'
            : lineStatus(actual, targetCents),
      };
    }),
  };
}

export interface ZeroBasedState {
  /** Ingresos del mes + lo que sobró sin asignar del mes anterior. */
  availableToAssignCents: number;
  assignedCents: number;
  /** "Dinero por asignar" (estilo YNAB). Negativo = asignaste de más. */
  toAssignCents: number;
}

/** Presupuesto base cero: dale un trabajo a cada peso. */
export function zeroBasedState(
  budget: Budget | undefined,
  incomeThisMonthCents: number,
  carryOverCents = 0,
): ZeroBasedState {
  const assigned = budget ? Object.values(budget.lines).reduce((s, l) => s + l.assignedCents, 0) : 0;
  const available = incomeThisMonthCents + carryOverCents;
  return { availableToAssignCents: available, assignedCents: assigned, toAssignCents: available - assigned };
}

/** Copia las líneas de un presupuesto a otro mes (botón "Copiar mes anterior"). */
export function copyBudget(from: Budget, toKey: MonthKey): Budget {
  return { ...from, id: toKey, lines: structuredClone(from.lines) };
}

/** Sugiere un presupuesto a partir del promedio de gasto de los últimos meses (redondeado a $50). */
export function suggestBudgetLines(
  spentByMonth: Array<Record<string, number>>,
): Record<string, { assignedCents: number; rollover: boolean }> {
  const totals: Record<string, number> = {};
  for (const m of spentByMonth) for (const [k, v] of Object.entries(m)) totals[k] = (totals[k] ?? 0) + v;
  const n = Math.max(1, spentByMonth.length);
  const out: Record<string, { assignedCents: number; rollover: boolean }> = {};
  for (const [k, v] of Object.entries(totals)) {
    if (k === 'review' || k === 'adjustment') continue;
    const avg = v / n;
    const rounded = Math.ceil(avg / 5000) * 5000;
    if (rounded > 0) out[k] = { assignedCents: rounded, rollover: false };
  }
  return out;
}

/** Días que faltan para terminar el mes (incluye hoy). */
export function daysLeftInMonth(today: ISODate): number {
  return daysBetween(today, monthEnd(today.slice(0, 7))) + 1;
}

export function previousMonthKey(key: MonthKey): MonthKey {
  return addMonthsKey(key, -1);
}

export function monthRange(key: MonthKey): { from: ISODate; to: ISODate } {
  return { from: monthStart(key), to: monthEnd(key) };
}
