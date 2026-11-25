/**
 * Fechas como texto 'YYYY-MM-DD' (fecha local del usuario, sin horas) para evitar
 * errores de zona horaria. Toda la aritmética se hace en UTC.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type MonthKey = string; // 'YYYY-MM'

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local (del dispositivo o de la zona indicada) en formato ISO corto. */
export function toISODate(d: Date, timeZone?: string): ISODate {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return parts; // en-CA => YYYY-MM-DD
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date(), timeZone?: string): ISODate {
  return toISODate(now, timeZone);
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function formatISO(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function makeISODate(year: number, month1: number, day: number): ISODate {
  const dim = daysInMonth(year, month1);
  return `${year}-${pad(month1)}-${pad(Math.min(Math.max(day, 1), dim))}`;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatISO(d);
}

/** Suma meses respetando el fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: ISODate, months: number, preferredDay?: number): ISODate {
  const { year, month, day } = splitISO(iso);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return makeISODate(y, m, preferredDay ?? day);
}

export function splitISO(iso: ISODate): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

export function monthKey(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function monthStart(key: MonthKey): ISODate {
  return `${key}-01`;
}

export function monthEnd(key: MonthKey): ISODate {
  const [y, m] = key.split('-').map(Number);
  return makeISODate(y ?? 1970, m ?? 1, 31);
}

export function addMonthsKey(key: MonthKey, n: number): MonthKey {
  return monthKey(addMonths(monthStart(key), n));
}

export function monthsBetweenKeys(a: MonthKey, b: MonthKey): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return ((yb ?? 0) - (ya ?? 0)) * 12 + ((mb ?? 0) - (ma ?? 0));
}

/** 0 = domingo … 6 = sábado */
export function weekday(iso: ISODate): number {
  return parseISODate(iso).getUTCDay();
}

export function startOfWeek(iso: ISODate, weekStartsOn = 1): ISODate {
  const wd = weekday(iso);
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(iso, -diff);
}

export function isBetween(iso: ISODate, from: ISODate, to: ISODate): boolean {
  return iso >= from && iso <= to;
}

export const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export const MONTHS_ES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

/** "15 de noviembre" */
export function formatLongDate(iso: ISODate, withYear = false): string {
  const { year, month, day } = splitISO(iso);
  return `${day} de ${MONTHS_ES[month - 1]}${withYear ? ` de ${year}` : ''}`;
}

/** "15 nov" */
export function formatShortDate(iso: ISODate): string {
  const { month, day } = splitISO(iso);
  return `${day} ${MONTHS_ES_SHORT[month - 1]}`;
}

export function formatMonthKey(key: MonthKey, withYear = true): string {
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS_ES[(m ?? 1) - 1] ?? '';
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return withYear ? `${cap} ${y}` : cap;
}

/** "Hoy", "Ayer", "Lunes 3 nov" … */
export function formatRelativeDay(iso: ISODate, today: ISODate): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff === -1) return 'Mañana';
  const wd = WEEKDAYS_ES[weekday(iso)] ?? '';
  const label = `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${formatShortDate(iso)}`;
  const { year } = splitISO(iso);
  return year !== splitISO(today).year ? `${label} ${year}` : label;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'irregular';

export interface PaydaySchedule {
  type: PayFrequency;
  /** biweekly: [15, 30] (30 = último día del mes); monthly: [día]; weekly: [día de la semana 0..6] */
  days: number[];
}

/** Próximo día de pago (>= hoy). Para quincenas, el "30" significa fin de mes. */
export function nextPayday(today: ISODate, schedule: PaydaySchedule): ISODate | null {
  if (schedule.type === 'irregular' || schedule.days.length === 0) return null;
  if (schedule.type === 'weekly') {
    const target = schedule.days[0] ?? 5;
    const diff = (target - weekday(today) + 7) % 7;
    return addDays(today, diff);
  }
  const { year, month } = splitISO(today);
  const candidates: ISODate[] = [];
  for (let i = 0; i < 3; i++) {
    const total = year * 12 + (month - 1) + i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    for (const d of schedule.days) {
      const day = d >= 28 ? daysInMonth(y, m) : d;
      candidates.push(makeISODate(y, m, day));
    }
  }
  candidates.sort();
  return candidates.find((c) => c >= today) ?? null;
}

/** Día de pago anterior (< hoy) — inicio del "periodo" actual. */
export function previousPayday(today: ISODate, schedule: PaydaySchedule): ISODate | null {
  if (schedule.type === 'irregular' || schedule.days.length === 0) return null;
  if (schedule.type === 'weekly') {
    const target = schedule.days[0] ?? 5;
    const diff = (weekday(today) - target + 7) % 7 || 7;
    return addDays(today, -diff);
  }
  const { year, month } = splitISO(today);
  const candidates: ISODate[] = [];
  for (let i = -2; i <= 0; i++) {
    const total = year * 12 + (month - 1) + i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    for (const d of schedule.days) {
      const day = d >= 28 ? daysInMonth(y, m) : d;
      candidates.push(makeISODate(y, m, day));
    }
  }
  candidates.sort();
  return [...candidates].reverse().find((c) => c < today) ?? null;
}
