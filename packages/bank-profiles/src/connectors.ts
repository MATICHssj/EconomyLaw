import type { ImportedRow } from './statements';

/**
 * Conectores bancarios. Hoy la app usa vías GRATUITAS (importar archivo,
 * reenviar correos, notificaciones del celular). Un agregador de "open finance"
 * (p. ej. Belvo) es de pago: queda listo detrás de esta interfaz, APAGADO.
 */
export interface BankAccountInfo {
  externalId: string;
  name: string;
  institution: string;
  type: 'checking' | 'credit' | 'savings' | 'other';
  balanceCents?: number;
}

export interface BankConnector {
  readonly id: string;
  readonly name: string;
  readonly paid: boolean;
  isEnabled(): boolean;
  /** Inicia la conexión (p. ej. abre el widget del agregador). Nunca pedimos contraseñas en Fina. */
  connect(params?: Record<string, string>): Promise<{ linkId: string }>;
  listAccounts(linkId: string): Promise<BankAccountInfo[]>;
  syncTransactions(linkId: string, accountId: string, since: string): Promise<ImportedRow[]>;
}

/** Conector activo: el usuario sube su estado de cuenta (CSV/XLSX/OFX). */
export class ManualImportConnector implements BankConnector {
  readonly id = 'manual';
  readonly name = 'Importar archivo';
  readonly paid = false;
  isEnabled() {
    return true;
  }
  async connect() {
    return { linkId: 'manual' };
  }
  async listAccounts() {
    return [];
  }
  async syncTransactions(): Promise<ImportedRow[]> {
    // La importación manual ocurre en el navegador con parseStatement().
    return [];
  }
}

/**
 * Belvo (https://belvo.com) — agregador para México (BBVA, Banamex, Santander…).
 * ⚠️ Servicio de PAGO con contrato. Para activarlo algún día:
 *   1. Contratar Belvo y obtener SECRET_ID / SECRET_PASSWORD.
 *   2. Guardarlos como secrets del Worker: BELVO_SECRET_ID, BELVO_SECRET_PASSWORD, BELVO_ENV=production
 *   3. Usar su "Connect Widget" en la app (el usuario se autentica con Belvo, no con Fina).
 *   4. Implementar los métodos con su API REST (/api/links, /api/accounts, /api/transactions).
 */
export class BelvoConnector implements BankConnector {
  readonly id = 'belvo';
  readonly name = 'Belvo (conexión automática)';
  readonly paid = true;
  constructor(private readonly env: { BELVO_SECRET_ID?: string; BELVO_SECRET_PASSWORD?: string; BELVO_ENV?: string } = {}) {}
  isEnabled() {
    return !!(this.env.BELVO_SECRET_ID && this.env.BELVO_SECRET_PASSWORD);
  }
  async connect(): Promise<{ linkId: string }> {
    throw new Error('Belvo no está activado. Ver docs/GUIA-DUENO.md → "Conexión automática con bancos".');
  }
  async listAccounts(): Promise<BankAccountInfo[]> {
    throw new Error('Belvo no está activado.');
  }
  async syncTransactions(): Promise<ImportedRow[]> {
    throw new Error('Belvo no está activado.');
  }
}

export function availableConnectors(env: Record<string, string | undefined> = {}): BankConnector[] {
  return [new ManualImportConnector(), new BelvoConnector(env)].filter((c) => c.isEnabled());
}
