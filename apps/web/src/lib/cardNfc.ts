import { registerPlugin } from '@capacitor/core';
import { INSTITUTIONS, normalizeText, type Account } from '@fina/core';
import { isCapacitor } from './pwa';

/**
 * "Acerca tu tarjeta" (solo en la app de Android): lee por NFC la marca, los
 * últimos 4 dígitos y el vencimiento. El número completo nunca llega aquí.
 */
export type CardBrand = NonNullable<Account['card']>['brand'];

export interface ScannedCard {
  brand: CardBrand;
  last4: string;
  expiry?: string;
  label?: string;
  kind?: 'credit' | 'debit';
}

interface CardNfcPlugin {
  isAvailable(): Promise<{ available: boolean; enabled: boolean }>;
  scan(): Promise<ScannedCard>;
  cancel(): Promise<void>;
  openSettings(): Promise<void>;
}

const CardNfc = registerPlugin<CardNfcPlugin>('CardNfc');

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  carnet: 'Carnet',
  other: 'Tarjeta',
};

export async function nfcStatus(): Promise<{ available: boolean; enabled: boolean }> {
  if (!isCapacitor()) return { available: false, enabled: false };
  try {
    return await CardNfc.isAvailable();
  } catch {
    return { available: false, enabled: false };
  }
}

const BRANDS = new Set<CardBrand>(['visa', 'mastercard', 'amex', 'carnet', 'other']);

/** Lee una tarjeta. Valida lo que regresa el teléfono antes de usarlo. */
export async function scanCard(): Promise<ScannedCard> {
  const r = await CardNfc.scan();
  if (!/^\d{4}$/.test(r.last4 ?? '')) throw new Error('No pude leer la tarjeta.');
  return {
    brand: BRANDS.has(r.brand) ? r.brand : 'other',
    last4: r.last4,
    expiry: r.expiry && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.expiry) ? r.expiry : undefined,
    label: r.label?.slice(0, 40),
    kind: r.kind === 'credit' || r.kind === 'debit' ? r.kind : undefined,
  };
}

export function cancelScan(): Promise<void> {
  return CardNfc.cancel().catch(() => {});
}

export function openNfcSettings(): Promise<void> {
  return CardNfc.openSettings().catch(() => {});
}

/** Banco probable según la etiqueta que trae la tarjeta (p. ej. "BBVA DEBITO"). */
export function guessInstitution(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const words = ` ${normalizeText(label)} `;
  return INSTITUTIONS.find(
    (i) =>
      (i.kind === 'bank' || i.kind === 'fintech') &&
      i.aliases.some((a) => a.length >= 3 && words.includes(` ${a} `)),
  )?.id;
}
