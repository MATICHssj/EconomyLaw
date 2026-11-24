import { normalizeText, toCents, type ISODate } from '@fina/core';
import { findMerchant, guessCategory } from '@fina/parser';

/**
 * Lectura de correos y notificaciones de bancos ("Compra aprobada por $245.00
 * en OXXO…"). Plantillas por banco + un patrón genérico de respaldo. Si nada
 * coincide, el Worker usa el LLM de respaldo.
 */

export interface BankNotice {
  bankId: string;
  kind: 'expense' | 'income' | 'transfer_out' | 'transfer_in';
  amountCents: number;
  currency: string;
  merchant: string;
  description: string;
  last4?: string;
  date?: ISODate;
  categoryId?: string;
  confidence: number;
}

interface Template {
  bankId: string;
  /** Remitentes típicos (dominio). */
  senders: RegExp;
  patterns: Array<{ re: RegExp; kind: BankNotice['kind'] }>;
}

const AMT = String.raw`\$\s?([\d,]+(?:\.\d{1,2})?)`;
const MERCH = String.raw`([A-Z0-9ÁÉÍÓÚÑ][\w ÁÉÍÓÚÑáéíóúñ&*.'\-/]{1,50}?)`;
const END = String.raw`(?=\s+(?:con|el|a las|por|usando|desde|tarjeta|terminaci[oó]n)\b|[.,\n]|$)`;

export const EMAIL_TEMPLATES: Template[] = [
  {
    bankId: 'bbva',
    senders: /bbva|bancomer/i,
    patterns: [
      { re: new RegExp(String.raw`(?:compra|cargo|pago)[^$]{0,60}?(?:aprobad[oa]|autorizad[oa]|realizad[oa])?[^$]{0,40}?${AMT}[^\n]{0,20}?\ben\s+${MERCH}${END}`, 'i'), kind: 'expense' },
      { re: new RegExp(String.raw`(?:recibiste|dep[oó]sito|te depositaron)[^$]{0,40}${AMT}`, 'i'), kind: 'income' },
    ],
  },
  {
    bankId: 'nu',
    senders: /nu\.com\.mx|nubank|@nu\./i,
    patterns: [
      { re: new RegExp(String.raw`compraste\s+${AMT}\s+en\s+${MERCH}${END}`, 'i'), kind: 'expense' },
      { re: new RegExp(String.raw`(?:tu\s+)?compra\s+en\s+${MERCH}\s+por\s+${AMT}`, 'i'), kind: 'expense' },
      { re: new RegExp(String.raw`(?:recibiste|te llegaron)\s+${AMT}`, 'i'), kind: 'income' },
    ],
  },
  {
    bankId: 'mercadopago',
    senders: /mercadopago|mercadolibre/i,
    patterns: [
      { re: new RegExp(String.raw`(?:pagaste|tu pago de)\s+${AMT}\s+(?:a|en)\s+${MERCH}${END}`, 'i'), kind: 'expense' },
      { re: new RegExp(String.raw`recibiste\s+(?:un pago de\s+)?${AMT}`, 'i'), kind: 'income' },
      { re: new RegExp(String.raw`transferiste\s+${AMT}`, 'i'), kind: 'transfer_out' },
    ],
  },
  {
    bankId: 'santander',
    senders: /santander/i,
    patterns: [{ re: new RegExp(String.raw`(?:compra|cargo)[^$]{0,80}?${AMT}[^\n]{0,40}?\b(?:en|comercio:?)\s+${MERCH}${END}`, 'i'), kind: 'expense' }],
  },
  {
    bankId: 'banorte',
    senders: /banorte/i,
    patterns: [{ re: new RegExp(String.raw`(?:compra|cargo|consumo)[^$]{0,80}?${AMT}[^\n]{0,40}?\b(?:en|comercio:?)\s+${MERCH}${END}`, 'i'), kind: 'expense' }],
  },
  {
    bankId: 'banamex',
    senders: /banamex|citi/i,
    patterns: [{ re: new RegExp(String.raw`(?:compra|cargo|consumo)[^$]{0,80}?${AMT}[^\n]{0,40}?\b(?:en|comercio:?)\s+${MERCH}${END}`, 'i'), kind: 'expense' }],
  },
  {
    bankId: 'hsbc',
    senders: /hsbc/i,
    patterns: [{ re: new RegExp(String.raw`(?:compra|cargo)[^$]{0,80}?${AMT}[^\n]{0,40}?\ben\s+${MERCH}${END}`, 'i'), kind: 'expense' }],
  },
];

