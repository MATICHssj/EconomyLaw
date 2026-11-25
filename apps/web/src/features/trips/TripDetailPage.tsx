import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, Clock, MapPin, Pencil, PiggyBank, Plus, Sparkles, Wallet, X } from 'lucide-react';
import {
  addDays,
  formatLongDate,
  formatMonthKey,
  formatShortDate,
  newId,
  todayISO,
  tripCandidates,
  tripFundingPlan,
  tripSummary,
  weekday,
  TRIP_BUCKETS,
  TRIP_BUCKET_INFO,
  TRIP_ITEM_INFO,
  TRIP_ITEM_TYPES,
  WEEKDAYS_ES,
  type ISODate,
  type Transaction,
  type Trip,
  type TripFunding,
  type TripItem,
} from '@fina/core';
import { iconFromValue, IconTile } from '@/components/icons';
import { commitWithUndo, defaultAccountId, saveDoc, type Change } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
import { useData, type WithSpace } from '@/stores/data';
import { useUI } from '@/stores/ui';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Chip,
  EmptyState,
  Input,
  Money,
  MoneyInput,
  PageHeader,
  ProgressBar,
  Segmented,
  Select,
  Sheet,
  Stat,
  Tip,
  Toggle,
  cx,
} from '@/components/ui';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TripIcon } from './TripIcon';
import { TripSheet } from './TripSheet';

type Tab = 'resumen' | 'itinerario' | 'gastos' | 'pago';

const strip = <T extends object>(doc: T & { space?: unknown }): T => {
  const { space: _s, ...rest } = doc;
  return rest as T;
};

export default function TripDetailPage() {
  const { id } = useParams();
  const trip = useData((s) => s.data.trips.find((t) => t.id === id));
  const transactions = useData((s) => s.data.transactions);
  const { today } = useFinance();
  const [tab, setTab] = useState<Tab>('resumen');
  const [editing, setEditing] = useState<Trip | null>(null);

  const summary = useMemo(
    () => (trip ? tripSummary(trip, transactions, today) : null),
    [trip, transactions, today],
  );
  const candidates = useMemo(() => {
    if (!trip) return [];
    // Lo que ya está en otro viaje no se sugiere.
    const elsewhere = new Set(
      transactions.filter((t) => t.tripId && t.tripId !== trip.id).map((t) => t.id),
    );
    return tripCandidates(trip, transactions, elsewhere);
  }, [trip, transactions]);

  if (!trip || !summary) {
    return (
      <div className="space-y-4">
        <PageHeader title="Viaje" back="/viajes" />
        <EmptyState
          emoji="i:luggage"
          title="No encontré este viaje"
          action={<Link to="/viajes">Ver mis viajes</Link>}
        />
      </div>
    );
  }
  const s = summary;

  return (
    <div className="space-y-4">
      <PageHeader
        title={trip.name}
        subtitle={trip.destination || undefined}
        back="/viajes"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing(trip)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        }
      />

      <Card className="bg-gradient-to-br from-accent-50 to-surface dark:from-accent-950/40 dark:to-surface">
        <div className="flex items-center gap-3">
          <TripIcon value={trip.icon} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              {formatLongDate(trip.startDate)} – {formatLongDate(trip.endDate, true)} · {s.days}{' '}
              {s.days === 1 ? 'día' : 'días'}
              {trip.travelers > 1 && ` · ${trip.travelers} personas`}
            </p>
            <p className="font-semibold text-ink">
              {s.status === 'active'
                ? `¡Estás de viaje! Día ${s.dayNumber} de ${s.days}`
                : s.status === 'planning'
                  ? s.daysUntil === 1
                    ? 'Sales mañana'
                    : `Faltan ${s.daysUntil} días`
                  : 'Viaje terminado'}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Presupuesto" value={<Money cents={s.budgetCents} />} />
          <Stat label="Gastado" value={<Money cents={s.spentCents} />} />
          <Stat
            label={s.remainingCents < 0 ? 'Te pasaste' : 'Te queda'}
            value={
              <Money
                cents={Math.abs(s.remainingCents)}
                className={s.remainingCents < 0 ? 'text-rose-600' : undefined}
              />
            }
          />
        </div>
        {s.status === 'active' && s.canSpendPerDayCents !== null && (
          <div className="mt-3 rounded-xl bg-surface/80 p-3 text-sm">
            Hoy puedes gastar{' '}
            <Money cents={s.canSpendPerDayCents} className="font-bold text-accent-700" /> allá
            (comida, transporte, actividades) · llevas <Money cents={s.todaySpentCents} />
          </div>
        )}
        <Button
          className="mt-3"
          block
          variant="soft"
          onClick={() => useUI.getState().openCapture('', trip.id)}
        >
          <Plus className="h-4 w-4" /> Anotar gasto del viaje
        </Button>
      </Card>

      {candidates.length > 0 && tab !== 'gastos' && (
        <button
          type="button"
          onClick={() => setTab('gastos')}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-left text-sm dark:border-amber-900 dark:bg-amber-950/30"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1 text-ink">
            Encontré <b>{candidates.length}</b>{' '}
            {candidates.length === 1 ? 'gasto que parece' : 'gastos que parecen'} de este viaje.
          </span>
          <span className="font-semibold text-accent-700">Revisar</span>
        </button>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'resumen', label: 'Resumen' },
          { value: 'itinerario', label: 'Itinerario' },
          { value: 'gastos', label: 'Gastos' },
          { value: 'pago', label: 'Pagarlo' },
        ]}
      />

      {tab === 'resumen' && <SummaryTab trip={trip} summary={s} onEdit={() => setEditing(trip)} />}
      {tab === 'itinerario' && <ItineraryTab trip={trip} today={today} />}
      {tab === 'gastos' && (
        <ExpensesTab trip={trip} candidates={candidates} linked={s.transactions} />
      )}
      {tab === 'pago' && <FundingTab trip={trip} total={s.budgetCents} today={today} />}

      <TripSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// ——————————————————— Resumen ———————————————————

