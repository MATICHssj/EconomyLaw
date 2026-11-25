import { fnv1a, makeISODate, normalizeText, parseCsv, toCents, type AccountType, type ISODate } from '@fina/core';

/**
 * Importación de estados de cuenta (CSV, Excel, OFX). Cada banco exporta con
 * columnas distintas: los perfiles reconocen el formato y, si no, el asistente
 * de mapeo deja elegir las columnas (y se guarda para la próxima).
 */

export interface BankProfile {
  id: string;
  name: string;
  institutionId: string;
  /** Palabras (normalizadas) que suelen aparecer en el encabezado o en el nombre del archivo. */
  hints: string[];
  defaultAccountType: AccountType;
  /** Si solo hay una columna de monto: ¿negativo es gasto o positivo es gasto? */
  amountSign: 'negative_is_expense' | 'positive_is_expense';
  dateOrder: 'dmy' | 'ymd' | 'mdy';
}

export const BANK_PROFILES: BankProfile[] = [
  { id: 'bbva', name: 'BBVA', institutionId: 'bbva', hints: ['bbva', 'bancomer'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'banorte', name: 'Banorte', institutionId: 'banorte', hints: ['banorte'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'santander', name: 'Santander', institutionId: 'santander', hints: ['santander'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'banamex', name: 'Banamex', institutionId: 'banamex', hints: ['banamex', 'citibanamex'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'hsbc', name: 'HSBC', institutionId: 'hsbc', hints: ['hsbc'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'scotiabank', name: 'Scotiabank', institutionId: 'scotiabank', hints: ['scotia', 'scotiabank'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'nu', name: 'Nu', institutionId: 'nu', hints: ['nu', 'nubank', 'nu mexico'], defaultAccountType: 'credit', amountSign: 'positive_is_expense', dateOrder: 'dmy' },
  { id: 'mercadopago', name: 'Mercado Pago', institutionId: 'mercadopago', hints: ['mercado pago', 'mercadopago', 'release_date', 'net_credit_amount', 'transaction_net_amount'], defaultAccountType: 'wallet', amountSign: 'negative_is_expense', dateOrder: 'ymd' },
  { id: 'hey', name: 'Hey Banco', institutionId: 'hey', hints: ['hey banco', 'heybanco'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'azteca', name: 'Banco Azteca', institutionId: 'azteca', hints: ['azteca'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'spin', name: 'Spin by OXXO', institutionId: 'spin', hints: ['spin'], defaultAccountType: 'wallet', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'klar', name: 'Klar', institutionId: 'klar', hints: ['klar'], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
  { id: 'stori', name: 'Stori', institutionId: 'stori', hints: ['stori'], defaultAccountType: 'credit', amountSign: 'positive_is_expense', dateOrder: 'dmy' },
  { id: 'generic', name: 'Otro banco (genérico)', institutionId: '', hints: [], defaultAccountType: 'debit', amountSign: 'negative_is_expense', dateOrder: 'dmy' },
];

const HEADER_ALIASES = {
  date: ['fecha', 'fecha operacion', 'fecha de operacion', 'fecha movimiento', 'fecha de movimiento', 'fecha aplicacion', 'fecha de aplicacion', 'fecha valor', 'dia', 'date', 'release_date', 'fecha de compra', 'fecha transaccion', 'fecha de la transaccion', 'fecha cargo'],
  description: ['descripcion', 'concepto', 'detalle', 'descripcion del movimiento', 'movimiento', 'comercio', 'establecimiento', 'description', 'transaction_type', 'detalle del movimiento', 'concepto / referencia', 'nombre', 'name', 'memo'],
  debit: ['cargo', 'cargos', 'retiro', 'retiros', 'debito', 'debitos', 'egreso', 'egresos', 'monto cargo', 'net_debit_amount', 'debit', 'salida', 'salidas'],
  credit: ['abono', 'abonos', 'deposito', 'depositos', 'credito', 'creditos', 'ingreso', 'ingresos', 'monto abono', 'net_credit_amount', 'credit', 'entrada', 'entradas'],
  amount: ['monto', 'importe', 'cantidad', 'amount', 'valor', 'transaction_net_amount', 'monto total', 'importe mxn', 'monto mxn'],
  balance: ['saldo', 'saldo final', 'balance', 'partial_balance', 'saldo disponible'],
} as const;

export type ColumnRole = keyof typeof HEADER_ALIASES;

export interface ColumnMapping {
  headerRow: number;
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  balance?: number;
}

function roleOf(cell: string): ColumnRole | null {
  const n = normalizeText(cell).replace(/[^a-z_ /]/g, '').trim();
  if (!n) return null;
  for (const [role, aliases] of Object.entries(HEADER_ALIASES) as Array<[ColumnRole, readonly string[]]>) {
    if (aliases.includes(n)) return role;
  }
  for (const [role, aliases] of Object.entries(HEADER_ALIASES) as Array<[ColumnRole, readonly string[]]>) {
    if (aliases.some((a) => a.length > 3 && (n.startsWith(a) || n.endsWith(a)))) return role;
  }
  return null;
}

/** Busca la fila de encabezados y adivina qué columna es qué. */
export function detectColumns(rows: string[][]): ColumnMapping | null {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r]!;
    const m: Partial<ColumnMapping> = { headerRow: r };
    row.forEach((cell, i) => {
      const role = roleOf(cell);
      if (role && (m as Record<string, number | undefined>)[role] === undefined) (m as Record<string, number>)[role] = i;
    });
    const hasMoney = m.amount !== undefined || m.debit !== undefined || m.credit !== undefined;
    if (m.date !== undefined && hasMoney) {
      if (m.description === undefined) {
        // Elige la columna de texto más larga como descripción.
        const sample = rows.slice(r + 1, r + 6);
        let best = -1;
        let bestLen = 0;
        row.forEach((_, i) => {
          if ([m.date, m.amount, m.debit, m.credit, m.balance].includes(i)) return;
          const len = sample.reduce((s, x) => s + (x[i]?.length ?? 0), 0);
          if (len > bestLen) {
            bestLen = len;
            best = i;
          }
        });
        if (best < 0) continue;
        m.description = best;
      }
      return m as ColumnMapping;
    }
  }
  return null;
}

export function detectProfile(fileName: string, rows: string[][]): BankProfile {
  const hay = normalizeText(`${fileName} ${rows.slice(0, 12).map((r) => r.join(' ')).join(' ')}`).replace(/[_.-]/g, ' ');
  const words = ` ${hay} `;
  for (const p of BANK_PROFILES) {
    if (p.hints.some((h) => (h.length <= 3 ? words.includes(` ${h} `) : words.includes(h)))) return p;
  }
  return BANK_PROFILES[BANK_PROFILES.length - 1]!;
}

const MONTHS: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

/** Lee fechas en los formatos de los bancos mexicanos. */
export function parseBankDate(value: string, order: 'dmy' | 'ymd' | 'mdy' = 'dmy'): ISODate | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return makeISODate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})[-/. ]([a-z]{3})[a-z]*\.?[-/. ](\d{2,4})/);
  if (m && MONTHS[m[2]!]) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return makeISODate(y, MONTHS[m[2]!]!, Number(m[1]));
  }
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (order === 'mdy' || (a <= 12 && b > 12)) [a, b] = [b, a];
    if (b < 1 || b > 12 || a < 1 || a > 31) return null;
    return makeISODate(y, b, a);
  }
  // Número de serie de Excel
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** "$1,234.56", "-1,234.56", "(1,234.56)", "1234.56 MXN" → centavos con signo. */
export function parseBankAmount(value: string): number | null {
  let v = value.trim();
  if (!v) return null;
  let neg = false;
  if (/^\(.*\)$/.test(v)) {
    neg = true;
    v = v.slice(1, -1);
  }
  v = v.replace(/mxn|usd|\$|\s/gi, '');
  if (v.startsWith('-') || v.startsWith('−')) {
    neg = !neg;
    v = v.slice(1);
  }
  if (v.endsWith('-')) {
    neg = !neg;
    v = v.slice(0, -1);
  }
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(v)) return null;
  const cents = toCents(Number(v));
  return neg ? -cents : cents;
}

export interface ImportedRow {
  date: ISODate;
  description: string;
  /** Siempre positivo. */
  amountCents: number;
  direction: 'out' | 'in';
  balanceCents?: number;
  hash: string;
  /** Identificador único del banco si existe (OFX FITID). */
  externalId?: string;
}

export function rowHash(date: string, amountCents: number, description: string, direction: string): string {
  return fnv1a(`${date}|${direction}|${amountCents}|${normalizeText(description).replace(/[^a-z0-9]/g, '')}`);
}

export function rowsToImported(rows: string[][], map: ColumnMapping, opts: { amountSign: BankProfile['amountSign']; dateOrder: BankProfile['dateOrder']; invert?: boolean }): ImportedRow[] {
  const out: ImportedRow[] = [];
  for (const row of rows.slice(map.headerRow + 1)) {
    const date = parseBankDate(row[map.date] ?? '', opts.dateOrder);
    if (!date) continue;
    const description = (row[map.description] ?? '').replace(/\s+/g, ' ').trim();
    let signed: number | null = null;
    if (map.debit !== undefined || map.credit !== undefined) {
      const debit = map.debit !== undefined ? parseBankAmount(row[map.debit] ?? '') : null;
      const credit = map.credit !== undefined ? parseBankAmount(row[map.credit] ?? '') : null;
      if (debit) signed = -Math.abs(debit);
      else if (credit) signed = Math.abs(credit);
    }
    if (signed === null && map.amount !== undefined) {
      const a = parseBankAmount(row[map.amount] ?? '');
      if (a !== null) signed = opts.amountSign === 'negative_is_expense' ? a : -a;
    }
    if (!signed) continue;
    if (opts.invert) signed = -signed;
    const direction = signed < 0 ? 'out' : 'in';
    const amountCents = Math.abs(signed);
    const balance = map.balance !== undefined ? parseBankAmount(row[map.balance] ?? '') : null;
    out.push({ date, description: description || 'Movimiento', amountCents, direction, balanceCents: balance ?? undefined, hash: rowHash(date, amountCents, description, direction) });
  }
  return out;
}

/** OFX / QFX (Money, Quicken, algunos bancos): lee los bloques <STMTTRN>. */
export function parseOfx(text: string): ImportedRow[] {
  const out: ImportedRow[] = [];
  const get = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]!;
    const dt = get(b, 'DTPOSTED');
    const amt = parseBankAmount(get(b, 'TRNAMT'));
    if (!dt || amt === null || amt === 0) continue;
    const date = makeISODate(Number(dt.slice(0, 4)), Number(dt.slice(4, 6)), Number(dt.slice(6, 8)));
    const description = [get(b, 'NAME'), get(b, 'MEMO')].filter(Boolean).join(' · ') || 'Movimiento';
    const direction = amt < 0 ? 'out' : 'in';
    out.push({ date, description, amountCents: Math.abs(amt), direction, hash: rowHash(date, Math.abs(amt), description, direction), externalId: get(b, 'FITID') || undefined });
  }
  return out;
}

