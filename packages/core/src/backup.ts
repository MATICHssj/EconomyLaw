import type { z } from 'zod';
import {
  AccountSchema,
  BudgetSchema,
  CategorySchema,
  CfdiSchema,
  COLLECTIONS,
  DebtSchema,
  GoalSchema,
  InstallmentPlanSchema,
  InvestmentSchema,
  LoanSchema,
  ProfileSchema,
  RecurringSchema,
  RuleSchema,
  SettingsSchema,
  SnapshotSchema,
  SplitSchema,
  TandaSchema,
  TransactionSchema,
  TripSchema,
  type CollectionMap,
  type CollectionName,
  type Profile,
  type Settings,
} from './schemas';

/**
 * Respaldos: el .json que genera "Descargar respaldo" se puede volver a cargar.
 * Cada documento se valida con su esquema; los que no pasan se omiten (nunca se
 * escribe algo inválido en tu base de datos).
 */
export const COLLECTION_SCHEMAS: { [K in CollectionName]: z.ZodType<CollectionMap[K]> } = {
  accounts: AccountSchema,
  transactions: TransactionSchema,
  categories: CategorySchema,
  rules: RuleSchema,
  budgets: BudgetSchema,
  recurring: RecurringSchema,
  goals: GoalSchema,
  debts: DebtSchema,
  installmentPlans: InstallmentPlanSchema,
  loans: LoanSchema,
  splits: SplitSchema,
  tandas: TandaSchema,
  investments: InvestmentSchema,
  snapshots: SnapshotSchema,
  cfdi: CfdiSchema,
  trips: TripSchema,
} as { [K in CollectionName]: z.ZodType<CollectionMap[K]> };

export const COLLECTION_LABELS: Record<CollectionName, string> = {
  accounts: 'cuentas',
  transactions: 'movimientos',
  categories: 'categorías',
  rules: 'reglas',
  budgets: 'presupuestos',
  recurring: 'recurrentes y recordatorios',
  goals: 'metas',
  debts: 'deudas',
  installmentPlans: 'compras a MSI',
  loans: 'préstamos',
  splits: 'gastos compartidos',
  tandas: 'tandas',
  investments: 'inversiones',
  snapshots: 'fotos de patrimonio',
  cfdi: 'facturas',
  trips: 'viajes',
};

export interface ParsedBackup {
  exportedAt: string | null;
  profile: Partial<Profile> | null;
  settings: Partial<Settings> | null;
  data: { [K in CollectionName]: CollectionMap[K][] };
  counts: Partial<Record<CollectionName, number>>;
  /** Documentos que no pasaron la validación (se omiten). */
  skipped: number;
  total: number;
}

export type BackupResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

/** Máximo de documentos por respaldo (protege al teléfono de archivos enormes). */
const MAX_DOCS = 200_000;

export function parseBackup(raw: unknown): BackupResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, error: 'El archivo no es un respaldo de Fina.' };
  const obj = raw as Record<string, unknown>;
  const looksLikeFina = obj.app === 'Fina' || COLLECTIONS.some((c) => Array.isArray(obj[c]));
  if (!looksLikeFina) return { ok: false, error: 'El archivo no es un respaldo de Fina.' };

  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as ParsedBackup['data'];
  const counts: ParsedBackup['counts'] = {};
  let skipped = 0;
  let total = 0;
  for (const col of COLLECTIONS) {
    const list = obj[col];
    if (!Array.isArray(list)) continue;
    const schema = COLLECTION_SCHEMAS[col];
    for (const item of list) {
      if (total >= MAX_DOCS) return { ok: false, error: 'El respaldo es demasiado grande.' };
      const r = schema.safeParse(item);
      if (r.success) {
        (data[col] as unknown[]).push(r.data);
        counts[col] = (counts[col] ?? 0) + 1;
        total++;
      } else skipped++;
    }
  }
  if (total === 0) return { ok: false, error: 'El respaldo no tiene datos que se puedan cargar.' };

  const profile = ProfileSchema.partial().safeParse(obj.profile);
  const settings = SettingsSchema.partial().safeParse(obj.settings);
  return {
    ok: true,
    backup: {
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
      profile: profile.success ? profile.data : null,
      settings: settings.success ? settings.data : null,
      data,
      counts,
      skipped,
      total,
    },
  };
}