function SummaryTab({
  trip,
  summary: s,
  onEdit,
}: {
  trip: Trip;
  summary: ReturnType<typeof tripSummary>;
  onEdit: () => void;
}) {
  if (s.budgetCents === 0 && s.spentCents === 0)
    return (
      <EmptyState
        emoji="i:wallet"
        title="Ponle presupuesto a tu viaje"
        text="Vuelos, hospedaje, comida, transporte, actividades y compras. Si no sabes, toca “Estimar” y yo te propongo montos."
        action={<Button onClick={onEdit}>Armar presupuesto</Button>}
      />
    );
  return (
    <>
      <Card>
        <CardTitle
          action={
            <button
              type="button"
              className="text-sm font-semibold text-accent-700"
              onClick={onEdit}
            >
              Ajustar
            </button>
          }
        >
          Por rubro
        </CardTitle>
        <ul className="space-y-3">
          {TRIP_BUCKETS.filter((b) => s.budgetByBucket[b] > 0 || s.spentByBucket[b] > 0).map(
            (b) => {
              const budget = s.budgetByBucket[b];
              const spent = s.spentByBucket[b];
              const pct = budget ? (spent / budget) * 100 : spent ? 100 : 0;
              const Icon = iconFromValue(TRIP_BUCKET_INFO[b].icon);
              return (
                <li key={b} className="flex items-center gap-3">
                  {Icon && <IconTile icon={Icon} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-ink">{TRIP_BUCKET_INFO[b].label}</span>
                      <span className="shrink-0 text-muted">
                        <Money cents={spent} className="text-ink" /> / <Money cents={budget} />
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1"
                      value={pct}
                      status={pct > 100.5 ? 'over' : pct >= 99.5 ? 'ok' : pct > 85 ? 'warn' : 'accent'}
                    />
                  </div>
                </li>
              );
            },
          )}
        </ul>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Stat
            label="Por día allá"
            value={<Money cents={s.dailyBudgetCents} />}
            hint="Comida, transporte, actividades y compras"
          />
        </Card>
        <Card>
          <Stat
            label={trip.travelers > 1 ? 'Por persona' : 'Itinerario'}
            value={<Money cents={trip.travelers > 1 ? s.perPersonCents : s.plannedCents} />}
            hint={trip.travelers > 1 ? `Entre ${trip.travelers}` : 'Suma de lo planeado'}
          />
        </Card>
      </div>
      {trip.notes && (
        <Card>
          <CardTitle>Notas</CardTitle>
          <p className="text-sm whitespace-pre-line text-ink">{trip.notes}</p>
        </Card>
      )}
    </>
  );
}

// ——————————————————— Itinerario ———————————————————

function dayLabel(date: ISODate, index: number): string {
  const wd = WEEKDAYS_ES[weekday(date)] ?? '';
  return `Día ${index + 1} · ${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${formatShortDate(date)}`;
}

function ItineraryTab({ trip, today }: { trip: WithSpace<Trip> | Trip; today: ISODate }) {
  const [item, setItem] = useState<TripItem | null>(null);
  const days: ISODate[] = [];
  for (let d = trip.startDate; d <= trip.endDate && days.length < 60; d = addDays(d, 1))
    days.push(d);
  const inRange = new Set(days);
  const sortItems = (a: TripItem, b: TripItem) =>
    (a.time ?? '99').localeCompare(b.time ?? '99') || a.title.localeCompare(b.title);
  const loose = trip.items.filter((i) => !i.date || !inRange.has(i.date)).sort(sortItems);
  const blank = (date: ISODate | null): TripItem => ({
    id: newId(),
    date,
    type: 'activity',
    title: '',
    costCents: 0,
    paid: false,
  });

  const row = (it: TripItem) => {
    const info = TRIP_ITEM_INFO[it.type];
    const Icon = iconFromValue(info.icon);
    return (
      <li key={it.id}>
        <button
          type="button"
          onClick={() => setItem(it)}
          className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-surface-2"
        >
          {Icon && <IconTile icon={Icon} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{it.title}</p>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
              {it.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {it.time}
                </span>
              )}
              {it.place && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {it.place}
                </span>
              )}
              {it.note && <span className="truncate">{it.note}</span>}
            </p>
          </div>
          {it.costCents > 0 && (
            <div className="text-right">
              <Money cents={it.costCents} className="text-sm font-semibold text-ink" />
              {it.paid && (
                <p className="text-xs text-emerald-600">
                  <Check className="inline h-3 w-3" /> pagado
                </p>
              )}
            </div>
          )}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setItem(
              blank(today >= trip.startDate && today <= trip.endDate ? today : trip.startDate),
            )
          }
        >
          <Plus className="h-4 w-4" /> Agregar al itinerario
        </Button>
      </div>
      {trip.items.length === 0 && (
        <EmptyState
          emoji="i:map"
          title="Arma tu itinerario"
          text="Vuelos, hotel, tours, comidas… día por día, con hora, lugar y costo. Lo que marques como pagado se registra como gasto del viaje."
        />
      )}
      {trip.items.length > 0 &&
        days.map((d, i) => {
          const list = trip.items.filter((it) => it.date === d).sort(sortItems);
          return (
            <Card key={d} className={cx(d === today && 'border-accent-400')}>
              <CardTitle
                action={
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent-700"
                    onClick={() => setItem(blank(d))}
                  >
                    + Agregar
                  </button>
                }
              >
                {dayLabel(d, i)} {d === today && <Badge tone="accent">hoy</Badge>}
              </CardTitle>
              {list.length ? (
                <ul className="-mx-2 space-y-1">{list.map(row)}</ul>
              ) : (
                <p className="text-sm text-muted">Día libre.</p>
              )}
            </Card>
          );
        })}
      {loose.length > 0 && (
        <Card>
          <CardTitle>Sin fecha</CardTitle>
          <ul className="-mx-2 space-y-1">{loose.map(row)}</ul>
        </Card>
      )}
      <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Sparkles className="h-4 w-4 text-accent-600" /> Próximamente
        </p>
        <p className="mt-1">
          Dile a Fina “arma 4 días en Oaxaca con $8,000” y te propondrá itinerario y presupuesto
          listos para ajustar.
        </p>
      </div>
      <ItemSheet trip={trip} days={days} value={item} onClose={() => setItem(null)} />
    </>
  );
}

