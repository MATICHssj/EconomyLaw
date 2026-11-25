import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  INVESTMENT_TYPES,
  futureValue,
  investmentReturn,
  newId,
  todayISO,
  type Investment,
} from '@fina/core';
import { deleteDoc, saveDoc } from '@/lib/actions';
import { useData } from '@/stores/data';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Money,
  MoneyInput,
  PageHeader,
  Select,
  Sheet,
  Stat,
  Tip,
  cx,
} from '@/components/ui';

const TYPE_LABELS: Record<Investment['type'], string> = {
  cetes: '🇲🇽 CETES',
  afore: '👵 Afore',
  fund: '📦 Fondo',
  stock: '📈 Acciones/ETF',
  crypto: '🪙 Cripto',
  pagare: '🏦 Pagaré',
  ppr: '🧓 PPR',
  other: '💼 Otra',
};

export default function InvestmentsPage() {
  const investments = useData((s) => s.data.investments);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [contrib, setContrib] = useState<Investment | null>(null);
  const active = investments.filter((i) => !i.archived);
  const totals = active.reduce(
    (acc, i) => {
      const r = investmentReturn(i);
      return {
        value: acc.value + i.currentValueCents,
        contributed: acc.contributed + r.contributedCents,
      };
    },
    { value: 0, contributed: 0 },
  );
  const blank = (): Investment => ({
    id: newId(),
    name: '',
    type: 'cetes',
    contributions: [],
    currentValueCents: 0,
    expectedAnnualRate: 0.075,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    archived: false,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inversiones"
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> Inversión
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Valor actual" value={<Money cents={totals.value} />} />
        <Stat
          label="Ganancia"
          value={<Money cents={totals.value - totals.contributed} signed />}
          hint={
            totals.contributed
              ? `${Math.round(((totals.value - totals.contributed) / totals.contributed) * 1000) / 10} %`
              : undefined
          }
        />
      </div>
      {active.length === 0 ? (
        <EmptyState
          emoji="📈"
          title="Pon tu dinero a trabajar"
          text='Registra tus CETES, Afore, fondos o acciones. También puedes escribir "cetes 5000".'
          action={<Button onClick={() => setEditing(blank())}>Agregar inversión</Button>}
        />
      ) : (
        active.map((inv) => {
          const r = investmentReturn(inv);
          const in5 = futureValue(inv.currentValueCents, 0, inv.expectedAnnualRate ?? 0, 60);
          return (
            <Card key={inv.id}>
              <button type="button" className="w-full text-left" onClick={() => setEditing(inv)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{inv.name}</p>
                    <p className="text-sm text-muted">
                      {TYPE_LABELS[inv.type]}
                      {inv.expectedAnnualRate
                        ? ` · ~${Math.round(inv.expectedAnnualRate * 1000) / 10} % anual`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money cents={inv.currentValueCents} className="text-lg font-bold text-ink" />
                    {r.contributedCents > 0 && (
                      <p
                        className={cx(
                          'text-sm font-medium',
                          r.gainCents >= 0 ? 'text-income' : 'text-rose-600',
                        )}
                      >
                        {r.gainCents >= 0 ? '+' : ''}
                        {r.gainPct} %
                      </p>
                    )}
                  </div>
                </div>
              </button>
              <p className="mt-2 text-sm text-muted">
                Aportado <Money cents={r.contributedCents} /> · en 5 años valdría ~
                <Money cents={in5} /> (sin aportar más)
              </p>
              <Button size="sm" variant="soft" className="mt-2" onClick={() => setContrib(inv)}>
                + Aportación / actualizar valor
              </Button>
            </Card>
          );
        })
      )}
      <Tip>
        CETES: invierte desde $100 en cetesdirecto.com, respaldado por el Gobierno de México. Para
        tu retiro, las aportaciones voluntarias a tu Afore o un PPR pueden ser deducibles.
      </Tip>
      <InvestmentSheet value={editing} onClose={() => setEditing(null)} />
      <ContributionSheet inv={contrib} onClose={() => setContrib(null)} />
    </div>
  );
}

function InvestmentSheet({ value, onClose }: { value: Investment | null; onClose: () => void }) {
  const [d, setD] = useState<Investment | null>(value);
  const exists = useData((s) => s.data.investments.some((i) => i.id === value?.id));
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar inversión' : 'Nueva inversión'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button
              variant="secondary"
              aria-label="Borrar"
              onClick={() => {
                void deleteDoc('investments', d.id, 'Inversión borrada');
                onClose();
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!d.name}
            onClick={() => {
              void saveDoc(
                'investments',
                { ...d, updatedAt: new Date().toISOString() },
                'Inversión guardada',
              );
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
          placeholder="Ej. CETES 28 días"
        />
        <Select
          label="Tipo"
          value={d.type}
          onChange={(e) => setD({ ...d, type: e.target.value as Investment['type'] })}
          options={INVESTMENT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        />
        <MoneyInput
          label="Valor actual"
          value={d.currentValueCents}
          onChange={(v) => setD({ ...d, currentValueCents: v })}
        />
        <Input
          label="Rendimiento anual esperado (%)"
          type="number"
          step="0.1"
          value={Math.round((d.expectedAnnualRate ?? 0) * 1000) / 10}
          onChange={(e) => setD({ ...d, expectedAnnualRate: (Number(e.target.value) || 0) / 100 })}
          hint="Solo para proyecciones. No es una promesa de rendimiento."
        />
      </div>
    </Sheet>
  );
}

function ContributionSheet({ inv, onClose }: { inv: Investment | null; onClose: () => void }) {
  const [amount, setAmount] = useState(0);
  const [value, setValue] = useState(0);
  useEffect(() => {
    setAmount(0);
    setValue(inv?.currentValueCents ?? 0);
  }, [inv]);
  if (!inv) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={inv.name}
      footer={
        <Button
          block
          onClick={() => {
            void saveDoc(
              'investments',
              {
                ...inv,
                contributions: amount
                  ? [...inv.contributions, { date: todayISO(), amountCents: amount }]
                  : inv.contributions,
                currentValueCents: value + amount,
                updatedAt: new Date().toISOString(),
              },
              'Inversión actualizada',
            );
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-3">
        <MoneyInput label="Nueva aportación (opcional)" value={amount} onChange={setAmount} />
        <MoneyInput
          label="Valor actual antes de la aportación"
          value={value}
          onChange={setValue}
          hint="Cópialo de tu app de inversión para ver tu rendimiento real."
        />
      </div>
    </Sheet>
  );
}
