import { addDays, addMonths, daysBetween, splitISO, type ISODate } from './dates';
import type { Frequency, Recurring } from './schemas';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Cada semana',
  biweekly: 'Cada quincena',
  monthly: 'Cada mes',
  bimonthly: 'Cada 2 meses',
  yearly: 'Cada año',
};

/** Siguiente fecha según la frecuencia. Quincenal = 15 días (o 15/fin de mes si cae en esos días). */
export function nextOccurrence(date: ISODate, freq: Frequency): ISODate {
  switch (freq) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly': {
      const { day } = splitISO(date);
      if (day === 15) return addMonths(date, 0, 31); // fin de mes
      if (day >= 28) return addDays(addMonths(date, 1, 1), 14); // día 15 del siguiente mes
      return addDays(date, 15);
    }
    case 'monthly':
      return addMonths(date, 1);
    case 'bimonthly':
      return addMonths(date, 2);
    case 'yearly':
      return addMonths(date, 12);
  }
}

/** Todas las ocurrencias de un recurrente entre dos fechas. */
export function occurrencesBetween(r: Recurring, from: ISODate, to: ISODate, max = 400): ISODate[] {
  const out: ISODate[] = [];
  let d = r.nextDate;
  let guard = 0;
  while (d < from && guard++ < max) d = nextOccurrence(d, r.frequency);
  while (d <= to && guard++ < max) {
    out.push(d);
    d = nextOccurrence(d, r.frequency);
  }
  return out;
}

export interface UpcomingItem {
  id: string;
  type: 'recurring' | 'card' | 'installment' | 'tanda' | 'loan' | 'goal' | 'payday';
  title: string;
  emoji: string;
  date: ISODate;
  daysUntil: number;
  amountCents: number;
  direction: 'in' | 'out';
  refId?: string;
}

export function upcomingRecurring(recurrings: Recurring[], today: ISODate, days = 30): UpcomingItem[] {
  const to = addDays(today, days);
  return recurrings
    .filter((r) => r.active)
    .flatMap((r) =>
      occurrencesBetween(r, today, to).map<UpcomingItem>((date) => ({
        id: `rec_${r.id}_${date}`,
        type: 'recurring',
        title: r.name,
        emoji: r.isSubscription ? '📺' : r.template.kind === 'income' ? '💰' : '🔁',
        date,
        daysUntil: daysBetween(today, date),
        amountCents: r.template.amountCents,
        direction: r.template.kind === 'income' ? 'in' : 'out',
        refId: r.id,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Recurrentes que ya vencieron y deben registrarse (para el cron o al abrir la app). */
export function dueRecurring(recurrings: Recurring[], today: ISODate): Array<{ recurring: Recurring; dates: ISODate[] }> {
  return recurrings
    .filter((r) => r.active && r.autoCreate && r.nextDate <= today)
    .map((r) => {
      const dates: ISODate[] = [];
      let d = r.nextDate;
      let guard = 0;
      while (d <= today && guard++ < 60) {
        dates.push(d);
        d = nextOccurrence(d, r.frequency);
      }
      return { recurring: r, dates };
    });
}

/** Costo mensual equivalente (para sumar suscripciones). */
export function monthlyEquivalent(amountCents: number, freq: Frequency): number {
  switch (freq) {
    case 'weekly':
      return Math.round((amountCents * 52) / 12);
    case 'biweekly':
      return amountCents * 2;
    case 'monthly':
      return amountCents;
    case 'bimonthly':
      return Math.round(amountCents / 2);
    case 'yearly':
      return Math.round(amountCents / 12);
  }
}
