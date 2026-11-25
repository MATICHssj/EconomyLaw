import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatLongDate, formatMoney, projectCashFlow, splitCents } from '@fina/core';
import { useFinance } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import { Card, CardTitle, Money, PageHeader, Segmented, Tip, cx } from '@/components/ui';
import { CHART, tooltipStyle } from '@/features/reports/chartTheme';

export default function ProjectionPage() {
  const f = useFinance();
  const [days, setDays] = useState<'30' | '60' | '90'>('30');
  const accounts = useDocs('accounts');
  const txs = useDocs('transactions');
  const recurring = useDocs('recurring');
  const plans = useDocs('installmentPlans');
  const tandas = useData((s) => s.data.tandas);
  const profile = useData((s) => s.profile);
  const privacy = useData((s) => s.settings.privacyMode);

  const p = useMemo(() => {
    const per =
      profile?.payday?.type === 'biweekly' ? 2 : profile?.payday?.type === 'weekly' ? 4 : 1;
    return projectCashFlow({
      today: f.today,
      days: Number(days),
      startBalanceCents: f.available,
      accounts,
      balances: f.balances,
      transactions: txs,
      recurring,
      plans,
      tandas,
      payday: profile?.payday,
      paycheckCents: profile?.monthlyIncomeCents
        ? splitCents(profile.monthlyIncomeCents, per)[0]
        : undefined,
    });
  }, [f, days, accounts, txs, recurring, plans, tandas, profile]);

  const data = p.days.map((d) => ({
    label: `${Number(d.date.slice(8))}/${Number(d.date.slice(5, 7))}`,
    Saldo: d.balanceCents / 100,
  }));
  const negative = p.lowest.balanceCents < 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Proyección"
        subtitle="Cómo se verá tu dinero en las próximas semanas."
        back
      />
      <Segmented
        value={days}
        onChange={setDays}
        options={[
          { value: '30', label: '30 días' },
          { value: '60', label: '60 días' },
          { value: '90', label: '90 días' },
        ]}
      />
      <Card className={cx(negative && 'border-rose-300')}>
        {p.beforeNextPayday && (
          <p className="text-lg text-ink">
            El {formatLongDate(p.beforeNextPayday.date)} te quedarías con{' '}
            <Money cents={p.beforeNextPayday.balanceCents} className="font-bold" /> antes de tu
            pago.
          </p>
        )}
        <p className={cx('mt-1 text-sm', negative ? 'font-semibold text-rose-600' : 'text-muted')}>
          Tu punto más bajo: <Money cents={p.lowest.balanceCents} /> el{' '}
          {formatLongDate(p.lowest.date)}.
        </p>
        <div className="mt-4 h-60" role="img" aria-label="Saldo disponible proyectado por día">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={Math.ceil(data.length / 7)}
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
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="Saldo"
                stroke={CHART.single}
                strokeWidth={2}
                fill={CHART.single}
                fillOpacity={0.12}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted">
          Incluye tus recurrentes, pagos de tarjeta, tandas y un gasto diario promedio de{' '}
          <Money cents={p.dailyBurnCents} /> (de tus últimos 60 días).
        </p>
      </Card>
      <Card>
        <CardTitle>Lo que viene</CardTitle>
        {p.events.length === 0 ? (
          <p className="text-sm text-muted">
            Sin pagos ni ingresos programados. Agrega tus recurrentes para una proyección más
            precisa.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {p.events.map((e, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="text-ink">
                  {formatLongDate(e.date)} · {e.title}
                </span>
                <Money
                  cents={e.amountCents}
                  signed
                  kind={e.amountCents > 0 ? 'income' : 'neutral'}
                  className="font-semibold"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Tip>
        Si ves tu punto más bajo en negativo, mueve un pago, recorta gastos variables o aparta desde
        hoy. ¡Mejor saberlo antes!
      </Tip>
    </div>
  );
}
