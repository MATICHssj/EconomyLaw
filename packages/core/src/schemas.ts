import { z } from 'zod';

/**
 * Modelo de datos de Fina (igual en Firestore y en el modo local).
 * Montos: SIEMPRE centavos enteros. Fechas: 'YYYY-MM-DD'. Timestamps: ISO 8601.
 */

const cents = z.number().int();
const positiveCents = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LEVELS = ['basic', 'organized', 'expert'] as const;
export type Level = (typeof LEVELS)[number];

export const TX_KINDS = [
  'expense',
  'income',
  'transfer',
  'debt_payment',
  'loan_given',
  'loan_received',
  'loan_collected',
  'loan_repaid',
  'investment',
  'tanda',
] as const;
export type TxKind = (typeof TX_KINDS)[number];

export const TX_SOURCES = [
  'app',
  'whatsapp',
  'voice',
  'receipt',
  'email',
  'import',
  'notification',
  'recurring',
  'shortcut',
  'demo',
] as const;
export type TxSource = (typeof TX_SOURCES)[number];

export const ACCOUNT_TYPES = [
  'cash',
  'debit',
  'credit',
  'savings',
  'investment',
  'wallet',
  'voucher',
  'loan',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ProfileSchema = z.object({
  name: z.string().max(80).default(''),
  email: z.string().optional(),
  level: z.enum(LEVELS).default('basic'),
  currency: z.string().default('MXN'),
  locale: z.string().default('es-MX'),
  payday: z
    .object({
      type: z.enum(['weekly', 'biweekly', 'monthly', 'irregular']),
      days: z.array(z.number().int()),
    })
    .default({ type: 'biweekly', days: [15, 30] }),
  /** Ingreso mensual aproximado (para 50/30/20, salud financiera y pareja). */
  monthlyIncomeCents: positiveCents.optional(),
  onboarded: z.boolean().default(false),
  householdId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  accent: z.enum(['indigo', 'violet', 'blue', 'emerald']).default('indigo'),
  fontScale: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
  /** Íconos de línea sencillos (por defecto) o emojis. */
  iconStyle: z.enum(['simple', 'emoji']).default('simple'),
  privacyMode: z.boolean().default(false),
  pinEnabled: z.boolean().default(false),
  notifications: z
    .object({
      cardDue: z.boolean().default(true),
      cardDueDaysBefore: z.number().int().default(2),
      recurring: z.boolean().default(true),
      budgetAlerts: z.boolean().default(true),
      weeklySummary: z.boolean().default(true),
      emailImports: z.boolean().default(true),
    })
    .default({
      cardDue: true,
      cardDueDaysBefore: 2,
      recurring: true,
      budgetAlerts: true,
      weeklySummary: true,
      emailImports: true,
    }),
  quietHours: z.object({ from: z.string(), to: z.string() }).default({ from: '22:00', to: '08:00' }),
  defaultAccountId: z.string().nullable().default(null),
  budgetMethod: z.enum(['category', '503020', 'zero']).default('category'),
  assistantEnabled: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const CreditInfoSchema = z.object({
  limitCents: positiveCents.default(0),
  /** Día de corte (1..31) */
  cutoffDay: z.number().int().min(1).max(31),
  /** Día límite de pago (1..31). Normalmente ~20 días después del corte. */
  dueDay: z.number().int().min(1).max(31),
  /** Tasa anual (CAT aproximado), p. ej. 0.65 = 65 % */
  annualRate: z.number().min(0).max(5).default(0.6),
  /** Porcentaje del pago mínimo sobre el saldo (Banxico: típicamente 1.5 % del saldo + intereses). */
  minPaymentRate: z.number().min(0).max(1).default(0.05),
});
export type CreditInfo = z.infer<typeof CreditInfoSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().optional(),
  currency: z.string().default('MXN'),
  openingBalanceCents: cents.default(0),
  color: z.string().default('#64748b'),
  icon: z.string().default('💳'),
  archived: z.boolean().default(false),
  aliases: z.array(z.string()).default([]),
  credit: CreditInfoSchema.optional(),
  /** Datos visibles de la tarjeta física. Nunca se guarda el número completo. */
  card: z
    .object({
      brand: z.enum(['visa', 'mastercard', 'amex', 'carnet', 'other']).default('other'),
      last4: z.string().regex(/^\d{4}$/).optional(),
      /** 'YYYY-MM' */
      expiry: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      /** Se agregó acercándola al teléfono (NFC). */
      nfc: z.boolean().default(false),
    })
    .optional(),
  /** Para cuentas compartidas en modo pareja. */
  ownerUid: z.string().optional(),
  createdAt: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  kind: z.enum(TX_KINDS),
  amountCents: positiveCents,
  currency: z.string().default('MXN'),
  fxRate: z.number().positive().optional(),
  /** Monto convertido a la moneda base (MXN). */
  amountMxnCents: positiveCents,
  accountId: z.string().nullable(),
  toAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  description: z.string().max(200),
  merchant: z.string().optional(),
  date: isoDate,
  createdAt: z.string(),
  updatedAt: z.string(),
  source: z.enum(TX_SOURCES).default('app'),
  rawText: z.string().max(500).optional(),
  status: z.enum(['cleared', 'pending', 'review']).default('cleared'),
  reconciled: z.boolean().default(false),
  /** En gastos compartidos: tu parte real del gasto (lo demás es por cobrar). */
  myShareCents: positiveCents.optional(),
  person: z.string().optional(),
  splitId: z.string().optional(),
  installmentPlanId: z.string().optional(),
  recurringId: z.string().optional(),
  loanId: z.string().optional(),
  goalId: z.string().optional(),
  debtId: z.string().optional(),
  tandaId: z.string().optional(),
  investmentId: z.string().optional(),
  /** Viaje al que pertenece el gasto. */
  tripId: z.string().optional(),
  /** Llegó del banco y parece el mismo gasto que anotaste a mano (id del tuyo). Pendiente de confirmar. */
  duplicateOf: z.string().optional(),
  attachments: z.array(z.string()).default([]),
  dedupeHash: z.string().optional(),
  /** uid de quien lo registró (modo pareja). */
  createdBy: z.string().optional(),
  /** Marcado como deducible (SAT). */
  deductible: z.string().optional(),
  note: z.string().max(500).optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  emoji: z.string().default('📦'),
  color: z.string().default('#64748b'),
  parentId: z.string().nullable().optional(),
  type: z.enum(['expense', 'income']),
  group: z.enum(['needs', 'wants', 'savings', 'income', 'none']).default('none'),
  archived: z.boolean().default(false),
  /** Categoría del sistema (no se puede borrar). */
  system: z.boolean().default(false),
  order: z.number().default(0),
});
export type Category = z.infer<typeof CategorySchema>;

export const RuleSchema = z.object({
  id: z.string(),
  match: z.object({
    contains: z.string().optional(),
    merchant: z.string().optional(),
    regex: z.string().optional(),
  }),
  set: z.object({
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  priority: z.number().default(0),
  learned: z.boolean().default(false),
  hits: z.number().default(0),
  createdAt: z.string(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const BudgetLineSchema = z.object({
  assignedCents: positiveCents.default(0),
  rollover: z.boolean().default(false),
});
export type BudgetLine = z.infer<typeof BudgetLineSchema>;

/** id = 'YYYY-MM' */
export const BudgetSchema = z.object({
  id: z.string(),
  method: z.enum(['category', '503020', 'zero']).default('category'),
  lines: z.record(z.string(), BudgetLineSchema).default({}),
  /** Para 50/30/20: ingreso base del mes. */
  incomeCents: positiveCents.optional(),
  /** Base cero: dinero aún sin asignar (calculado, se guarda como referencia). */
  toAssignCents: cents.optional(),
  /** Creado por "Cargar datos de ejemplo". */
  demo: z.boolean().optional(),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const FREQUENCIES = ['once', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const RecurringSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  template: z.object({
    kind: z.enum(TX_KINDS),
    amountCents: positiveCents,
    currency: z.string().default('MXN'),
    accountId: z.string().nullable(),
    toAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable(),
    description: z.string(),
    merchant: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
  frequency: z.enum(FREQUENCIES),
  nextDate: isoDate,
  remindDaysBefore: z.number().int().min(0).max(30).default(2),
  /** Registrar automáticamente cuando llegue la fecha. */
  autoCreate: z.boolean().default(false),
  active: z.boolean().default(true),
  isSubscription: z.boolean().default(false),
  createdAt: z.string(),
});
export type Recurring = z.infer<typeof RecurringSchema>;

export const GoalSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  emoji: z.string().default('🎯'),
  targetCents: positiveCents,
  targetDate: isoDate.nullable().optional(),
  savedCents: positiveCents.default(0),
  accountId: z.string().nullable().optional(),
  type: z.enum(['normal', 'emergency']).default('normal'),
  /** Fondo de emergencia: meses de gastos que se quieren cubrir. */
  monthsTarget: z.number().optional(),
  createdAt: z.string(),
  archived: z.boolean().default(false),
});
export type Goal = z.infer<typeof GoalSchema>;

export const DebtSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  kind: z.enum(['credit_card', 'personal', 'car', 'mortgage', 'student', 'family', 'other']).default('other'),
  balanceCents: positiveCents,
  annualRate: z.number().min(0).max(5),
  minPaymentCents: positiveCents,
  accountId: z.string().nullable().optional(),
  createdAt: z.string(),
  archived: z.boolean().default(false),
});
export type Debt = z.infer<typeof DebtSchema>;

export const InstallmentPlanSchema = z.object({
  id: z.string(),
  description: z.string().max(100),
  totalCents: positiveCents,
  months: z.number().int().min(1).max(60),
  /** Meses ya cobrados antes de registrar el plan en Fina. */
  paidMonths: z.number().int().min(0).default(0),
  accountId: z.string().nullable(),
  /** Fecha de la compra. */
  startDate: isoDate,
  categoryId: z.string().nullable().optional(),
  /** 0 = MSI. Si tiene intereses, tasa anual. */
  annualRate: z.number().min(0).default(0),
  transactionId: z.string().optional(),
  createdAt: z.string(),
});
export type InstallmentPlan = z.infer<typeof InstallmentPlanSchema>;

export const LoanSchema = z.object({
  id: z.string(),
  person: z.string().max(60),
  direction: z.enum(['lent', 'borrowed']),
  amountCents: positiveCents,
  paidCents: positiveCents.default(0),
  dueDate: isoDate.nullable().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
  closed: z.boolean().default(false),
});
export type Loan = z.infer<typeof LoanSchema>;

export const SplitSchema = z.object({
  id: z.string(),
  description: z.string(),
  totalCents: positiveCents,
  date: isoDate,
  transactionId: z.string().optional(),
  participants: z.array(
    z.object({
      name: z.string(),
      shareCents: positiveCents,
      paid: z.boolean().default(false),
      isMe: z.boolean().default(false),
    }),
  ),
  createdAt: z.string(),
});
export type Split = z.infer<typeof SplitSchema>;

export const TandaSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  contributionCents: positiveCents,
  participants: z.number().int().min(2).max(60),
  /** Tu número (1 = recibes primero). */
  myTurn: z.number().int().min(1),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  startDate: isoDate,
  organizer: z.string().optional(),
  received: z.boolean().default(false),
  createdAt: z.string(),
  archived: z.boolean().default(false),
});
export type Tanda = z.infer<typeof TandaSchema>;

export const INVESTMENT_TYPES = ['cetes', 'afore', 'fund', 'stock', 'crypto', 'pagare', 'ppr', 'other'] as const;

export const InvestmentSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  type: z.enum(INVESTMENT_TYPES),
  contributions: z.array(z.object({ date: isoDate, amountCents: positiveCents })).default([]),
  currentValueCents: positiveCents.default(0),
  /** Rendimiento anual esperado (para proyección). */
  expectedAnnualRate: z.number().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  archived: z.boolean().default(false),
});
export type Investment = z.infer<typeof InvestmentSchema>;

/** id = 'YYYY-MM' */
export const SnapshotSchema = z.object({
  id: z.string(),
  netWorthCents: cents,
  assetsCents: cents,
  liabilitiesCents: cents,
  createdAt: z.string(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const CfdiSchema = z.object({
  id: z.string(), // UUID fiscal
  rfcEmisor: z.string(),
  nombre: z.string(),
  totalCents: positiveCents,
  fecha: isoDate,
  usoCfdi: z.string(),
  formaPago: z.string().optional(),
  metodoPago: z.string().optional(),
  deductible: z.string().nullable().optional(),
  txId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Cfdi = z.infer<typeof CfdiSchema>;

// ——————————————————— Viajes ———————————————————

export const TRIP_BUCKETS = [
  'flights',
  'lodging',
  'food',
  'local_transport',
  'activities',
  'shopping',
  'other',
] as const;
export type TripBucket = (typeof TRIP_BUCKETS)[number];

export const TRIP_ITEM_TYPES = ['flight', 'lodging', 'activity', 'food', 'transport', 'note'] as const;
export type TripItemType = (typeof TRIP_ITEM_TYPES)[number];

/** Un elemento del itinerario: vuelo, hotel, actividad, comida, traslado o nota. */
export const TripItemSchema = z.object({
  id: z.string(),
  /** Día del itinerario; null = sin fecha (pendiente por acomodar). */
  date: isoDate.nullable().default(null),
  /** 'HH:MM' */
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  type: z.enum(TRIP_ITEM_TYPES).default('activity'),
  title: z.string().min(1).max(80),
  place: z.string().max(80).optional(),
  costCents: positiveCents.default(0),
  /** Ya está pagado (reservado). */
  paid: z.boolean().default(false),
  /** Movimiento con el que se registró el pago. */
  txId: z.string().optional(),
  note: z.string().max(300).optional(),
});
export type TripItem = z.infer<typeof TripItemSchema>;

export const TripFundingSchema = z.object({
  /** save = ahorrar antes; card = pagar con tarjeta después; mixed = parte y parte. */
  mode: z.enum(['save', 'card', 'mixed']).default('save'),
  /** Lo que ya tienes apartado para el viaje. */
  savedCents: positiveCents.default(0),
  /** Cuánto puedes apartar cada periodo (0 = que Fina lo calcule). */
  perPeriodCents: positiveCents.default(0),
  period: z.enum(['biweekly', 'monthly']).default('biweekly'),
  /** Tarjeta con la que se pagará la parte a crédito. */
  cardAccountId: z.string().nullable().default(null),
  /** Meses sin intereses (0 = sin MSI). */
  msiMonths: z.number().int().min(0).max(48).default(0),
  /** Sin MSI: cuánto abonarías al mes a la tarjeta. */
  payPerMonthCents: positiveCents.default(0),
  /** En modo mixto: porcentaje que se paga con tarjeta (0..100). */
  cardSharePct: z.number().int().min(0).max(100).default(50),
});
export type TripFunding = z.infer<typeof TripFundingSchema>;

export const TripSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  destination: z.string().max(80).default(''),
  icon: z.string().default('i:plane'),
  startDate: isoDate,
  endDate: isoDate,
  travelers: z.number().int().min(1).max(30).default(1),
  /** Moneda del destino (para convertir gastos). */
  currency: z.string().default('MXN'),
  /** Presupuesto por rubro (centavos MXN). */
  budget: z.record(z.string(), positiveCents).default({}),
  funding: TripFundingSchema.default(TripFundingSchema.parse({})),
  items: z.array(TripItemSchema).max(300).default([]),
  /** Los gastos hechos en las fechas del viaje se asignan solos. */
  autoAssign: z.boolean().default(true),
  /** Movimientos que el usuario dijo que NO son del viaje (para no volver a sugerirlos). */
  ignoredTxIds: z.array(z.string()).max(500).default([]),
  notes: z.string().max(1000).optional(),
  archived: z.boolean().default(false),
  createdAt: z.string(),
});
export type Trip = z.infer<typeof TripSchema>;

export const HouseholdSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  members: z.array(z.string()),
  memberNames: z.record(z.string(), z.string()).default({}),
  /** Cómo se reparten los gastos comunes: 50/50 o proporcional al ingreso. */
  splitMode: z.enum(['equal', 'income', 'custom']).default('equal'),
  /** Pesos por uid para 'custom' o ingresos para 'income'. */
  weights: z.record(z.string(), z.number()).default({}),
  createdBy: z.string(),
  createdAt: z.string(),
  joinCode: z.string().optional(),
});
export type Household = z.infer<typeof HouseholdSchema>;

/** Mapa nombre de colección → tipo de documento. */
export interface CollectionMap {
  accounts: Account;
  transactions: Transaction;
  categories: Category;
  rules: Rule;
  budgets: Budget;
  recurring: Recurring;
  goals: Goal;
  debts: Debt;
  installmentPlans: InstallmentPlan;
  loans: Loan;
  splits: Split;
  tandas: Tanda;
  investments: Investment;
  snapshots: Snapshot;
  cfdi: Cfdi;
  trips: Trip;
}
export type CollectionName = keyof CollectionMap;

export const COLLECTIONS: CollectionName[] = [
  'accounts',
  'transactions',
  'categories',
  'rules',
  'budgets',
  'recurring',
  'goals',
  'debts',
  'installmentPlans',
  'loans',
  'splits',
  'tandas',
  'investments',
  'snapshots',
  'cfdi',
  'trips',
];

/** Colecciones que se pueden compartir en el espacio del hogar (modo pareja). */
export const HOUSEHOLD_COLLECTIONS: CollectionName[] = [
  'accounts',
  'transactions',
  'budgets',
  'recurring',
  'goals',
  'installmentPlans',
  'trips',
];
