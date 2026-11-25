import { daysBetween } from './dates';
import type { Transaction, TxSource } from './schemas';

/** Lo que anotó la persona (no lo que llegó solo del banco). */
const MANUAL_SOURCES = new Set<TxSource>(['app', 'whatsapp', 'voice', 'receipt', 'shortcut']);

/**
 * ¿El movimiento que llegó del banco (notificación o correo) ya lo habías
 * anotado a mano? Mismo tipo, mismo monto (±$1 por redondeo) y ±1 día.
 * Devuelve el más cercano en fecha que aún no esté emparejado.
 */
export function findManualDuplicate(
  incoming: Pick<Transaction, 'kind' | 'amountMxnCents' | 'date'>,
  existing: Transaction[],
): Transaction | null {
  const claimed = new Set(existing.map((t) => t.duplicateOf).filter(Boolean));
  let best: Transaction | null = null;
  let bestGap = Infinity;
  for (const t of existing) {
    if (t.kind !== incoming.kind || !MANUAL_SOURCES.has(t.source) || claimed.has(t.id)) continue;
    if (Math.abs(t.amountMxnCents - incoming.amountMxnCents) > 100) continue;
    const gap = Math.abs(daysBetween(t.date, incoming.date));
    if (gap > 1) continue;
    if (gap < bestGap) {
      best = t;
      bestGap = gap;
    }
  }
  return best;
}

/** Movimientos del banco esperando que confirmes si son el mismo que anotaste. */
export function pendingDuplicates(transactions: Transaction[]): Array<{ bank: Transaction; manual: Transaction }> {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const out: Array<{ bank: Transaction; manual: Transaction }> = [];
  for (const t of transactions) {
    if (!t.duplicateOf) continue;
    const manual = byId.get(t.duplicateOf);
    if (manual) out.push({ bank: t, manual });
  }
  return out;
}
