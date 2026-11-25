import type { Level } from './schemas';

/**
 * Funciones de la app y en qué nivel aparecen. El nivel SOLO muestra u oculta:
 * los datos son los mismos y subir de nivel nunca pierde información.
 * `pro` queda listo para una futura versión de pago (hoy todo es gratis).
 */
export const FEATURES = {
  quickCapture: { level: 'basic', label: 'Captura rápida', pro: false },
  whatsapp: { level: 'basic', label: 'WhatsApp', pro: false },
  autoCategories: { level: 'basic', label: 'Categorías automáticas', pro: false },
  weeklySummary: { level: 'basic', label: 'Resumen semanal', pro: false },
  antExpenses: { level: 'basic', label: 'Gastos hormiga', pro: false },
  academy: { level: 'basic', label: 'Aprende', pro: false },
  assistant: { level: 'basic', label: 'Pregúntale a Fina', pro: false },
  accounts: { level: 'organized', label: 'Cuentas', pro: false },
  customCategories: { level: 'organized', label: 'Categorías personalizadas', pro: false },
  budgets: { level: 'organized', label: 'Presupuestos', pro: false },
  recurring: { level: 'organized', label: 'Recurrentes', pro: false },
  subscriptions: { level: 'organized', label: 'Detector de suscripciones', pro: false },
  goals: { level: 'organized', label: 'Metas de ahorro', pro: false },
  creditCards: { level: 'organized', label: 'Tarjetas de crédito', pro: false },
  installments: { level: 'organized', label: 'Meses sin intereses', pro: false },
  reports: { level: 'organized', label: 'Reportes', pro: false },
  import: { level: 'organized', label: 'Importar estados de cuenta', pro: false },
  export: { level: 'basic', label: 'Exportar', pro: false },
  calendar: { level: 'organized', label: 'Calendario de dinero', pro: false },
  zeroBudget: { level: 'expert', label: 'Presupuesto base cero', pro: false },
  debts: { level: 'expert', label: 'Deudas', pro: false },
  loans: { level: 'expert', label: 'Préstamos', pro: false },
  splits: { level: 'expert', label: 'Gastos compartidos', pro: false },
  tandas: { level: 'expert', label: 'Tandas', pro: false },
  investments: { level: 'expert', label: 'Inversiones', pro: false },
  netWorth: { level: 'expert', label: 'Patrimonio', pro: false },
  projection: { level: 'expert', label: 'Proyección', pro: false },
  rules: { level: 'expert', label: 'Reglas automáticas', pro: false },
  reconciliation: { level: 'expert', label: 'Conciliación', pro: false },
  multiCurrency: { level: 'expert', label: 'Multimoneda', pro: false },
  sat: { level: 'expert', label: 'Impuestos y CFDI', pro: true },
  household: { level: 'basic', label: 'Modo pareja / familia', pro: true },
  emergencyFund: { level: 'organized', label: 'Fondo de emergencia', pro: false },
  health: { level: 'organized', label: 'Salud financiera', pro: false },
  trips: { level: 'basic', label: 'Viajes', pro: false },
  payments: { level: 'basic', label: 'Pagos pendientes', pro: false },
} as const satisfies Record<string, { level: Level; label: string; pro: boolean }>;

export type FeatureId = keyof typeof FEATURES;

const RANK: Record<Level, number> = { basic: 0, organized: 1, expert: 2 };

export function levelAtLeast(level: Level, min: Level): boolean {
  return RANK[level] >= RANK[min];
}

export function isFeatureVisible(level: Level, feature: FeatureId): boolean {
  return levelAtLeast(level, FEATURES[feature].level);
}

/** Interruptor general de la versión Pro (apagado: todo gratis). */
export const PRO_ENFORCED = false;

export function canUse(feature: FeatureId, plan: 'free' | 'pro' = 'free'): boolean {
  if (!PRO_ENFORCED) return true;
  return !FEATURES[feature].pro || plan === 'pro';
}

export const LEVEL_INFO: Record<Level, { label: string; emoji: string; tagline: string; description: string }> = {
  basic: {
    label: 'Básico',
    emoji: '🟢',
    tagline: 'Solo quiero saber en qué se me va.',
    description: 'Anota gastos en una línea y ve cuánto llevas en el mes. Sin cuentas ni presupuestos que configurar.',
  },
  organized: {
    label: 'Organizado',
    emoji: '🔵',
    tagline: 'Quiero presupuestos y no pasarme.',
    description: 'Cuentas, tarjetas con fecha de corte, MSI, presupuestos, metas, recurrentes y reportes.',
  },
  expert: {
    label: 'Experto',
    emoji: '🟣',
    tagline: 'Quiero control total.',
    description: 'Base cero/sobres, deudas, tandas, inversiones, patrimonio, proyección, reglas y SAT.',
  },
};
