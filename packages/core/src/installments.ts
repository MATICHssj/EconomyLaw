import { addMonths, type ISODate } from './dates';
import { splitCents } from './money';
import type { InstallmentPlan } from './schemas';

export interface InstallmentCharge {
  planId: string;
  description: string;
  n: number;
  of: number;
  date: ISODate;
  amountCents: number;
  accountId: string | null;
}

/** Calendario de mensualidades de una compra a meses (sin intereses por defecto). */
export function installmentSchedule(plan: InstallmentPlan): InstallmentCharge[] {
  const total = plan.annualRate > 0 ? totalWithInterest(plan.totalCents, plan.months, plan.annualRate) : plan.totalCents;
  return splitCents(total, plan.months).map((amountCents, i) => ({
    planId: plan.id,
    description: plan.description,
    n: i + 1,
    of: plan.months,
    date: addMonths(plan.startDate, i),
    amountCents,
    accountId: plan.accountId,
  }));
}

/** Total a pagar con intereses (pago fijo, sistema francés). */
export function totalWithInterest(principal: number, months: number, annualRate: number): number {
  const r = annualRate / 12;
  if (r === 0) return principal;
  const payment = (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(payment * months);
}

export interface PlanStatus {
  paidCount: number;
  remainingCount: number;
  paidCents: number;
  remainingCents: number;
  monthlyCents: number;
  nextCharge: InstallmentCharge | null;
  done: boolean;
}

export function planStatus(plan: InstallmentPlan, today: ISODate): PlanStatus {
  const schedule = installmentSchedule(plan);
  const byDate = schedule.filter((c) => c.date <= today).length;
  const paidCount = Math.min(plan.months, Math.max(plan.paidMonths, byDate));
  const paidCents = schedule.slice(0, paidCount).reduce((s, c) => s + c.amountCents, 0);
  const total = schedule.reduce((s, c) => s + c.amountCents, 0);
  return {
    paidCount,
    remainingCount: plan.months - paidCount,
    paidCents,
    remainingCents: total - paidCents,
    monthlyCents: schedule[0]?.amountCents ?? 0,
    nextCharge: schedule[paidCount] ?? null,
    done: paidCount >= plan.months,
  };
}

/** Total de MSI pendientes por pagar (todas las compras). */
export function totalInstallmentsRemaining(plans: InstallmentPlan[], today: ISODate): number {
  return plans.reduce((s, p) => s + planStatus(p, today).remainingCents, 0);
}

/** Mensualidades que caen entre dos fechas (para "próximos pagos" y proyecciones). */
export function installmentsBetween(plans: InstallmentPlan[], from: ISODate, to: ISODate): InstallmentCharge[] {
  return plans
    .flatMap(installmentSchedule)
    .filter((c) => c.date >= from && c.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Cuánto MSI tendrás comprometido cada mes de aquí en adelante (para no sobre-endeudarte). */
export function monthlyInstallmentLoad(plans: InstallmentPlan[], today: ISODate, months = 12): Array<{ month: string; amountCents: number }> {
  const out: Array<{ month: string; amountCents: number }> = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(today, i).slice(0, 7);
    const amount = plans
      .flatMap(installmentSchedule)
      .filter((c) => c.date.slice(0, 7) === m)
      .reduce((s, c) => s + c.amountCents, 0);
    out.push({ month: m, amountCents: amount });
  }
  return out;
}