export interface ParsedStatement {
  profile: BankProfile;
  mapping: ColumnMapping | null;
  rows: string[][];
  imported: ImportedRow[];
  format: 'csv' | 'xlsx' | 'ofx';
}

/** Punto de entrada: texto (CSV/OFX) o filas (Excel ya leído). */
export function parseStatement(input: { fileName: string; text?: string; rows?: string[][] }, override?: { profileId?: string; mapping?: ColumnMapping; invert?: boolean }): ParsedStatement {
  const lower = input.fileName.toLowerCase();
  if (input.text && (lower.endsWith('.ofx') || lower.endsWith('.qfx') || /<OFX>/i.test(input.text))) {
    const profile = detectProfile(input.fileName, [[input.text.slice(0, 2000)]]);
    let imported = parseOfx(input.text);
    if (override?.invert) imported = imported.map((r) => ({ ...r, direction: r.direction === 'in' ? 'out' : 'in' }));
    return { profile: override?.profileId ? BANK_PROFILES.find((p) => p.id === override.profileId) ?? profile : profile, mapping: null, rows: [], imported, format: 'ofx' };
  }
  const rows = input.rows ?? parseCsv(input.text ?? '');
  const detected = detectProfile(input.fileName, rows);
  const profile = override?.profileId ? (BANK_PROFILES.find((p) => p.id === override.profileId) ?? detected) : detected;
  const mapping = override?.mapping ?? detectColumns(rows);
  const imported = mapping ? rowsToImported(rows, mapping, { amountSign: profile.amountSign, dateOrder: guessDateOrder(rows, mapping) ?? profile.dateOrder, invert: override?.invert }) : [];
  return { profile, mapping, rows, imported, format: input.rows ? 'xlsx' : 'csv' };
}

