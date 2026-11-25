import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react';
import { addDays, formatShortDate, tripStatus, tripSummary, type Trip } from '@fina/core';
import { useFinance } from '@/lib/finance';
import { useData, useDocs, type WithSpace } from '@/stores/data';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Money,
  PageHeader,
  ProgressBar,
  Tip,
} from '@/components/ui';
import { TripIcon } from './TripIcon';
import { TripSheet, blankTrip } from './TripSheet';

export default function TripsPage() {
  const trips = useDocs('trips');
  const transactions = useData((s) => s.data.transactions);
  const { today } = useFinance();
  const [editing, setEditing] = useState<Trip | null>(null);

  const groups = useMemo(() => {
    const visible = trips.filter((t) => !t.archived);
    const by = (s: ReturnType<typeof tripStatus>) =>
      visible.filter((t) => tripStatus(t, today) === s);
    return {
      active: by('active'),
      planning: by('planning').sort((a, b) => a.startDate.localeCompare(b.startDate)),
      done: by('done').sort((a, b) => b.startDate.localeCompare(a.startDate)),
    };
  }, [trips, today]);

  const card = (t: WithSpace<Trip>) => {
    const s = tripSummary(t, transactions, today);
    const pct = s.budgetCents ? (s.spentCents / s.budgetCents) * 100 : 0;
    return (
      <Link key={t.id} to={`/viajes/${t.id}`} className="block">
        <Card className="transition hover:border-accent-300">
          <div className="flex items-start gap-3">
            <TripIcon value={t.icon} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">{t.name}</p>
                {s.status === 'active' && (
                  <Badge tone="accent">
                    Día {s.dayNumber} de {s.days}
                  </Badge>
                )}
                {s.status === 'planning' && (
                  <Badge>{s.daysUntil === 1 ? 'Mañana' : `En ${s.daysUntil} días`}</Badge>
                )}
                {t.space === 'household' && <Badge>compartido</Badge>}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatShortDate(t.startDate)} – {formatShortDate(t.endDate)}
                </span>
                {t.travelers > 1 && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {t.travelers}
                  </span>
                )}
              </p>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 text-muted" />
          </div>
          {s.budgetCents > 0 ? (
            <>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="text-muted">
                  <Money cents={s.spentCents} className="font-semibold text-ink" /> de{' '}
                  <Money cents={s.budgetCents} />
                </span>
                <span
                  className={s.remainingCents < 0 ? 'font-semibold text-rose-600' : 'text-muted'}
                >
                  {s.remainingCents < 0 ? 'Te pasaste ' : 'Quedan '}
                  <Money cents={Math.abs(s.remainingCents)} />
                </span>
              </div>
              <ProgressBar
                className="mt-1.5"
                value={pct}
                status={pct > 100.5 ? 'over' : pct >= 99.5 ? 'ok' : pct > 85 ? 'warn' : 'accent'}
              />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Aún sin presupuesto. Toca para armarlo.</p>
          )}
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Viajes"
        subtitle="Planea, ahorra y lleva la cuenta de cada viaje."
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blankTrip(addDays(today, 30)))}>
            <Plus className="h-4 w-4" /> Viaje
          </Button>
        }
      />

      {trips.filter((t) => !t.archived).length === 0 ? (
        <EmptyState
          emoji="i:luggage"
          title="Planea tu próximo viaje"
          text="Ponle presupuesto por rubro, descubre cuánto apartar por quincena (o en cuántos meses lo pagas con tarjeta), arma el itinerario y Fina junta solita los gastos del viaje."
          action={
            <Button onClick={() => setEditing(blankTrip(addDays(today, 30)))}>
              <Plus className="h-4 w-4" /> Crear mi primer viaje
            </Button>
          }
        />
      ) : (
        <>
          {groups.active.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">De viaje ahora</h2>
              {groups.active.map(card)}
            </section>
          )}
          {groups.planning.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">Próximos</h2>
              {groups.planning.map(card)}
            </section>
          )}
          {groups.done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">Viajes pasados</h2>
              {groups.done.map(card)}
            </section>
          )}
        </>
      )}

      <Tip>
        Mientras estés de viaje, todo lo que anotes (en la app, por WhatsApp o lo que llegue de tu
        banco) se guarda solo en ese viaje. Las reservas que hiciste antes te las sugiero para que
        las agregues con un toque.
      </Tip>
      <TripSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
