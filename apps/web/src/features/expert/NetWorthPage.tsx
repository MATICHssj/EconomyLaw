import { useEffect, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatMonthKey, monthKey, netWorth, todayISO } from '@fina/core';
import { applyChanges } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
import { markSeen } from '@/features/academy/missions';
import { useData } from '@/stores/data';
import { Card, CardTitle, Money, PageHeader, Tip } from '@/components/ui';
import { CHART, tooltipStyle } from '@/features/reports/chartTheme';

export default function NetWorthPage() {
  const f = useFinance();
  const s = useData((st) => st.data);
  const privacy = useData((st) => st.settings.privacyMode);
  const nw = useMemo(
    () =>
      netWorth({
        accounts: s.accounts,
        balances: f.balances,
        investments: s.investments,
        debts: s.debts,
        loans: s.loans,
        splits: s.splits,
      }),
    [s, f.balances],
  );
  const mk = monthKey(todayISO());

  // Guarda la foto del mes (el cron del Worker también lo hace con la app cerrada).
  useEffect(() => {
    markSeen('networth');
    const existing = s.snapshots.find((x) => x.id === mk);
    if (!existing || existing.netWorthCents !== nw.netWorthCents) {
      void applyChanges([
        {
          space: 'personal',
          col: 'snapshots',
          before: existing ?? null,
          after: {
            id: mk,
            netWorthCents: nw.netWorthCents,
            assetsCents: nw.assetsCents,
            liabilitiesCents: nw.liabilitiesCents,
            createdAt: new Date().toISOString(),
          },
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nw.netWorthCents]);

  const history = [...s.snapshots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-24)
    .map((x) => ({
      label: formatMonthKey(x.id, false).slice(0, 3),
      Patrimonio: x.netWorthCents / 100,
    }));
  const assets = nw.breakdown
    .filter((b) => b.kind === 'asset')
    .sort((a, b) => b.amountCents - a.amountCents);
  const liabilities = nw.breakdown
    .filter((b) => b.kind === 'liability')
    .sort((a, b) => b.amountCents - a.amountCents);

  return (
    <div className="space-y-4">
      <PageHeader title="Patrimonio" subtitle="Lo que tienes menos lo que debes." back />
      <Card className="bg-gradient-to-br from-accent-600 to-accent-800 text-white">
        <p className="text-sm text-white/80">Tu patrimonio neto</p>
        <p className="text-4xl font-extrabold">
          <Money cents={nw.netWorthCents} />
        </p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            Tienes{' '}
            <b>
              <Money cents={nw.assetsCents} />
            </b>
          </span>
          <span>
            Debes{' '}
            <b>
              <Money cents={nw.liabilitiesCents} />
            </b>
          </span>
        </div>
      </Card>
      {history.length >= 2 ? (
        <Card>
          <CardTitle>Cómo ha cambiado</CardTitle>
          <div className="h-52" role="img" aria-label="Patrimonio neto por mes">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    privacy ? '' : formatMoney(v * 100, { compact: true })
                  }
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => (privacy ? '••••' : formatMoney(Math.round(Number(v) * 100)))}
                  {...tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="Patrimonio"
                  stroke={CHART.single}
                  strokeWidth={2}
                  fill={CHART.single}
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Tip>
          Cada mes guardo una “foto” de tu patrimonio. En unos meses verás aquí cómo crece 📈
        </Tip>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Lo que tienes</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {assets.map((a) => (
              <li key={a.label} className="flex justify-between">
                <span className="text-ink">{a.label}</span>
                <Money cents={a.amountCents} className="font-semibold text-ink" />
              </li>
            ))}
            {!assets.length && <li className="text-muted">Agrega tus cuentas e inversiones.</li>}
          </ul>
        </Card>
        <Card>
          <CardTitle>Lo que debes</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {liabilities.map((a) => (
              <li key={a.label} className="flex justify-between">
                <span className="text-ink">{a.label}</span>
                <Money cents={a.amountCents} className="font-semibold text-ink" />
              </li>
            ))}
            {!liabilities.length && <li className="text-income">¡Nada! 🎉</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
