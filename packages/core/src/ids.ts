const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Id aleatorio de 20 caracteres (mismo formato que los ids automáticos de Firestore). */
export function newId(length = 20): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

/** Código numérico (p. ej. vinculación de WhatsApp). */
export function numericCode(digits = 6): string {
  const bytes = new Uint32Array(digits);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join('');
}

/** Código corto legible (sin 0/O/1/I) para invitaciones. */
export function inviteCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function nowISO(now: Date = new Date()): string {
  return now.toISOString();
}

/** Hash FNV-1a de 32 bits en hex: rápido y suficiente para deduplicar. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Normaliza texto para comparar: minúsculas, sin acentos, sin signos, espacios simples. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9#$.,+\-/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SHA-256 en hex (WebCrypto; funciona en navegador, Worker y Node 20+). */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