/** Si alguna fecha tiene el segundo número > 12, el formato es mes/día. */
function guessDateOrder(rows: string[][], map: ColumnMapping): BankProfile['dateOrder'] | null {
  for (const r of rows.slice(map.headerRow + 1, map.headerRow + 60)) {
    const m = (r[map.date] ?? '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
  }
  return null;
}

// ——————————————————— Deduplicación ———————————————————

export interface ExistingTx {
  id: string;
  date: ISODate;
  amountMxnCents: number;
  kind: string;
  description: string;
  dedupeHash?: string;
  source?: string;
}

export type ImportStatus = 'new' | 'duplicate' | 'probable';

/**
 * Marca cada fila: duplicada (ya se importó), probable (ya la capturaste a mano:
 * mismo monto ±3 días) o nueva.
 */
export function dedupe(rows: ImportedRow[], existing: ExistingTx[]): Array<ImportedRow & { status: ImportStatus; matchId?: string }> {
  const hashes = new Set(existing.map((t) => t.dedupeHash).filter(Boolean));
  const used = new Set<string>();
  const seenInFile = new Map<string, number>();
  return rows.map((r) => {
    // Dos movimientos idénticos en el mismo archivo son válidos: les damos sufijo.
    const n = (seenInFile.get(r.hash) ?? 0) + 1;
    seenInFile.set(r.hash, n);
    const hash = n > 1 ? `${r.hash}-${n}` : r.hash;
    if (hashes.has(hash)) return { ...r, hash, status: 'duplicate' as const };
    const isOut = r.direction === 'out';
    const match = existing.find(
      (t) =>
        !used.has(t.id) &&
        t.source !== 'import' &&
        t.amountMxnCents === r.amountCents &&
        Math.abs((Date.parse(t.date) - Date.parse(r.date)) / 86_400_000) <= 3 &&
        (isOut ? t.kind !== 'income' : t.kind === 'income' || t.kind === 'loan_collected' || t.kind === 'loan_received'),
    );
    if (match) {
      used.add(match.id);
      return { ...r, hash, status: 'probable' as const, matchId: match.id };
    }
    return { ...r, hash, status: 'new' as const };
  });
}
