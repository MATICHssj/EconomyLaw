import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  daysBetween,
  formatLongDate,
  monthlyEquivalent,
  newId,
  todayISO,
  type Recurring,
} from '@fina/core';
import { deleteDoc, payRecurring, saveDoc } from '@/lib/actions';
import { useCategoryMap, useFinance } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
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
  Segmented,
  Select,
  Sheet,
  Toggle,
} from '@/components/ui';
import { CategoryPicker } from '@/features/transactions/CategoryPicker';

export default function RecurringPage() {
  const recurring = useDocs('recurring');
  const f = useFinance();
  const catMap = useCategoryMap();
  const [editing, setEditing] = useState<Recurring | null>(null);
  const today = todayISO();
  const active = recurring
    .filter((r) => r.active)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const subsMonthly = active
    .filter((r) => r.isSubscription || r.template.categoryId === 'subscriptions')
    .reduce((s, r) => s + monthlyEquivalent(r.template.amountCents, r.frequency), 0);
  const outMonthly = active
    .filter((r) => r.template.kind !== 'income')
    .reduce((s, r) => s + monthlyEquivalent(r.template.amountCents, r.frequency), 0);

  const blank = (): Recurring => ({
    id: newId(),
    name: '',
    template: {
      kind: 'expense',
      amountCents: 0,
      currency: 'MXN',
      accountId: null,
      categoryId: 'subscriptions',
      description: '',
      tags: [],
    },
    frequency: 'monthly',
    nextDate: today,
    remindDaysBefore: 2,
    autoCreate: false,
    active: true,
    isSubscription: false,
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recurrentes"
        subtitle="Renta, servicios, suscripciones y tu quincena."
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-xs text-muted">Pagos fijos al mes</p>
          <Money cents={outMonthly} className="text-xl font-bold text-ink" />
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted">Suscripciones al mes</p>
          <Money cents={subsMonthly} className="text-xl font-bold text-ink" />
          <p className="text-xs text-muted">
            = <Money cents={subsMonthly * 12} /> al año
          </p>
        </Card>
      </div>

      {f.subscriptions.length > 0 && (
        <Card className="border-accent-200 dark:border-accent-900">
          <CardTitle>🔎 Detecté cargos que se repiten</CardTitle>
          <ul className="space-y-2">
            {f.subscriptions.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className="text-xl">{catMap.get(s.categoryId ?? '')?.emoji ?? '🔁'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{s.name}</p>
                  <p className="text-sm text-muted">
                    <Money cents={s.amountCents} /> · {FREQUENCY_LABELS[s.frequency].toLowerCase()}{' '}
                    · {s.occurrences} veces
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() =>
                    void saveDoc(
                      'recurring',
                      {
                        ...blank(),
                        name: s.name,
                        frequency: s.frequency,
                        nextDate: s.nextDate,
                        isSubscription: s.categoryId === 'subscriptions',
                        template: {
                          kind: 'expense',
                          amountCents: s.amountCents,
                          currency: 'MXN',
                          accountId: s.accountId,
                          categoryId: s.categoryId,
                          description: s.name,
                          merchant: s.name,
                          tags: [],
                        },
                      },
                      `${s.name} agregado a recurrentes`,
                    )
                  }
                >
                  Agregar
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            💡 ¿Ya no la usas? Cancélala desde la app del servicio y ahorra.
          </p>
        </Card>
      )}

      {active.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title="Sin pagos recurrentes"
          text='Escribe "netflix 299 cada mes" o agrégalos aquí. Te aviso antes de que se cobren.'
          action={<Button onClick={() => setEditing(blank())}>Agregar recurrente</Button>}
        />
      ) : (
        <Card className="p-2">
          {active.map((r) => {
            const days = daysBetween(today, r.nextDate);
            const cat = catMap.get(r.template.categoryId ?? '');
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setEditing(r)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-xl">
                    {r.template.kind === 'income' ? '💰' : (cat?.emoji ?? '🔁')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {r.name} {r.autoCreate && <Badge>auto</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {FREQUENCY_LABELS[r.frequency]} ·{' '}
                      {days < 0
                        ? `venció hace ${-days} d`
                        : days === 0
                          ? 'hoy'
                          : `en ${days} d (${formatLongDate(r.nextDate)})`}
                    </p>
                  </div>
                </button>
                <div className="text-right">
                  <Money
                    cents={r.template.amountCents}
                    kind={r.template.kind === 'income' ? 'income' : 'neutral'}
                    className="font-semibold text-ink"
                  />
                  {days <= 3 && (
                    <button
                      type="button"
                      className="block text-xs font-semibold text-accent-600"
                      onClick={() => void payRecurring(r)}
                    >
                      {r.template.kind === 'income' ? 'Ya me pagaron' : 'Ya lo pagué'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <RecurringSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RecurringSheet({ value, onClose }: { value: Recurring | null; onClose: () => void }) {
  const [d, setD] = useState<Recurring | null>(value);
  const accounts = useData((s) => s.data.accounts);
  const exists = useData((s) => s.data.recurring.some((r) => r.id === value?.id));
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  const setT = (patch: Partial<Recurring['template']>) =>
    setD({ ...d, template: { ...d.template, ...patch } });
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar recurrente' : 'Nuevo recurrente'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button
              variant="secondary"
              aria-label="Borrar"
              onClick={() => {
                void deleteDoc('recurring', d.id);
                onClose();
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!d.name || !d.template.amountCents}
            onClick={() => {
              void saveDoc(
                'recurring',
                {
                  ...d,
                  template: { ...d.template, description: d.template.description || d.name },
                  isSubscription: d.isSubscription || d.template.categoryId === 'subscriptions',
                },
                'Guardado',
              );
              onClose();
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={d.template.kind === 'income' ? 'income' : 'expense'}
          onChange={(k) =>
            setT({ kind: k, categoryId: k === 'income' ? 'salary' : 'subscriptions' })
          }
          options={[
            { value: 'expense', label: 'Pago' },
            { value: 'income', label: 'Ingreso' },
          ]}
        />
        <Input
          label="Nombre"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder="Ej. Renta, Netflix, Quincena"
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput
            label="Monto"
            value={d.template.amountCents}
            onChange={(v) => setT({ amountCents: v })}
          />
          <Select
            label="Frecuencia"
            value={d.frequency}
            onChange={(e) => setD({ ...d, frequency: e.target.value as Recurring['frequency'] })}
            options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Próxima fecha"
            type="date"
            value={d.nextDate}
            onChange={(e) => e.target.value && setD({ ...d, nextDate: e.target.value })}
          />
          <Input
            label="Avisarme días antes"
            type="number"
            min={0}
            max={30}
            value={d.remindDaysBefore}
            onChange={(e) => setD({ ...d, remindDaysBefore: Number(e.target.value) || 0 })}
          />
        </div>
        <Select
          label="Cuenta"
          value={d.template.accountId ?? ''}
          onChange={(e) => setT({ accountId: e.target.value || null })}
          options={[
            { value: '', label: 'Cuenta por defecto' },
            ...accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Categoría</p>
          <CategoryPicker
            value={d.template.categoryId}
            type={d.template.kind === 'income' ? 'income' : 'expense'}
            onChange={(c) => setT({ categoryId: c })}
          />
        </div>
        <Toggle
          label="Registrar automáticamente"
          description="Al llegar la fecha lo anoto yo (útil para renta o quincena fija)."
          checked={d.autoCreate}
          onChange={(v) => setD({ ...d, autoCreate: v })}
        />
        <Toggle label="Activo" checked={d.active} onChange={(v) => setD({ ...d, active: v })} />
      </div>
    </Sheet>
  );
}
