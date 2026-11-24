import { addDays, daysBetween, nextPayday, type ISODate, type PaydaySchedule } from './dates';
import { LIABILITY_TYPES } from './institutions';
import { totalInstallmentsRemaining } from './installments';
import type { Account, Debt, Goal, InstallmentPlan, Investment, Loan, Split } from './schemas';

// ——————————————————— Patrimonio neto ———————————————————

export interface NetWorth {
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
  breakdown: Array<{ label: string; amountCents: number; kind: 'asset' | 'liability' }>;
}

export function netWorth(params: {
  accounts: Account[];
  balances: Record<string, number>;
  investments: Investment[];
  debts: Debt[];
  loans: Loan[];
  splits: Split[];
}): NetWorth {
  const breakdown: NetWorth['breakdown'] = [];
  let assets = 0;
  let liabilities = 0;
  for (const a of params.accounts) {
    if (a.archived) continue;
    const bal = params.balances[a.id] ?? 0;
    if (LIABILITY_TYPES.has(a.type)) {
      const owed = Math.max(0, -bal);
      if (owed) {
        liabilities += owed;
        breakdown.push({ label: a.name, amountCents: owed, kind: 'liability' });
      }
    } else if (bal > 0) {
      assets += bal;
      breakdown.push({ label: a.name, amountCents: bal, kind: 'asset' });
    } else if (bal < 0) {
      liabilities += -bal;
      breakdown.push({ label: `${a.name} (sobregiro)`, amountCents: -bal, kind: 'liability' });
    }
  }
  for (const inv of params.investments) {
    if (inv.archived || !inv.currentValueCents) continue;
    assets += inv.currentValueCents;
    breakdown.push({ label: inv.name, amountCents: inv.currentValueCents, kind: 'asset' });
  }
  const linkedAccountIds = new Set(params.accounts.map((a) => a.id));
  for (const d of params.debts) {
    if (d.archived || (d.accountId && linkedAccountIds.has(d.accountId))) continue; // ya contada en la tarjeta
    liabilities += d.balanceCents;
    breakdown.push({ label: d.name, amountCents: d.balanceCents, kind: 'liability' });
  }
  let receivable = 0;
  let payable = 0;
  for (const l of params.loans) {
    if (l.closed) continue;
    const pending = Math.max(0, l.amountCents - l.paidCents);
    if (l.direction === 'lent') receivable += pending;
    else payable += pending;
  }
  for (const s of params.splits) for (const p of s.participants) if (!p.isMe && !p.paid) receivable += p.shareCents;
  if (receivable) {
    assets += receivable;
    breakdown.push({ label: 'Te deben', amountCents: receivable, kind: 'asset' });
  }
  if (payable) {
    liabilities += payable;
    breakdown.push({ label: 'Debes a personas', amountCents: payable, kind: 'liability' });
  }
  return { assetsCents: assets, liabilitiesCents: liabilities, netWorthCents: assets - liabilities, breakdown };
}

/** MSI pendientes que aún no se reflejan como deuda (si el usuario los registró sin cargo). */
export function pendingInstallments(plans: InstallmentPlan[], today: ISODate): number {
  return totalInstallmentsRemaining(plans, today);
}

// ——————————————————— Inversiones ———————————————————

export function investmentReturn(inv: Investment): { contributedCents: number; gainCents: number; gainPct: number } {
  const contributed = inv.contributions.reduce((s, c) => s + c.amountCents, 0);
  const gain = inv.currentValueCents - contributed;
  return { contributedCents: contributed, gainCents: gain, gainPct: contributed ? Math.round((gain / contributed) * 1000) / 10 : 0 };
}

/** Valor futuro con interés compuesto mensual y aportación mensual. */
export function futureValue(presentCents: number, monthlyContributionCents: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r === 0) return presentCents + monthlyContributionCents * months;
  const growth = Math.pow(1 + r, months);
  return Math.round(presentCents * growth + monthlyContributionCents * ((growth - 1) / r));
}

// ——————————————————— Metas de ahorro ———————————————————

export interface GoalProgress {
  pct: number;
  remainingCents: number;
  /** Aporte sugerido por cada día de pago (quincena) hasta la fecha meta. */
  perPaycheckCents: number | null;
  perMonthCents: number | null;
  paychecksLeft: number | null;
  onTrack: boolean | null;
}

export function goalProgress(goal: Goal, today: ISODate, payday?: PaydaySchedule): GoalProgress {
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const pct = goal.targetCents ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100)) : 0;
  if (!goal.targetDate || goal.targetDate <= today) {
    return { pct, remainingCents: remaining, perPaycheckCents: null, perMonthCents: null, paychecksLeft: null, onTrack: goal.targetDate ? remaining === 0 : null };
  }
  const days = daysBetween(today, goal.targetDate);
  const months = Math.max(1, Math.ceil(days / 30.4));
  let paychecks = 0;
  if (payday && payday.type !== 'irregular') {
    let d = nextPayday(today, payday);
    let guard = 0;
    while (d && d <= goal.targetDate && guard++ < 500) {
      paychecks++;
      d = nextPayday(addDays(d, 1), payday);
    }
  }
  return {
    pct,
    remainingCents: remaining,
    perPaycheckCents: paychecks > 0 ? Math.ceil(remaining / paychecks) : null,
    perMonthCents: Math.ceil(remaining / months),
    paychecksLeft: paychecks || null,
    onTrack: null,
  };
}

/** Meses de gastos que cubre tu fondo de emergencia. */
export function emergencyMonths(savedCents: number, avgMonthlyEssentialCents: number): number {
  if (avgMonthlyEssentialCents <= 0) return 0;
  return Math.round((savedCents / avgMonthlyEssentialCents) * 10) / 10;
}
