import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import {
  addDays,
  addMonthsKey,
  formatMoney,
  formatMonthKey,
  isFeatureVisible,
  monthEnd,
  monthKey,
  monthStart,
  normalizeText,
  percent,
  spendingItems,
  summarizePeriod,
  topEntries,
  weekday,
  WEEKDAYS_ES,
} from '@fina/core';
import { useCategoryMap, useToday } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import { exportTransactionsCsv, exportTransactionsXlsx } from '@/lib/exporter';
import {
  Card,
  CardTitle,
  EmptyState,
  IconButton,
  Money,
  PageHeader,
  Segmented,
  Stat,
  cx,
} from '@/components/ui';
import { SpaceSwitcher } from '@/features/household/SpaceSwitcher';
import { CHART, tooltipStyle } from './chartTheme';

type Tab = 'categories' | 'trend' | 'compare' | 'advanced';

export default function ReportsPage() {
  const today = useToday();
  const [month, setMonth] = useState(monthKey(today));
  const [tab, setTab] = useState<Tab>('categories');
  const txs = useDocs('transactions');
  const plans = useDocs('installmentPlans');
  const catMap = useCategoryMap();
  const level = useData((s) => s.profile?.level ?? 'basic');
  const privacy = useData((s) => s.settings.privacyMode);
  const expert = isFeatureVisible(level, 'netWorth');

  const r = useMemo(() => {
    const cur = summarizePeriod(txs, plans, monthStart(month), monthEnd(month));
    const prevKey = addMonthsKey(month, -1);
    const prev = summarizePeriod(txs, plans, monthStart(prevKey), monthEnd(prevKey));
    const trend = Array.from({ length: 6 }, (_, i) => {
      const k = addMonthsKey(month, i - 5);
      const s = summarizePeriod(txs, plans, monthStart(k), monthEnd(k));
      return {
        key: k,
        label: formatMonthKey(k, false).slice(0, 3),
        Ingresos: s.incomeCents / 100,
        Gastos: s.spentCents / 100,
        savingsRate: s.incomeCents
          ? Math.round(((s.incomeCents - s.spentCents) / s.incomeCents) * 100)
          : null,
      };
    });
    const items = spendingItems(txs, plans, { from: monthStart(month), to: monthEnd(month) });
    const byWeekday = Array.from({ length: 7 }, (_, d) => ({
      day: WEEKDAYS_ES[d]!.slice(0, 3),
      Gasto: 0,
    }));
    const byDay: Record<string, number> = {};
    const merchants = new Map<string, { name: string; total: number; count: number }>();
    for (const it of items) {
      byWeekday[weekday(it.date)]!.Gasto += it.amountCents / 100;
      byDay[it.date] = (byDay[it.date] ?? 0) + it.amountCents;
      const name = it.tx.merchant ?? it.tx.description;
      const k = normalizeText(name);
      const m = merchants.get(k) ?? { name, total: 0, count: 0 };
      m.total += it.amountCents;
      m.count++;
      merchants.set(k, m);
    }
    const compare = [...new Set([...Object.keys(cur.byCategory), ...Object.keys(prev.byCategory)])]
      .map((c) => ({ c, now: cur.byCategory[c] ?? 0, before: prev.byCategory[c] ?? 0 }))
      .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before));
    return {
      cur,
      prev,
      trend,
      byWeekday,
      byDay,
      merchants: [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 8),
      compare,
    };
  }, [txs, plans, month]);

  const top = topEntries(r.cur.byCategory, 12);
  const max = top[0]?.[1] ?? 1;
  const savings = r.cur.incomeCents - r.cur.spentCents;
  const monthTxs = txs.filter((t) => t.date.startsWith(month));
  const yTick = (v: number) => (privacy ? '' : formatMoney(v * 100, { compact: true }));
  const tipFmt = (v: number) => (privacy ? '••••' : formatMoney(Math.round(v * 100)));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes"
        back
        actions={
          <>
            <IconButton
              label="Exportar CSV del mes"
              onClick={() => exportTransactionsCsv(monthTxs)}
            >
              <Download className="h-5 w-5" />
            </IconButton>
            <IconButton
              label="Exportar Excel del mes"
              onClick={() => void exportTransactionsXlsx(monthTxs)}
            >
              <FileSpreadsheet className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      <SpaceSwitcher />
      <div className="flex items-center justify-between rounded-2xl bg-surface p-1.5">
        <IconButton label="Mes anterior" onClick={() => setMonth((m) => addMonthsKey(m, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <span className="font-semibold text-ink">{formatMonthKey(month)}</span>
        <IconButton label="Mes siguiente" onClick={() => setMonth((m) => addMonthsKey(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Gastos"
          value={<Money cents={r.cur.spentCents} />}
          hint={
            r.prev.spentCents
              ? `${percent(r.cur.spentCents - r.prev.spentCents, r.prev.spentCents) > 0 ? '▲' : '▼'} ${Math.abs(percent(r.cur.spentCents - r.prev.spentCents, r.prev.spentCents))} % vs anterior`
              : undefined
          }
        />
        <Stat label="Ingresos" value={<Money cents={r.cur.incomeCents} />} />
        <Stat
          label="Ahorro"
          value={<Money cents={savings} />}
          hint={
            r.cur.incomeCents ? `${percent(savings, r.cur.incomeCents)} % de tu ingreso` : undefined
          }
        />
      </div>
      <Segmented<Tab>
        label="Tipo de reporte"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'categories', label: 'Categorías' },
          { value: 'trend', label: 'Tendencia' },
          { value: 'compare', label: 'Comparar' },
          ...(expert ? [{ value: 'advanced' as Tab, label: 'Avanzado' }] : []),
        ]}
      />

      {tab === 'categories' &&
        (top.length === 0 ? (
          <EmptyState emoji="📊" title="Sin gastos este mes" />
        ) : (
          <Card>
            <CardTitle>¿En qué se fue tu dinero?</CardTitle>
            <ul className="space-y-3">
              {top.map(([c, v]) => (
                <li key={c}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-ink">
                      {catMap.get(c)?.emoji} {catMap.get(c)?.name ?? c}
                    </span>
                    <span className="shrink-0 text-muted">
                      <Money cents={v} className="font-semibold text-ink" /> ·{' '}
                      {percent(v, r.cur.spentCents)} %
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(v / max) * 100}%`, background: CHART.single }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {tab === 'trend' && (
        <Card>
          <CardTitle>Ingresos vs. gastos (6 meses)</CardTitle>
          <div
            className="h-64"
            role="img"
            aria-label="Gráfica de ingresos contra gastos de los últimos 6 meses"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={r.trend}
                barGap={2}
                margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART.axis, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yTick}
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip formatter={(v) => tipFmt(Number(v))} {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13, color: 'var(--ink)' }} />
                <Bar dataKey="Ingresos" fill={CHART.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Gastos" fill={CHART.spending} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Ingresos, gastos y tasa de ahorro por mes</caption>
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Mes</th>
                <th className="py-1 text-right font-medium">Ingresos</th>
                <th className="py-1 text-right font-medium">Gastos</th>
                <th className="py-1 text-right font-medium">Ahorro</th>
              </tr>
            </thead>
            <tbody>
              {r.trend.map((m) => (
                <tr key={m.key} className="border-t border-line">
                  <td className="py-1.5 text-ink">{formatMonthKey(m.key)}</td>
                  <td className="py-1.5 text-right">
                    <Money cents={Math.round(m.Ingresos * 100)} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={Math.round(m.Gastos * 100)} />
                  </td>
                  <td
                    className={cx(
                      'py-1.5 text-right font-semibold',
                      (m.savingsRate ?? 0) < 0 ? 'text-rose-600' : 'text-ink',
                    )}
                  >
                    {m.savingsRate === null ? '—' : `${m.savingsRate} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'compare' && (
        <Card>
          <CardTitle>
            {formatMonthKey(month, false)} vs. {formatMonthKey(addMonthsKey(month, -1), false)}
          </CardTitle>
          <ul className="divide-y divide-line">
            {r.compare.slice(0, 15).map(({ c, now, before }) => {
              const d = now - before;
              return (
                <li key={c} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate text-ink">
                    {catMap.get(c)?.emoji} {catMap.get(c)?.name ?? c}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Money cents={now} className="font-semibold text-ink" />
                    <span
                      className={cx(
                        'w-24 text-right font-medium',
                        d > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-income',
                      )}
                    >
                      {d > 0 ? '▲' : d < 0 ? '▼' : '='} <Money cents={Math.abs(d)} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'advanced' && (
        <>
          <Card>
            <CardTitle>¿Qué día de la semana gastas más?</CardTitle>
            <div className="h-48" role="img" aria-label="Gasto por día de la semana">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.byWeekday} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: CHART.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={yTick}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip formatter={(v) => tipFmt(Number(v))} {...tooltipStyle} />
                  <Bar dataKey="Gasto" fill={CHART.single} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardTitle>Mapa de calor del mes</CardTitle>
            <Heatmap month={month} byDay={r.byDay} />
          </Card>
          <Card>
            <CardTitle>Dónde más gastas</CardTitle>
            <ul className="divide-y divide-line">
              {r.merchants.map((m) => (
                <li key={m.name} className="flex justify-between py-2 text-sm">
                  <span className="truncate text-ink">
                    {m.name} <span className="text-muted">· {m.count}×</span>
                  </span>
                  <Money cents={m.total} className="font-semibold text-ink" />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Heatmap({ month, byDay }: { month: string; byDay: Record<string, number> }) {
  const first = monthStart(month);
  const last = monthEnd(month);
  const offset = (weekday(first) + 6) % 7; // lunes primero
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  const max = Math.max(1, ...Object.values(byDay));
  const privacy = useData((s) => s.settings.privacyMode);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[0.7rem] text-muted">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {days.map((d) => {
          const v = byDay[d] ?? 0;
          const step = v
            ? Math.min(
                CHART.sequential.length - 1,
                Math.floor((v / max) * (CHART.sequential.length - 1)) + 1,
              )
            : -1;
          return (
            <div
              key={d}
              title={`${Number(d.slice(8))}: ${privacy ? '••••' : formatMoney(v)}`}
              aria-label={`Día ${Number(d.slice(8))}: ${formatMoney(v)}`}
              className={cx(
                'flex aspect-square items-center justify-center rounded-md text-[0.7rem] font-medium',
                step >= 4 ? 'text-white' : 'text-ink',
              )}
              style={{ background: step >= 0 ? CHART.sequential[step] : 'var(--surface-2)' }}
            >
              {Number(d.slice(8))}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[0.7rem] text-muted">
        Menos
        {CHART.sequential.map((c) => (
          <span key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
        ))}
        Más
      </div>
    </div>
  );
}