const ITEM_CATEGORY: Record<TripItem['type'], string> = {
  flight: 'travel',
  lodging: 'travel',
  activity: 'entertainment',
  food: 'food',
  transport: 'transport',
  note: 'other',
};

function ItemSheet({
  trip,
  days,
  value,
  onClose,
}: {
  trip: Trip & { space?: WithSpace<Trip>['space'] };
  days: ISODate[];
  value: TripItem | null;
  onClose: () => void;
}) {
  const [d, setD] = useState<TripItem | null>(value);
  const [register, setRegister] = useState(true);
  const [accountId, setAccountId] = useState('');
  const accounts = useData((s) => s.data.accounts);
  const exists = !!value && trip.items.some((i) => i.id === value.id);
  useEffect(() => {
    setD(value);
    setRegister(true);
    setAccountId(defaultAccountId('credit') ?? defaultAccountId() ?? '');
  }, [value]);
  if (!d) return null;

  const willRegister = d.paid && d.costCents > 0 && !d.txId && register;

  async function save(next: TripItem | null) {
    const before = strip(trip);
    let item = next;
    const changes: Change[] = [];
    const space = trip.space ?? 'personal';
    if (item && willRegister) {
      const stamp = new Date().toISOString();
      const tx: Transaction = {
        id: newId(),
        kind: 'expense',
        amountCents: item.costCents,
        currency: 'MXN',
        amountMxnCents: item.costCents,
        accountId: accountId || null,
        toAccountId: null,
        categoryId: ITEM_CATEGORY[item.type],
        tags: [],
        description: item.title,
        merchant: item.place,
        date: todayISO(),
        createdAt: stamp,
        updatedAt: stamp,
        source: 'app',
        status: 'cleared',
        reconciled: false,
        attachments: [],
        tripId: trip.id,
      };
      item = { ...item, txId: tx.id };
      changes.push({ space, col: 'transactions', before: null, after: tx });
    }
    const items = item
      ? exists
        ? trip.items.map((i) => (i.id === item!.id ? item! : i))
        : [...trip.items, item]
      : trip.items.filter((i) => i.id !== value!.id);
    changes.push({ space, col: 'trips', before, after: { ...before, items } });
    await commitWithUndo(
      changes,
      !item
        ? 'Quitado del itinerario'
        : willRegister
          ? 'Guardado y registrado como gasto'
          : 'Itinerario guardado',
    );
    onClose();
  }

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar' : 'Agregar al itinerario'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button variant="secondary" onClick={() => void save(null)}>
              Quitar
            </Button>
          )}
          <Button
            block
            disabled={!d.title.trim()}
            onClick={() => void save({ ...d, title: d.title.trim() })}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TRIP_ITEM_TYPES.map((t) => (
            <Chip key={t} active={d.type === t} onClick={() => setD({ ...d, type: t })}>
              {TRIP_ITEM_INFO[t].label}
            </Chip>
          ))}
        </div>
        <Input
          label="¿Qué es?"
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder={
            d.type === 'flight'
              ? 'Ej. Vuelo CDMX → Cancún'
              : d.type === 'lodging'
                ? 'Ej. Hotel en zona hotelera'
                : d.type === 'food'
                  ? 'Ej. Cena en la playa'
                  : 'Ej. Tour a Isla Mujeres'
          }
          maxLength={80}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Día"
            value={d.date ?? ''}
            onChange={(e) => setD({ ...d, date: e.target.value || null })}
            options={[
              { value: '', label: 'Sin fecha' },
              ...days.map((x, i) => ({ value: x, label: `Día ${i + 1} · ${formatShortDate(x)}` })),
            ]}
          />
          <Input
            label="Hora"
            type="time"
            value={d.time ?? ''}
            onChange={(e) => setD({ ...d, time: e.target.value || undefined })}
          />
        </div>
        <Input
          label="Lugar (opcional)"
          value={d.place ?? ''}
          onChange={(e) => setD({ ...d, place: e.target.value || undefined })}
          maxLength={80}
        />
        <MoneyInput
          label="Costo (opcional)"
          value={d.costCents}
          onChange={(v) => setD({ ...d, costCents: v })}
          hint="Total para todos los que van."
        />
        {d.costCents > 0 && (
          <Toggle
            label="Ya está pagado"
            checked={d.paid}
            onChange={(v) => setD({ ...d, paid: v })}
          />
        )}
        {d.paid && d.costCents > 0 && !d.txId && (
          <div className="space-y-3 rounded-xl bg-surface-2 p-3">
            <Toggle
              label="Registrarlo como gasto del viaje"
              description="Se anota hoy en tus movimientos y cuenta en el presupuesto del viaje."
              checked={register}
              onChange={setRegister}
            />
            {register && (
              <Select
                label="¿Con qué pagaste?"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={[
                  { value: '', label: 'Sin cuenta' },
                  ...accounts
                    .filter((a) => !a.archived)
                    .map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            )}
          </div>
        )}
        <Input
          label="Nota (opcional)"
          value={d.note ?? ''}
          onChange={(e) => setD({ ...d, note: e.target.value || undefined })}
          placeholder="Ej. confirmación ABC123, llevar identificación"
          maxLength={300}
        />
      </div>
    </Sheet>
  );
}

