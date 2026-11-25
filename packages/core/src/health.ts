/**
 * "Salud financiera": una calificación de 0 a 100 fácil de entender, con
 * explicación de cada factor y un consejo concreto para mejorar.
 */

export interface HealthInput {
  /** Ingreso mensual promedio (últimos meses). */
  monthlyIncomeCents: number;
  /** Gasto mensual promedio. */
  monthlySpendingCents: number;
  /** Gasto mensual en necesidades (para el fondo de emergencia). */
  monthlyEssentialCents: number;
  /** Dinero ahorrado disponible para emergencias. */
  emergencySavingsCents: number;
  /** Pagos mensuales comprometidos a deudas (mínimos + MSI). */
  monthlyDebtPaymentsCents: number;
  /** Uso de tarjetas de crédito (0..100). null si no tiene tarjetas. */
  creditUtilizationPct: number | null;
  /** % de líneas del presupuesto que no se pasaron el mes pasado. null si no usa presupuesto. */
  budgetAdherencePct: number | null;
  /** Días con registros en los últimos 30. */
  activeDaysLast30: number;
}

export interface HealthFactor {
  id: 'savings' | 'emergency' | 'debt' | 'credit' | 'habits';
  label: string;
  score: number;
  max: number;
  value: string;
  tip: string;
  status: 'good' | 'ok' | 'bad';
}

export interface HealthScore {
  score: number;
  label: 'Excelente' | 'Bien' | 'Regular' | 'En riesgo' | 'Sin datos';
  emoji: string;
  factors: HealthFactor[];
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const status = (ratio: number): HealthFactor['status'] => (ratio >= 0.8 ? 'good' : ratio >= 0.4 ? 'ok' : 'bad');

export function financialHealth(h: HealthInput): HealthScore {
  if (h.monthlyIncomeCents <= 0 && h.monthlySpendingCents <= 0) {
    return { score: 0, label: 'Sin datos', emoji: '🌱', factors: [] };
  }
  const factors: HealthFactor[] = [];

  const savingsRate = h.monthlyIncomeCents > 0 ? (h.monthlyIncomeCents - h.monthlySpendingCents) / h.monthlyIncomeCents : 0;
  const sRatio = clamp(savingsRate / 0.2);
  factors.push({
    id: 'savings',
    label: 'Tasa de ahorro',
    score: Math.round(sRatio * 25),
    max: 25,
    value: h.monthlyIncomeCents > 0 ? `${Math.round(savingsRate * 100)} %` : 'Registra tus ingresos',
    tip: savingsRate >= 0.2 ? '¡Ahorras 20 % o más! Pon ese dinero a trabajar en CETES o tu meta.' : savingsRate > 0 ? 'Intenta llegar al 20 %: separa el ahorro el mismo día de tu quincena.' : 'Estás gastando más de lo que ganas. Revisa tus 3 categorías más altas.',
    status: status(sRatio),
  });

  const months = h.monthlyEssentialCents > 0 ? h.emergencySavingsCents / h.monthlyEssentialCents : 0;
  const eRatio = clamp(months / 3);
  factors.push({
    id: 'emergency',
    label: 'Fondo de emergencia',
    score: Math.round(eRatio * 25),
    max: 25,
    value: `${Math.round(months * 10) / 10} meses`,
    tip: months >= 3 ? 'Tienes un buen colchón. La meta ideal son 6 meses.' : 'Junta al menos 3 meses de gastos básicos para dormir tranquilo.',
    status: status(eRatio),
  });

  const debtRatio = h.monthlyIncomeCents > 0 ? h.monthlyDebtPaymentsCents / h.monthlyIncomeCents : h.monthlyDebtPaymentsCents > 0 ? 1 : 0;
  const dRatio = clamp(1 - (debtRatio - 0.15) / 0.35);
  factors.push({
    id: 'debt',
    label: 'Carga de deudas',
    score: Math.round(dRatio * 20),
    max: 20,
    value: `${Math.round(debtRatio * 100)} % de tu ingreso`,
    tip: debtRatio <= 0.15 ? 'Tus deudas están bajo control.' : debtRatio <= 0.3 ? 'Cuidado con nuevos MSI: ya comprometes una parte importante.' : 'Tus deudas pesan mucho. Usa el simulador bola de nieve/avalancha.',
    status: status(dRatio),
  });

  if (h.creditUtilizationPct !== null) {
    const cRatio = clamp(1 - (h.creditUtilizationPct - 30) / 60);
    factors.push({
      id: 'credit',
      label: 'Uso de tus tarjetas',
      score: Math.round(cRatio * 15),
      max: 15,
      value: `${h.creditUtilizationPct} % de tu línea`,
      tip: h.creditUtilizationPct <= 30 ? 'Excelente para tu historial en Buró de Crédito.' : 'Usar menos del 30 % de tu línea mejora tu historial crediticio.',
      status: status(cRatio),
    });
  }

  const habitRatio =
    h.budgetAdherencePct !== null ? clamp((h.budgetAdherencePct / 100) * 0.6 + (h.activeDaysLast30 / 20) * 0.4) : clamp(h.activeDaysLast30 / 20);
  factors.push({
    id: 'habits',
    label: 'Hábitos',
    score: Math.round(habitRatio * 15),
    max: 15,
    value: h.budgetAdherencePct !== null ? `${h.budgetAdherencePct} % del presupuesto cumplido` : `${h.activeDaysLast30} días con registros`,
    tip: habitRatio >= 0.8 ? '¡Constancia de campeón! 🏆' : 'Anotar todos los días (aunque sea por WhatsApp) es el hábito #1.',
    status: status(habitRatio),
  });

  const max = factors.reduce((s, f) => s + f.max, 0);
  const got = factors.reduce((s, f) => s + f.score, 0);
  const score = Math.round((got / max) * 100);
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bien' : score >= 40 ? 'Regular' : 'En riesgo';
  const emoji = score >= 80 ? '💪' : score >= 60 ? '🙂' : score >= 40 ? '😐' : '🚨';
  return { score, label, emoji, factors };
}
