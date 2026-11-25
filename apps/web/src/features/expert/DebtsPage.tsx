import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import {
  compareStrategies,
  formatLongDate,
  formatMoney,
  newId,
  todayISO,
  type Debt,
  type DebtInput,
} from '@fina/core';
import { deleteDoc, saveDoc } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
import { markSeen } from '@/features/academy/missions';
import { useData } from '@/stores/data';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  Money,
  MoneyInput,
  PageHeader,
  Select,
  Sheet,
  Tip,
} from '@/components/ui';
import { CHART, tooltipStyle } from '@/features/reports/chartTheme';

const KIND_LABELS: Record<Debt['kind'], string> = {
  credit_card: 'Tarjeta',
  personal: 'Préstamo personal',
  car: 'Auto',
  mortgage: 'Hipoteca',
  student: 'Estudios',
  family: 'Familiar',
  other: 'Otra',
};

export default function DebtsPage() {
  const debts = useData((s) => s.data.debts);
  const accounts = useData((s) => s.data.accounts);
  const privacy = useData((s) => s.settings.privacyMode);
  const f = useFinance();
  const [editing, setEditing] = useState<Debt | null>(null);
  useEffect(() => {
    markSeen('debts');
  }, []);

  // Las tarjetas con saldo también entran al plan automáticamente.
  const inputs: DebtInput[] = useMemo(() => {
    const list: DebtInput[] = debts
      .filter((d) => !d.archived)
      .map((d) => ({
        id: d.id,
        name: d.name,
        balanceCents: d.balanceCents,
        annualRate: d.annualRate,
        minPaymentCents: d.minPaymentCents,
      }));
    for (const a of accounts.filter((x) => x.type === 'credit' && !x.archived && x.credit)) {
      const owed = Math.max(0, -(f.balances[a.id] ?? 0));
      if (owed > 0 && !debts.some((d) => d.accountId === a.id))
        list.push({
          id: a.id,
          name: a.name,
          balanceCents: owed,
          annualRate: a.credit!.annualRate,
          minPaymentCents: Math.max(Math.round(owed * 0.05), 20000),
        });
    }
    return list;
  }, [debts, accounts, f.balances]);

  const minimums = inputs.reduce((s, d) => s + Math.min(d.minPaymentCents, d.balanceCents), 0);
  const [budget, setBudget] = useState(0);
  const monthly = budget || Math.round(minimums * 1.2);
  const today = todayISO();
  const res = useMemo(() => compareStrategies(inputs, monthly, today), [inputs, monthly, today]);
  const total = inputs.reduce((s, d) => s + d.balanceCents, 0);
  const chart = useMemo(() => {
    const n = Math.max(res.snowball.timeline.length, res.avalanche.timeline.length);
    const step = Math.max(1, Math.ceil(n / 36));
    return Array.from({ length: Math.ceil(n / step) + 1 }, (_, i) => {
      const m = i * step;
      return {
        mes: m,
        'Bola de nieve': m === 0 ? total / 100 : (res.snowball.timeline[m - 1] ?? 0) / 100,
        Avalancha: m === 0 ? total / 100 : (res.avalanche.timeline[m - 1] ?? 0) / 100,
      };
    });
  }, [res, total]);

  const blank = (): Debt => ({
    id: newId(),
    name: '',
    kind: 'personal',
    balanceCents: 0,
    annualRate: 0.3,
    minPaymentCents: 0,
    accountId: null,
    createdAt: new Date().toISOString(),
    archived: false,
  });
  const best =
    res.avalanche.feasible && res.snowball.feasible
      ? res.interestSavedWithAvalancheCents > 0
        ? 'avalanche'
        : 'snowball'
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salir de deudas"
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> Deuda
          </Button>
        }
      />
      {inputs.length === 0 ? (
        <EmptyState
          emoji="🎉"
          title="No tienes deudas registradas"
          text="Si tienes préstamos, créditos o tarjetas con saldo, agrégalos y te armo el plan más rápido y barato para liquidarlos."
          action={<Button onClick={() => setEditing(blank())}>Agregar deuda</Button>}
        />
      ) : (
        <>
          <Card>
            <p className="text-sm text-muted">Debes en total</p>
            <Money cents={total} className="text-3xl font-extrabold text-ink" />
            <ul className="mt-3 space-y-1.5">
              {inputs.map((d) => {
                const doc = debts.find((x) => x.id === d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={!doc}
                      onClick={() => doc && setEditing(doc)}
                      className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="text-ink">
                        {d.name}{' '}
                        <span className="text-muted">
                          · {Math.round(d.annualRate * 100)} % anual · mín.{' '}
                          <Money cents={d.minPaymentCents} />
                        </span>
                      </span>
                      <Money cents={d.balanceCents} className="font-semibold text-ink" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardTitle>Simulador</CardTitle>
            <MoneyInput
              label="¿Cuánto puedes destinar al mes a deudas?"
              value={monthly}
              onChange={setBudget}
              hint={
                <>
                  Los pagos mínimos suman <Money cents={minimums} />. Todo lo extra te ayuda a
                  terminar antes.
                </>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(
                [
                  [
                    'snowball',
                    'Bola de nieve',
                    'Primero la más chica: victorias rápidas que motivan.',
                  ],
                  ['avalanche', 'Avalancha', 'Primero la de mayor interés: pagas menos en total.'],
                ] as const
              ).map(([k, label, desc]) => {
                const r = res[k];
                return (
                  <div
                    key={k}
                    className={`rounded-2xl border-2 p-3 ${best === k ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-line'}`}
                  >
                    <p className="font-semibold text-ink">{label}</p>
                    {best === k && <Badge tone="good">Recomendado</Badge>}
                    <p className="mt-1 text-xs text-muted">{desc}</p>
                    {r.feasible ? (
                      <>
                        <p className="mt-2 text-sm text-muted">Terminas de pagar en</p>
                        <p className="text-lg font-bold text-ink">{r.months} meses</p>
                        <p className="text-xs text-muted">
                          {r.payoffDate && formatLongDate(r.payoffDate, true)}
                        </p>
                        <p className="mt-2 text-sm text-muted">
                          Intereses:{' '}
                          <Money cents={r.totalInterestCents} className="font-semibold text-ink" />
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Orden: {r.order.map((o) => o.name).join(' → ')}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-rose-600">
                        Con ese monto la deuda no baja. Sube tu pago mensual.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {res.interestSavedWithAvalancheCents > 0 && (
              <p className="mt-3 text-sm text-ink">
                Con avalancha te ahorras{' '}
                <Money cents={res.interestSavedWithAvalancheCents} className="font-bold" /> en
                intereses.
              </p>
            )}
            {res.snowball.feasible && (
              <div
                className="mt-4 h-56"
                role="img"
                aria-label="Saldo de deuda restante por mes con cada estrategia"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis
                      dataKey="mes"
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
                      formatter={(v) =>
                        privacy ? '••••' : formatMoney(Math.round(Number(v) * 100))
                      }
                      labelFormatter={(l) => `Mes ${l}`}
                      {...tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line
                      type="monotone"
                      dataKey="Bola de nieve"
                      stroke={CHART.spending}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Avalancha"
                      stroke={CHART.income}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
      <Tip>
        Evita pagar solo el mínimo de tus tarjetas: con tasas de 60 % anual, una deuda de $10,000
        puede tardar años en liquidarse.
      </Tip>
      <DebtSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DebtSheet({ value, onClose }: { value: Debt | null; onClose: () => void }) {
  const [d, setD] = useState<Debt | null>(value);
  const exists = useData((s) => s.data.debts.some((x) => x.id === value?.id));
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar deuda' : 'Nueva deuda'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button
              variant="secondary"
              aria-label="Borrar"
              onClick={() => {
                void deleteDoc('debts', d.id, 'Deuda borrada');
                onClose();
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!d.name || !d.balanceCents}
            onClick={() => {
              void saveDoc('debts', d, 'Deuda guardada');
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input
          label="Nombre"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder="Ej. Crédito del auto"
        />
        <Select
          label="Tipo"
          value={d.kind}
          onChange={(e) => setD({ ...d, kind: e.target.value as Debt['kind'] })}
          options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <MoneyInput
          label="Saldo que debes hoy"
          value={d.balanceCents}
          onChange={(v) => setD({ ...d, balanceCents: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Interés anual (%)"
            type="number"
            step="0.1"
            min={0}
            value={Math.round(d.annualRate * 1000) / 10}
            onChange={(e) => setD({ ...d, annualRate: (Number(e.target.value) || 0) / 100 })}
          />
          <MoneyInput
            label="Pago mínimo mensual"
            value={d.minPaymentCents}
            onChange={(v) => setD({ ...d, minPaymentCents: v })}
          />
        </div>
      </div>
    </Sheet>
  );
}
