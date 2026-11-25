import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BellRing, CreditCard, Plus, TriangleAlert } from 'lucide-react';
import {
  addDays,
  formatLongDate,
  formatMonthKey,
  newId,
  todayISO,
  FREQUENCIES,
  FREQUENCY_LABELS,
  RecurringSchema,
  type Recurring,
  type Transaction,
  type UpcomingItem,
} from '@fina/core';
import { EmojiIcon } from '@/components/icons';
import { commitWithUndo, defaultAccountId, payRecurring, saveDoc } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
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
  Stat,
  Tip,
  cx,
} from '@/components/ui';
import { CategoryPicker } from '@/features/transactions/CategoryPicker';

function when(u: UpcomingItem): string {
  if (u.daysUntil < 0) return `Venció hace ${-u.daysUntil} ${u.daysUntil === -1 ? 'día' : 'días'}`;
  if (u.daysUntil === 0) return 'Hoy';
  if (u.daysUntil === 1) return 'Mañana';
  return `En ${u.daysUntil} días · ${formatLongDate(u.date)}`;
}

export default function PaymentsPage() {
  const f = useFinance();
  const recurring = useData((s) => s.data.recurring);
  const accounts = useData((s) => s.data.accounts);
  const [reminder, setReminder] = useState<Recurring | null>(null);
  const [payCard, setPayCard] = useState<{ accountId: string; amountCents: number } | null>(null);

  const out = useMemo(() => f.upcoming.filter((u) => u.direction === 'out'), [f.upcoming]);
  const overdue = f.overdue.filter((u) => u.direction === 'out');
  const week = out.filter((u) => u.daysUntil <= 7);
  const later = out.filter((u) => u.daysUntil > 7);
  // Los MSI van dentro del pago de la tarjeta: no se suman dos veces.
  const sum = (list: UpcomingItem[]) =>
    list.filter((u) => u.type !== 'installment').reduce((s, u) => s + u.amountCents, 0);

  const blankReminder = (): Recurring =>
    RecurringSchema.parse({
      id: newId(),
      name: '',
      template: {
        kind: 'expense',
        amountCents: 0,
        accountId: defaultAccountId(),
        categoryId: 'utilities',
        description: '',
      },
      frequency: 'once',
      nextDate: addDays(todayISO(), 7),
      remindDaysBefore: 2,
      autoCreate: false,
      createdAt: new Date().toISOString(),
    });

  const action = (u: UpcomingItem) => {
    if (u.type === 'recurring') {
      const r = recurring.find((x) => x.id === u.refId);
      if (!r || r.nextDate !== u.date) return null;
      return (
        <Button size="sm" variant="soft" onClick={() => void payRecurring(r)}>
          Ya lo pagué
        </Button>
      );
    }
    if (u.type === 'card' && u.refId)
      return (
        <Button
          size="sm"
          variant="soft"
          onClick={() => setPayCard({ accountId: u.refId!, amountCents: u.amountCents })}
        >
          Pagar
        </Button>
      );
    if (u.type === 'trip')
      return (
        <Link to={`/viajes/${u.refId}`} className="text-sm font-semibold text-accent-700">
          Apartar
        </Link>
      );
    if (u.type === 'tanda')
      return (
        <Link to="/tandas" className="text-sm font-semibold text-accent-700">
          Ver
        </Link>
      );
    if (u.type === 'loan')
      return (
        <Link to="/personas" className="text-sm font-semibold text-accent-700">
          Ver
        </Link>
      );
    return null;
  };

  const row = (u: UpcomingItem) => (
    <li key={u.id} className="flex items-center gap-3 py-2.5">
      <span
        className={cx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          u.daysUntil < 0
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
            : 'bg-surface-2 text-ink/70',
        )}
      >
        <EmojiIcon emoji={u.emoji} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{u.title}</p>
        <p className={cx('text-sm', u.daysUntil < 0 ? 'text-rose-600' : 'text-muted')}>
          {when(u)}
          {u.type === 'installment' && ' · va en tu tarjeta'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Money cents={u.amountCents} className="font-semibold text-ink" />
        {action(u)}
      </div>
    </li>
  );

  const empty = !overdue.length && !out.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos pendientes"
        subtitle="Qué pagar, cuánto y cuándo. Te aviso antes."
        back
        actions={
          <Button size="sm" onClick={() => setReminder(blankReminder())}>
            <Plus className="h-4 w-4" /> Recordatorio
          </Button>
        }
      />

      {f.expiringCards.map((c) => (
        <Card
          key={c.accountId}
          className="flex items-start gap-3 border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-ink">
            {c.daysLeft < 0 ? 'Venció' : 'Vence pronto'} tu tarjeta <b>{c.name}</b>
            {c.last4 && ` •${c.last4}`} ({formatMonthKey(c.expiry)}). Pide la nueva a tu banco y
            actualiza tus domiciliaciones.
          </p>
        </Card>
      ))}

      {!empty && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <Stat label="Próximos 7 días" value={<Money cents={sum([...overdue, ...week])} />} />
          </Card>
          <Card>
            <Stat label="Próximos 30 días" value={<Money cents={sum([...overdue, ...out])} />} />
          </Card>
        </div>
      )}

      {overdue.length > 0 && (
        <Card className="border-rose-200 dark:border-rose-900">
          <CardTitle>
            <span className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <TriangleAlert className="h-5 w-5" /> Vencidos
            </span>
          </CardTitle>
          <ul className="divide-y divide-line">{overdue.map(row)}</ul>
        </Card>
      )}
      {week.length > 0 && (
        <Card>
          <CardTitle>Esta semana</CardTitle>
          <ul className="divide-y divide-line">{week.map(row)}</ul>
        </Card>
      )}
      {later.length > 0 && (
        <Card>
          <CardTitle>Este mes</CardTitle>
          <ul className="divide-y divide-line">{later.map(row)}</ul>
        </Card>
      )}
      {empty && (
        <EmptyState
          emoji="i:calendarClock"
          title="Nada pendiente por ahora"
          text="Agrega recordatorios (predial, tenencia, colegiatura, seguro) o tus pagos fijos (renta, luz, internet). Con tus tarjetas configuradas también te aviso su fecha límite."
          action={
            <Button onClick={() => setReminder(blankReminder())}>
              <Plus className="h-4 w-4" /> Agregar recordatorio
            </Button>
          }
        />
      )}

      <Card className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        <div className="text-sm">
          <p className="text-ink">
            Te aviso antes de cada pago: en el teléfono (APK) aunque no tengas internet, y por
            WhatsApp o notificación cuando tengas cuenta.
          </p>
          <Link to="/ajustes" className="mt-1 inline-block font-semibold text-accent-700">
            Configurar avisos
          </Link>
        </div>
      </Card>
      <Tip>
        Los pagos que se repiten (renta, internet, Netflix) también están en{' '}
        <Link to="/recurrentes" className="font-semibold text-accent-700">
          Recurrentes
        </Link>
        . Las tarjetas toman su fecha límite de{' '}
        <Link to="/tarjetas" className="font-semibold text-accent-700">
          Tarjetas
        </Link>
        .
      </Tip>

      <ReminderSheet value={reminder} onClose={() => setReminder(null)} />
      <PayCardSheet value={payCard} accounts={accounts} onClose={() => setPayCard(null)} />
    </div>
  );
}