// ——————————————————— Gastos ———————————————————

function ExpensesTab({
  trip,
  candidates,
  linked,
}: {
  trip: Trip & { space?: WithSpace<Trip>['space'] };
  candidates: ReturnType<typeof tripCandidates>;
  linked: Transaction[];
}) {
  const txs = useData((s) => s.data.transactions);
  const withSpace = (id: string) => txs.find((t) => t.id === id);

  async function link(ids: string[]) {
    const changes: Change[] = [];
    for (const id of ids) {
      const t = withSpace(id);
      if (!t) continue;
      const before = strip(t);
      changes.push({
        space: t.space,
        col: 'transactions',
        before,
        after: { ...before, tripId: trip.id },
      });
    }
    if (changes.length)
      await commitWithUndo(
        changes,
        changes.length === 1 ? 'Agregado al viaje' : `${changes.length} gastos agregados al viaje`,
      );
  }
  async function ignore(id: string) {
    const before = strip(trip);
    await saveDoc('trips', { ...before, ignoredTxIds: [...trip.ignoredTxIds, id].slice(-500) });
  }

  const strong = candidates.filter((c) => c.strong);
  return (
    <>
      {candidates.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardTitle
            action={
              strong.length > 1 && (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void link(strong.map((c) => c.tx.id))}
                >
                  Agregar {strong.length}
                </Button>
              )
            }
          >
            ¿Son de este viaje?
          </CardTitle>
          <ul className="divide-y divide-line">
            {candidates.slice(0, 30).map((c) => (
              <li key={c.tx.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{c.tx.description}</p>
                  <p className="text-xs text-muted">
                    {formatShortDate(c.tx.date)} · {c.reason}
                  </p>
                </div>
                <Money cents={c.tx.amountMxnCents} className="text-sm font-semibold text-ink" />
                <button
                  type="button"
                  aria-label="Sí, es del viaje"
                  onClick={() => void link([c.tx.id])}
                  className="rounded-full bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="No es del viaje"
                  onClick={() => void ignore(c.tx.id)}
                  className="rounded-full bg-surface-2 p-2 text-muted hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {linked.length === 0 ? (
        <EmptyState
          emoji="i:receipt"
          title="Aún no hay gastos en este viaje"
          text="Durante el viaje se agregan solos. Antes, lo que reserves (vuelos, hotel) te lo sugiero aquí para agregarlo con un toque."
        />
      ) : (
        <Card className="px-2 py-1">
          <ul className="divide-y divide-line">
            {linked.map((t) => {
              const full = withSpace(t.id);
              return full ? <TransactionRow key={t.id} tx={full} showDate /> : null;
            })}
          </ul>
        </Card>
      )}
      <Tip>Para sacar un gasto del viaje, tócalo y en “Viaje” elige “No es de un viaje”.</Tip>
    </>
  );
}

// ——————————————————— Cómo pagarlo ———————————————————

function FundingTab({
  trip,
  total,
  today,
}: {
  trip: Trip & { space?: WithSpace<Trip>['space'] };
  total: number;
  today: ISODate;
}) {
  const profile = useData((s) => s.profile);
  const accounts = useData((s) => s.data.accounts);
  const cards = accounts.filter((a) => a.type === 'credit' && !a.archived);
  const [f, setF] = useState<TripFunding>(trip.funding);
  const [contrib, setContrib] = useState(false);
  useEffect(() => {
    setF(trip.funding);
  }, [trip.funding]);
  const dirty = JSON.stringify(f) !== JSON.stringify(trip.funding);
  const card = cards.find((c) => c.id === f.cardAccountId);
  const plan = tripFundingPlan({ ...trip, funding: f }, total, {
    today,
    payday: profile?.payday,
    cardAnnualRate: card?.credit?.annualRate,
  });
  const periodWord = f.period === 'biweekly' ? 'quincena' : 'mes';
  const periodsWord = f.period === 'biweekly' ? 'quincenas' : 'meses';
  const set = (patch: Partial<TripFunding>) => setF({ ...f, ...patch });

  if (total === 0)
    return (
      <EmptyState
        emoji="i:piggy"
        title="Primero, el presupuesto"
        text="Cuando sepa cuánto cuesta el viaje te digo cuánto apartar por quincena o en cuántos meses lo terminas de pagar."
      />
    );

  return (
    <>
      <Card>
        <p className="text-sm text-muted">El viaje cuesta</p>
        <Money cents={total} className="text-2xl font-bold text-ink" />
        <div className="mt-4 space-y-4">
          <Segmented
            label="¿Cómo lo vas a pagar?"
            value={f.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'save', label: 'Ahorrando' },
              { value: 'card', label: 'Con tarjeta' },
              { value: 'mixed', label: 'Parte y parte' },
            ]}
          />
          <MoneyInput
            label="Ya tengo apartado"
            value={f.savedCents}
            onChange={(v) => set({ savedCents: v })}
          />
          {f.mode === 'mixed' && (
            <Select
              label="¿Cuánto va a la tarjeta?"
              value={String(f.cardSharePct)}
              onChange={(e) => set({ cardSharePct: Number(e.target.value) })}
              options={[25, 50, 75].map((p) => ({ value: String(p), label: `${p} % del viaje` }))}
            />
          )}
          {f.mode !== 'card' && (
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput
                label={`Puedo apartar por ${periodWord}`}
                value={f.perPeriodCents}
                onChange={(v) => set({ perPeriodCents: v })}
              />
              <Select
                label="Cada"
                value={f.period}
                onChange={(e) => set({ period: e.target.value as TripFunding['period'] })}
                options={[
                  { value: 'biweekly', label: 'Quincena' },
                  { value: 'monthly', label: 'Mes' },
                ]}
              />
            </div>
          )}
          {f.mode !== 'save' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Tarjeta"
                  value={f.cardAccountId ?? ''}
                  onChange={(e) => set({ cardAccountId: e.target.value || null })}
                  options={[
                    { value: '', label: cards.length ? 'Elegir…' : 'Sin tarjetas' },
                    ...cards.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <Select
                  label="Meses sin intereses"
                  value={String(f.msiMonths)}
                  onChange={(e) => set({ msiMonths: Number(e.target.value) })}
                  options={[0, 3, 6, 9, 12, 18, 24].map((m) => ({
                    value: String(m),
                    label: m === 0 ? 'Sin MSI' : `${m} MSI`,
                  }))}
                />
              </div>
              {f.msiMonths === 0 && (
                <MoneyInput
                  label="¿Cuánto le abonarías al mes?"
                  value={f.payPerMonthCents}
                  onChange={(v) => set({ payPerMonthCents: v })}
                  hint="Si lo pagas completo en tu próxima fecha límite, no pagas intereses."
                />
              )}
            </>
          )}
          {dirty && (
            <Button
              block
              onClick={() => void saveDoc('trips', { ...strip(trip), funding: f }, 'Plan guardado')}
            >
              Guardar plan
            </Button>
          )}
        </div>
      </Card>

      {plan.cashPartCents > 0 && f.mode !== 'card' && (
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-accent-600" /> Ahorro antes de salir
            </span>
          </CardTitle>
          <ProgressBar
            value={plan.cashPartCents ? (plan.savedCents / plan.cashPartCents) * 100 : 0}
            status={plan.toSaveCents === 0 ? 'ok' : 'accent'}
          />
          <p className="mt-2 text-sm text-muted">
            <Money cents={plan.savedCents} className="font-semibold text-ink" /> de{' '}
            <Money cents={plan.cashPartCents} />
          </p>
          {plan.toSaveCents === 0 ? (
            <p className="mt-3 text-sm font-semibold text-emerald-700">
              ¡Ya tienes todo lo de contado!
            </p>
          ) : plan.periodsLeft === 0 ? (
            <p className="mt-3 text-sm text-ink">
              Ya no hay {periodsWord} antes de salir: te faltan{' '}
              <Money cents={plan.toSaveCents} className="font-semibold" />.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-ink">
              <p>
                Para llegar a tiempo aparta{' '}
                <Money cents={plan.neededPerPeriodCents} className="font-bold text-accent-700" />{' '}
                por {periodWord} ({plan.periodsLeft}{' '}
                {plan.periodsLeft === 1 ? periodWord : periodsWord} antes de salir).
              </p>
              {plan.perPeriodCents > 0 &&
                (plan.onTrack ? (
                  <p className="text-emerald-700">
                    Con <Money cents={plan.perPeriodCents} /> por {periodWord} juntas todo el{' '}
                    {plan.readyDate && formatLongDate(plan.readyDate)}. Vas bien.
                  </p>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">
                    Con <Money cents={plan.perPeriodCents} /> por {periodWord} te faltarían{' '}
                    <Money cents={plan.shortfallCents} className="font-semibold" /> al salir. Sube
                    el ahorro, recorta el presupuesto o paga esa parte con tarjeta.
                  </p>
                ))}
            </div>
          )}
          {plan.toSaveCents > 0 && (
            <Button className="mt-3" size="sm" variant="soft" onClick={() => setContrib(true)}>
              + Apartar ahora
            </Button>
          )}
        </Card>
      )}

      {plan.card && (
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent-600" /> Con tarjeta
              {card && <span className="font-normal text-muted">· {card.name}</span>}
            </span>
          </CardTitle>
          <p className="text-sm text-muted">
            A la tarjeta: <Money cents={plan.card.amountCents} className="font-semibold text-ink" />
          </p>
          {plan.card.msi ? (
            <p className="mt-2 text-sm text-ink">
              Pagas <Money cents={plan.card.monthlyCents} className="font-bold text-accent-700" />{' '}
              al mes durante {plan.card.months} meses, sin intereses. Terminas en{' '}
              {plan.card.finishDate && formatMonthKey(plan.card.finishDate.slice(0, 7))}.
              <span className="mt-1 block text-xs text-muted">
                Los MSI solo aplican donde los ofrezcan (aerolíneas, hoteles y agencias suelen
                tenerlos). La comida y el transporte allá normalmente no.
              </span>
            </p>
          ) : plan.card.monthlyCents === 0 ? (
            <p className="mt-2 text-sm text-ink">
              Elige meses sin intereses o escribe cuánto abonarías al mes y te digo en cuánto tiempo
              lo terminas y cuánto pagarías de intereses.
            </p>
          ) : !plan.card.feasible ? (
            <p className="mt-2 text-sm text-rose-600">
              Con ese abono no alcanzas a cubrir ni los intereses: la deuda nunca bajaría. Sube el
              abono o usa meses sin intereses.
            </p>
          ) : plan.card.interestCents === 0 ? (
            <p className="mt-2 text-sm text-emerald-700">
              Lo pagas completo en tu próxima fecha límite: sin intereses.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink">
              Abonando <Money cents={plan.card.monthlyCents} /> al mes terminas en{' '}
              <b>{plan.card.months} meses</b> (
              {plan.card.finishDate && formatMonthKey(plan.card.finishDate.slice(0, 7))}) y pagarías
              cerca de{' '}
              <Money cents={plan.card.interestCents} className="font-semibold text-rose-600" /> de
              intereses
              {card?.credit ? ` (tasa ${Math.round(card.credit.annualRate * 100)} % anual)` : ''}.
            </p>
          )}
        </Card>
      )}
      <Tip>
        Lo más sano: ahorra antes lo que puedas y deja a la tarjeta solo lo que tenga meses sin
        intereses. Fina te recuerda apartar cada {periodWord} en Pagos pendientes.
      </Tip>
      <ContributionSheet
        trip={trip}
        open={contrib}
        onClose={() => setContrib(false)}
        suggested={plan.nextContribution?.amountCents ?? 0}
      />
    </>
  );
}

function ContributionSheet({
  trip,
  open,
  onClose,
  suggested,
}: {
  trip: Trip & { space?: WithSpace<Trip>['space'] };
  open: boolean;
  onClose: () => void;
  suggested: number;
}) {
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    if (open) setAmount(suggested);
  }, [open, suggested]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Apartar para ${trip.name}`}
      footer={
        <Button
          block
          disabled={!amount}
          onClick={() => {
            const before = strip(trip);
            void saveDoc(
              'trips',
              {
                ...before,
                funding: { ...before.funding, savedCents: before.funding.savedCents + amount },
              },
              `+${(amount / 100).toLocaleString('es-MX')} apartados para ${trip.name}`,
            );
            onClose();
          }}
        >
          Apartar
        </Button>
      }
    >
      <MoneyInput label="Monto" value={amount} onChange={setAmount} autoFocus />
      <p className="mt-2 text-sm text-muted">
        Tip: pásalo a una cuenta de ahorro o a un “apartado” de tu banco para no gastártelo.
      </p>
    </Sheet>
  );
}