/** Patrón genérico: "… $245.00 … en COMERCIO" (cualquier banco). */
const GENERIC: Array<{ re: RegExp; kind: BankNotice['kind'] }> = [
  { re: new RegExp(String.raw`(?:compra|cargo|consumo|pagaste|compraste)[^$]{0,80}?${AMT}[^\n]{0,30}?\b(?:en|a)\s+${MERCH}${END}`, 'i'), kind: 'expense' },
  { re: new RegExp(String.raw`(?:compraste|pagaste)\s+${AMT}`, 'i'), kind: 'expense' },
  { re: new RegExp(String.raw`(?:recibiste|te depositaron|dep[oó]sito recibido|abono)[^$]{0,40}${AMT}`, 'i'), kind: 'income' },
  { re: new RegExp(String.raw`(?:transferencia|spei)[^$]{0,40}(?:enviada|realizada)[^$]{0,40}${AMT}`, 'i'), kind: 'transfer_out' },
  { re: new RegExp(String.raw`(?:transferencia|spei)[^$]{0,40}recibida[^$]{0,40}${AMT}`, 'i'), kind: 'transfer_in' },
];

function detectBank(from: string, text: string): string {
  for (const t of EMAIL_TEMPLATES) if (t.senders.test(from)) return t.bankId;
  const n = normalizeText(text.slice(0, 400));
  for (const t of EMAIL_TEMPLATES) if (t.senders.test(n)) return t.bankId;
  return 'unknown';
}

/** Quita HTML de un correo y deja texto plano legible. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#36;/g, '$')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function cleanMerchant(m: string): string {
  return m
    .replace(/\s+/g, ' ')
    .replace(/\b(s\.?a\.?(\s+de\s+c\.?v\.?)?|sapi|suc\.?\s*\d*)\b.*$/i, '')
    .trim()
    .slice(0, 50);
}

/**
 * Interpreta un correo (o una notificación del celular) de un banco.
 * Devuelve null si no parece una compra / ingreso.
 */
export function parseBankNotice(input: { from?: string; subject?: string; text: string }): BankNotice | null {
  const text = `${input.subject ?? ''}\n${input.text}`.replace(/ /g, ' ');
  const bankId = detectBank(input.from ?? '', text);
  const template = EMAIL_TEMPLATES.find((t) => t.bankId === bankId);
  const candidates = [...(template?.patterns ?? []), ...GENERIC];
  for (const { re, kind } of candidates) {
    const m = text.match(re);
    if (!m) continue;
    // El orden de grupos varía: identificamos cuál es monto y cuál comercio.
    const groups = m.slice(1).filter(Boolean);
    const amountStr = groups.find((g) => /^[\d,]+(\.\d{1,2})?$/.test(g));
    if (!amountStr) continue;
    const amountCents = toCents(Number(amountStr.replace(/,/g, '')));
    if (!amountCents) continue;
    const merchantRaw = groups.find((g) => g !== amountStr) ?? '';
    const merchantKnown = findMerchant(merchantRaw || text);
    const merchant = merchantKnown?.name ?? (cleanMerchant(merchantRaw) || (kind === 'income' ? 'Depósito' : 'Compra'));
    const last4 = text.match(/terminaci[oó]n\s*(?:en\s*)?[*x•]*\s*(\d{4})|\*{2,}\s*(\d{4})/i);
    const dateM = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    const date = dateM ? `${Number(dateM[3]) < 100 ? 2000 + Number(dateM[3]) : dateM[3]}-${dateM[2]!.padStart(2, '0')}-${dateM[1]!.padStart(2, '0')}` : undefined;
    const category = kind === 'expense' ? (merchantKnown?.categoryId ?? guessCategory(merchant)?.categoryId) : undefined;
    return {
      bankId,
      kind,
      amountCents,
      currency: /usd|d[oó]lares/i.test(text.slice(0, 300)) ? 'USD' : 'MXN',
      merchant,
      description: merchant,
      last4: last4?.[1] ?? last4?.[2],
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      categoryId: category,
      confidence: template ? 0.9 : 0.7,
    };
  }
  return null;
}