function ReminderSheet({ value, onClose }: { value: Recurring | null; onClose: () => void }) {
  const [d, setD] = useState<Recurring | null>(value);
  const accounts = useData((s) => s.data.accounts);
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  const t = d.template;
  const setT = (patch: Partial<Recurring['template']>) =>
    setD({ ...d, template: { ...t, ...patch } });
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title="Nuevo recordatorio de pago"
      footer={
        <Button
          block
          disabled={!d.name.trim() || !t.amountCents}
          onClick={() => {
            void saveDoc(
              'recurring',
              { ...d, name: d.name.trim(), template: { ...t, description: d.name.trim() } },
              'Recordatorio guardado',
            );
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          label="¿Qué hay que pagar?"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder="Ej. Predial, tenencia, colegiatura"
          maxLength={60}
          autoFocus
        />
        <MoneyInput
          label="Monto"
          value={t.amountCents}
          onChange={(v) => setT({ amountCents: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha límite"
            type="date"
            value={d.nextDate}
            onChange={(e) => setD({ ...d, nextDate: e.target.value || d.nextDate })}
          />
          <Select
            label="Se repite"
            value={d.frequency}
            onChange={(e) => setD({ ...d, frequency: e.target.value as Recurring['frequency'] })}
            options={FREQUENCIES.map((x) => ({ value: x, label: FREQUENCY_LABELS[x] }))}
          />
        </div>
        <Select
          label="Avisarme"
          value={String(d.remindDaysBefore)}
          onChange={(e) => setD({ ...d, remindDaysBefore: Number(e.target.value) })}
          options={[0, 1, 2, 3, 5, 7, 15].map((n) => ({
            value: String(n),
            label: n === 0 ? 'El mismo día' : `${n} ${n === 1 ? 'día' : 'días'} antes`,
          }))}
        />
        <Select
          label="Se paga con"
          value={t.accountId ?? ''}
          onChange={(e) => setT({ accountId: e.target.value || null })}
          options={[
            { value: '', label: 'Sin cuenta' },
            ...accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Categoría</p>
          <CategoryPicker value={t.categoryId} onChange={(c) => setT({ categoryId: c })} />
        </div>
        {d.frequency === 'once' && (
          <p className="text-xs text-muted">
            Cuando lo marques como pagado se registra el gasto y el recordatorio se cierra.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function PayCardSheet({
  value,
  accounts,
  onClose,
}: {
  value: { accountId: string; amountCents: number } | null;
  accounts: ReturnType<typeof useData.getState>['data']['accounts'];
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState('');
  const card = accounts.find((a) => a.id === value?.accountId);
  useEffect(() => {
    if (!value) return;
    setAmount(value.amountCents);
    setFrom(defaultAccountId('debit') ?? '');
  }, [value]);
  if (!value || !card) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Pagar ${card.name}`}
      footer={
        <Button
          block
          disabled={!amount}
          onClick={async () => {
            const stamp = new Date().toISOString();
            const tx: Transaction = {
              id: newId(),
              kind: 'debt_payment',
              amountCents: amount,
              currency: 'MXN',
              amountMxnCents: amount,
              accountId: from || null,
              toAccountId: card.id,
              categoryId: null,
              tags: [],
              description: `Pago ${card.name}`,
              date: todayISO(),
              createdAt: stamp,
              updatedAt: stamp,
              source: 'app',
              status: 'cleared',
              reconciled: false,
              attachments: [],
            };
            const space = (card as { space?: 'personal' | 'household' }).space ?? 'personal';
            await commitWithUndo(
              [{ space, col: 'transactions', before: null, after: tx }],
              `Pago a ${card.name} registrado`,
            );
            onClose();
          }}
        >
          Registrar pago
        </Button>
      }
    >
      <div className="space-y-3">
        <MoneyInput label="Monto" value={amount} onChange={setAmount} />
        <p className="-mt-1 text-xs text-muted">
          Sugerido: el pago para no generar intereses (<Money cents={value.amountCents} />
          ).
        </p>
        <Select
          label="Sale de"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          options={[
            { value: '', label: 'Sin cuenta' },
            ...accounts
              .filter((a) => !a.archived && a.type !== 'credit')
              .map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <Badge tone="accent">Solo se registra en Fina; el pago lo haces en tu banco.</Badge>
      </div>
    </Sheet>
  );
}
