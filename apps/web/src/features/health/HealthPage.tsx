import { useMemo } from 'react';
import {
  addDays,
  addMonthsKey,
  financialHealth,
  installmentsBetween,
  monthEnd,
  monthKey,
  monthStart,
  summarizePeriod,
  budgetProgress,
} from '@fina/core';
import { useFinance } from '@/lib/finance';
import { useData } from '@/stores/data';
import { Card, PageHeader, ProgressBar, Tip, cx } from '@/components/ui';

export default function HealthPage() {
  const f = useFinance();
  const d = useData((s) => s.data);
  const profile = useData((s) => s.profile);

  const health = useMemo(() => {
    const mk = monthKey(f.today);
    const months = [1, 2, 3].map((i) => addMonthsKey(mk, -i));
    const sums = months.map((k) =>
      summarizePeriod(d.transactions, d.installmentPlans, monthStart(k), monthEnd(k)),
    );
    const avg = (fn: (s: (typeof sums)[number]) => number) =>
      Math.round(sums.reduce((a, s) => a + fn(s), 0) / sums.length);
    const needs = new Set(d.categories.filter((c) => c.group === 'needs').map((c) => c.id));
    const income = Math.max(
      avg((s) => s.incomeCents),
      profile?.monthlyIncomeCents ?? 0,
    );
    const emergency =
      d.goals.filter((g) => g.type === 'emergency').reduce((s, g) => s + g.savedCents, 0) ||
      d.accounts
        .filter((a) => a.type === 'savings' && !a.archived)
        .reduce((s, a) => s + Math.max(0, f.balances[a.id] ?? 0), 0);
    const msi = installmentsBetween(d.installmentPlans, f.today, addDays(f.today, 30)).reduce(
      (s, c) => s + c.amountCents,
      0,
    );
    const mins =
      d.debts.filter((x) => !x.archived).reduce((s, x) => s + x.minPaymentCents, 0) +
      f.statements.reduce((s, st) => s + st.minimumPaymentCents, 0);
    const limit = d.accounts
      .filter((a) => a.type === 'credit' && a.credit?.limitCents)
      .reduce((s, a) => s + (a.credit?.limitCents ?? 0), 0);
    const prevKey = addMonthsKey(mk, -1);
    const prevLines = budgetProgress(
      d.budgets.find((b) => b.id === prevKey),
      sums[0]!.byCategory,
    );
    const activeDays = new Set(
      d.transactions
        .filter((t) => t.createdAt.slice(0, 10) >= addDays(f.today, -30))
        .map((t) => t.createdAt.slice(0, 10)),
    ).size;
    return financialHealth({
      monthlyIncomeCents: income,
      monthlySpendingCents: avg((s) => s.spentCents),
      monthlyEssentialCents: avg((s) =>
        Object.entries(s.byCategory)
          .filter(([c]) => needs.has(c))
          .reduce((a, [, v]) => a + v, 0),
      ),
      emergencySavingsCents: emergency,
      monthlyDebtPaymentsCents: mins + msi,
      creditUtilizationPct: limit ? Math.round((f.owed / limit) * 100) : null,
      budgetAdherencePct: prevLines.length
        ? Math.round((prevLines.filter((l) => l.status !== 'over').length / prevLines.length) * 100)
        : null,
      activeDaysLast30: activeDays,
    });
  }, [f, d, profile]);

  const color =
    health.score >= 80
      ? '#059669'
      : health.score >= 60
        ? '#6366f1'
        : health.score >= 40
          ? '#d97706'
          : '#e11d48';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salud financiera"
        subtitle="Una calificación fácil de entender, con qué mejorar."
        back
      />
      {health.factors.length === 0 ? (
        <Tip>
          Necesito al menos un mes de datos (ingresos y gastos) para calificar tu salud financiera.
        </Tip>
      ) : (
        <>
          <Card className="flex items-center gap-5">
            <div
              className="relative h-28 w-28 shrink-0"
              role="img"
              aria-label={`Calificación ${health.score} de 100`}
            >
              <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth="3.2"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke={color}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray={`${health.score} 100`}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-ink">{health.score}</span>
                <span className="text-xs text-muted">de 100</span>
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">
                {health.emoji} {health.label}
              </p>
              <p className="text-sm text-muted">Basado en tus últimos 3 meses.</p>
            </div>
          </Card>
          {health.factors.map((fct) => (
            <Card key={fct.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{fct.label}</p>
                <span
                  className={cx(
                    'text-sm font-semibold',
                    fct.status === 'good'
                      ? 'text-income'
                      : fct.status === 'ok'
                        ? 'text-amber-600'
                        : 'text-rose-600',
                  )}
                >
                  {fct.value}
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                value={(fct.score / fct.max) * 100}
                status={fct.status === 'good' ? 'ok' : fct.status === 'ok' ? 'warn' : 'over'}
                label={fct.label}
              />
              <p className="mt-2 text-sm text-muted">{fct.tip}</p>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
