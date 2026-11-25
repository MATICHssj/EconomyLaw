import { useEffect, useState } from 'react';
import { Trash2, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  addDays,
  newId,
  tripDays,
  FALLBACK_FX_RATES,
  TRIP_BUCKETS,
  TRIP_BUCKET_INFO,
  TripSchema,
  type Trip,
  type TripBucket,
} from '@fina/core';
import { IconPicker, TRIP_ICONS } from '@/components/icons';
import { deleteDoc, saveDoc } from '@/lib/actions';
import { useData } from '@/stores/data';
import {
  confirmDialog,
  Button,
  Input,
  Money,
  MoneyInput,
  Select,
  Sheet,
  Toggle,
} from '@/components/ui';

export function blankTrip(startDate: string): Trip {
  // Se valida con un nombre provisional (el esquema exige nombre) y se deja vacío para el formulario.
  const trip = TripSchema.parse({
    id: newId(),
    name: 'Viaje',
    destination: '',
    icon: 'i:plane',
    startDate,
    endDate: addDays(startDate, 3),
    createdAt: new Date().toISOString(),
  });
  return { ...trip, name: '' };
}

/** Estimado rápido para un viaje nacional (MXN por día). El usuario lo ajusta. */
const PER_DAY: Partial<Record<TripBucket, { cents: number; perPerson: boolean }>> = {
  food: { cents: 55000, perPerson: true },
  local_transport: { cents: 25000, perPerson: false },
  activities: { cents: 40000, perPerson: true },
  shopping: { cents: 15000, perPerson: true },
};

export function suggestBudget(trip: Trip): Trip['budget'] {
  const days = tripDays(trip);
  const out: Trip['budget'] = { ...trip.budget };
  let subtotal = 0;
  for (const b of TRIP_BUCKETS) {
    const rule = PER_DAY[b];
    if (rule && !out[b]) out[b] = rule.cents * days * (rule.perPerson ? trip.travelers : 1);
    subtotal += out[b] ?? 0;
  }
  if (!out.other) out.other = Math.round((subtotal * 0.08) / 10000) * 10000;
  return out;
}

const CURRENCIES = Object.keys(FALLBACK_FX_RATES);

export function TripSheet({ value, onClose }: { value: Trip | null; onClose: () => void }) {
  const [d, setD] = useState<Trip | null>(value);
  const exists = useData((s) => s.data.trips.some((t) => t.id === value?.id));
  const nav = useNavigate();
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;

  const total = TRIP_BUCKETS.reduce((s, b) => s + (d.budget[b] ?? 0), 0);
  const setBudget = (b: TripBucket, v: number) => setD({ ...d, budget: { ...d.budget, [b]: v } });
  const validDates = d.startDate && d.endDate && d.startDate <= d.endDate;

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar viaje' : 'Nuevo viaje'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button
              variant="secondary"
              aria-label="Borrar viaje"
              onClick={async () => {
                const ok = await confirmDialog('¿Borrar este viaje?', {
                  text: 'Los gastos se quedan en tus movimientos; solo dejan de estar agrupados en el viaje.',
                  ok: 'Borrar',
                  danger: true,
                });
                if (!ok) return;
                void deleteDoc('trips', d.id, 'Viaje borrado');
                onClose();
                nav('/viajes');
              }}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!d.name.trim() || !validDates}
            onClick={() => {
              void saveDoc('trips', { ...d, name: d.name.trim() }, 'Viaje guardado');
              onClose();
              if (!exists) nav(`/viajes/${d.id}`);
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="¿Cómo se llama el viaje?"
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder="Ej. Cancún con mis amigas"
          maxLength={60}
          autoFocus={!exists}
        />
        <Input
          label="Destino"
          value={d.destination}
          onChange={(e) => setD({ ...d, destination: e.target.value })}
          placeholder="Ej. Cancún, Quintana Roo"
          maxLength={80}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Salida"
            type="date"
            value={d.startDate}
            onChange={(e) => {
              const start = e.target.value;
              setD({ ...d, startDate: start, endDate: d.endDate < start ? start : d.endDate });
            }}
          />
          <Input
            label="Regreso"
            type="date"
            value={d.endDate}
            min={d.startDate}
            onChange={(e) => setD({ ...d, endDate: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="¿Cuántos van?"
            value={String(d.travelers)}
            onChange={(e) => setD({ ...d, travelers: Number(e.target.value) })}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: i === 0 ? 'Solo yo' : `${i + 1} personas`,
            }))}
          />
          <Select
            label="Moneda allá"
            value={d.currency}
            onChange={(e) => setD({ ...d, currency: e.target.value })}
            options={CURRENCIES.map((c) => ({ value: c, label: c === 'MXN' ? 'Pesos (MXN)' : c }))}
          />
        </div>
        <IconPicker value={d.icon} onChange={(v) => setD({ ...d, icon: v })} options={TRIP_ICONS} />

        <div className="rounded-2xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">Presupuesto</p>
              <p className="text-xs text-muted">
                En pesos. Total: <Money cents={total} className="font-semibold text-ink" />
              </p>
            </div>
            <Button
              size="sm"
              variant="soft"
              onClick={() => setD({ ...d, budget: suggestBudget(d) })}
            >
              <Wand2 className="h-4 w-4" /> Estimar
            </Button>
          </div>
          <div className="space-y-3">
            {TRIP_BUCKETS.map((b) => (
              <MoneyInput
                key={b}
                label={TRIP_BUCKET_INFO[b].label}
                hint={TRIP_BUCKET_INFO[b].hint}
                value={d.budget[b] ?? 0}
                onChange={(v) => setBudget(b, v)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            “Estimar” llena comida, transporte, actividades y compras con un aproximado para un
            viaje en México ({tripDays(d)} días, {d.travelers}{' '}
            {d.travelers === 1 ? 'persona' : 'personas'}). Vuelos y hospedaje ponlos tú.
          </p>
        </div>

        <Toggle
          label="Juntar los gastos del viaje solitos"
          description="Lo que anotes o llegue de tu banco entre la salida y el regreso se guarda en este viaje (menos renta, servicios y suscripciones)."
          checked={d.autoAssign}
          onChange={(v) => setD({ ...d, autoAssign: v })}
        />
        <Input
          label="Notas"
          value={d.notes ?? ''}
          onChange={(e) => setD({ ...d, notes: e.target.value || undefined })}
          placeholder="Ej. llevar bloqueador, reservar tour con 2 semanas"
          maxLength={1000}
        />
      </div>
    </Sheet>
  );
}
