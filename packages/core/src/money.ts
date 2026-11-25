/**
 * Dinero SIEMPRE en centavos enteros. Nunca usar floats para guardar montos.
 */

export type Cents = number;

export function assertCents(value: number): Cents {
  if (!Number.isInteger(value)) throw new Error(`Monto inválido (no es entero de centavos): ${value}`);
  return value;
}

/** Convierte pesos (puede tener decimales) a centavos redondeando correctamente. */
export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, decimals: number, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${decimals}|${compact}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'MXN' ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
      notation: compact ? 'compact' : 'standard',
    });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatMoneyOptions {
  currency?: string;
  /** 'auto' oculta los centavos si el monto es entero. */
  decimals?: 'auto' | 0 | 2;
  /** Muestra + para positivos. */
  signed?: boolean;
  compact?: boolean;
}

/** formatMoney(3000) → "$30" ; formatMoney(4550) → "$45.50" */
export function formatMoney(cents: Cents, opts: FormatMoneyOptions = {}): string {
  const currency = opts.currency ?? 'MXN';
  const decimalsOpt = opts.decimals ?? 'auto';
  const decimals = decimalsOpt === 'auto' ? (cents % 100 === 0 ? 0 : 2) : decimalsOpt;
  const abs = Math.abs(cents) / 100;
  let text = getFormatter(currency, decimals, opts.compact ?? false).format(abs);
  if (currency !== 'MXN' && !text.includes(currency) && text.startsWith('$')) text = `${currency} ${text}`;
  if (cents < 0) return `−${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/** Divide un monto en n partes que suman exactamente el total (método del residuo mayor). */
export function splitCents(total: Cents, parts: number): Cents[] {
  if (parts <= 0 || !Number.isInteger(parts)) throw new Error('parts debe ser entero positivo');
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Reparte un total según pesos (p. ej. ingresos de cada miembro de la pareja). */
export function allocateCents(total: Cents, weights: number[]): Cents[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return splitCents(total, weights.length);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest--;
  }
  return floors;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Porcentaje entero seguro (0 si el total es 0). */
export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
