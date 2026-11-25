import { ANT_CATEGORIES } from './categories';
import { addDays, daysBetween, type ISODate } from './dates';
import { normalizeText } from './ids';
import { isSpending, spendingAmount } from './balances';
import type { Frequency, Recurring, Transaction } from './schemas';

// ——————————————————— Detector de suscripciones (estilo Rocket Money) ———————————————————

export interface DetectedSubscription {
  key: string;
  name: string;
  amountCents: number;
  frequency: Frequency;
  lastDate: ISODate;
  nextDate: ISODate;
  occurrences: number;
  categoryId: string | null;
  accountId: string | null;
}

function txKey(tx: Transaction): string {
  const base = tx.merchant ?? tx.description;
  return normalizeText(base)
    .replace(/[0-9#$.,+\-/]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(' ');
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function classifyInterval(days: number): Frequency | null {
  if (days >= 6 && days <= 8) return 'weekly';
  if (days >= 13 && days <= 16) return 'biweekly';
  if (days >= 27 && days <= 33) return 'monthly';
  if (days >= 56 && days <= 66) return 'bimonthly';
  if (days >= 350 && days <= 380) return 'yearly';
  return null;
}

/**
 * Detecta cargos que se repiten: mismo comercio, monto parecido (±10 %) y
 * periodicidad regular. Ignora los que ya están registrados como recurrentes.
 */
export function detectSubscriptions(transactions: Transaction[], existing: Recurring[] = [], today?: ISODate): DetectedSubscription[] {
  const known = new Set(existing.map((r) => normalizeText(r.template.merchant ?? r.template.description ?? r.name)));
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || tx.recurringId) continue;
    const k = txKey(tx);
    if (!k) continue;
    const arr = groups.get(k) ?? [];
    arr.push(tx);
    groups.set(k, arr);
  }
  const out: DetectedSubscription[] = [];
  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;
    if ([...known].some((k) => k && (k.includes(key) || key.includes(k)))) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((t) => t.amountMxnCents);
    const med = median(amounts);
    if (!amounts.every((a) => Math.abs(a - med) <= med * 0.1)) continue;
    const intervals = sorted.slice(1).map((t, i) => daysBetween(sorted[i]!.date, t.date));
    const freq = classifyInterval(median(intervals));
    if (!freq) continue;
    if (!intervals.every((d) => classifyInterval(d) === freq)) continue;
    // Con 2 cargos solo aceptamos mensual/anual (lo típico de suscripciones).
    if (sorted.length === 2 && freq !== 'monthly' && freq !== 'yearly') continue;
    const last = sorted[sorted.length - 1]!;
    const step = freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : freq === 'monthly' ? 30 : freq === 'bimonthly' ? 61 : 365;
    const nextDate = addDays(last.date, step);
    if (today && daysBetween(nextDate, today) > step) continue; // ya no está activa
    out.push({
      key,
      name: last.merchant ?? last.description,
      amountCents: Math.round(med),
      frequency: freq,
      lastDate: last.date,
      nextDate,
      occurrences: sorted.length,
      categoryId: last.categoryId,
      accountId: last.accountId,
    });
  }
  return out.sort((a, b) => b.amountCents - a.amountCents);
}

// ——————————————————— Gastos hormiga ———————————————————

export const ANT_THRESHOLD_CENTS = 10_000; // < $100

export interface AntExpenses {
  totalCents: number;
  count: number;
  byCategory: Record<string, number>;
  /** "= 37 cafés ☕" */
  equivalence: { qty: number; label: string; emoji: string };
  topItems: Array<{ name: string; count: number; totalCents: number }>;
}

const EQUIVALENCES = [
  { priceCents: 5_500, label: 'cafés', emoji: '☕' },
  { priceCents: 9_000, label: 'órdenes de tacos', emoji: '🌮' },
  { priceCents: 8_500, label: 'boletos de cine', emoji: '🎬' },
  { priceCents: 2_450, label: 'litros de gasolina', emoji: '⛽' },
  { priceCents: 21_900, label: 'meses de Netflix', emoji: '📺' },
];

/** Gastos pequeños y frecuentes (< $100) en antojos, café, tiendita, etc. */
export function antExpenses(transactions: Transaction[], from: ISODate, to: ISODate): AntExpenses {
  const items = transactions.filter(
    (t) =>
      isSpending(t) &&
      t.date >= from &&
      t.date <= to &&
      spendingAmount(t) < ANT_THRESHOLD_CENTS &&
      (ANT_CATEGORIES.has(t.categoryId ?? '') || t.categoryId === 'food' || t.categoryId === 'transport'),
  );
  const byCategory: Record<string, number> = {};
  const byName = new Map<string, { count: number; totalCents: number }>();
  let total = 0;
  for (const t of items) {
    const amt = spendingAmount(t);
    total += amt;
    const cat = t.categoryId ?? 'other';
    byCategory[cat] = (byCategory[cat] ?? 0) + amt;
    const name = (t.merchant ?? t.description).toLowerCase();
    const e = byName.get(name) ?? { count: 0, totalCents: 0 };
    e.count++;
    e.totalCents += amt;
    byName.set(name, e);
  }
  // Elegimos la equivalencia que dé un número "bonito" entre 3 y 99.
  const eq =
    EQUIVALENCES.map((e) => ({ qty: Math.floor(total / e.priceCents), label: e.label, emoji: e.emoji })).find(
      (e) => e.qty >= 3 && e.qty <= 99,
    ) ?? { qty: Math.floor(total / 5_500), label: 'cafés', emoji: '☕' };
  return {
    totalCents: total,
    count: items.length,
    byCategory,
    equivalence: eq,
    topItems: [...byName.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 5),
  };
}

// ——————————————————— Rachas ———————————————————

/** Días seguidos (hasta hoy) sin gastos hormiga. */
export function daysWithoutAntExpenses(transactions: Transaction[], today: ISODate): number {
  const antDates = new Set(
    transactions
      .filter((t) => isSpending(t) && spendingAmount(t) < ANT_THRESHOLD_CENTS && ANT_CATEGORIES.has(t.categoryId ?? ''))
      .map((t) => t.date),
  );
  let streak = 0;
  let d = today;
  while (!antDates.has(d) && streak < 365) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

/** Días seguidos registrando al menos un movimiento (hábito). */
export function loggingStreak(transactions: Transaction[], today: ISODate): number {
  const days = new Set(transactions.map((t) => t.createdAt.slice(0, 10)));
  let streak = 0;
  let d = today;
  if (!days.has(d)) d = addDays(d, -1); // hoy aún puede anotar
  while (days.has(d) && streak < 3650) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}
