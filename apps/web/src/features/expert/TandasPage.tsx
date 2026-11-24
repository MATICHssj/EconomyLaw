import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatLongDate, newId, tandaSchedule, tandaStatus, todayISO, type Tanda, type Transaction } from '@fina/core';
import { commitWithUndo, defaultAccountId, deleteDoc, saveDoc } from '@/lib/actions';
import { useData } from '@/stores/data';
import { Badge, Button, Card, EmptyState, Input, Money, MoneyInput, PageHeader, ProgressBar, Select, Sheet, Tip, cx } from '@/components/ui';

export default function TandasPage() {
  const tandas = useData((s) => s.data.tandas);
  const [editing, setEditing] = useState<Tanda | null>(null);
  const today = todayISO();
  const blank = (): Tanda => ({ id: newId(), name: '', contributionCents: 50000, participants: 10, myTurn: 1, frequency: 'biweekly', startDate: today, received: false, createdAt: new Date().toISOString(), archived: false });

  async function record(t: Tanda, payout: boolean) {
    const stamp = new Date().toISOString();
    const amount = payout ? t.contributionCents * t.participants : t.contributionCents;
    const tx: Transaction = {
      id: newId(),
      kind: payout ? 'income' : 'tanda',
      amountCents: amount,
      currency: 'MXN',
      amountMxnCents: amount,
      accountId: defaultAccountId(),
      toAccountId: null,
      categoryId: payout ? 'tanda_payout' : null,
      tags: [],
      description: payout ? `Cobré la tanda ${t.name}` : `Aportación tanda ${t.name}`,
      date: today,
      createdAt: stamp,
      updatedAt: stamp,
      source: 'app',
      status: 'cleared',
      reconciled: false,
      tandaId: t.id,
      attachments: [],
    };
    const { space: _s, ...clean } = t as Tanda & { space?: string };
    const changes = [{ space: 'personal' as const, col: 'transactions' as const, before: null, after: tx }];
    if (payout) changes.push({ space: 'personal', col: 'tandas', before: clean, after: { ...clean, received: true } } as never);
    await commitWithUndo(changes, payout ? '🎉 ¡Tanda cobrada!' : 'Aportación registrada');
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Tandas" back actions={<Button size="sm" onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> Tanda</Button>} />
      {tandas.filter((t) => !t.archived).length === 0 ? (
        <EmptyState emoji="🫙" title="¿Estás en una tanda?" text="Regístrala y te digo cuándo te toca pagar y cuándo cobras." action={<Button onClick={() => setEditing(blank())}>Agregar tanda</Button>} />
      ) : (
        tandas
          .filter((t) => !t.archived)
          .map((t) => {
            const s = tandaStatus(t, today);
            const schedule = tandaSchedule(t);
            return (
              <Card key={t.id}>
                <button type="button" className="w-full text-left" onClick={() => setEditing(t)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">🫙 {t.name}</p>
                      <p className="text-sm text-muted">
                        <Money cents={t.contributionCents} /> {t.frequency === 'weekly' ? 'cada semana' : t.frequency === 'biweekly' ? 'cada 2 semanas' : 'cada mes'} · {t.participants} números · te toca el #{t.myTurn}
                      </p>
                    </div>
                    <Badge tone={s.position === 'done' ? 'good' : s.received ? 'warn' : 'accent'}>{s.position === 'done' ? 'Terminada' : s.received ? 'Ya cobraste' : 'Por cobrar'}</Badge>
                  </div>
                </button>
                <ProgressBar className="mt-3" value={(s.paidRounds / t.participants) * 100} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-surface-2 p-2.5">
                    <p className="text-xs text-muted">Cobras</p>
                    <p className="font-semibold text-ink">
                      <Money cents={s.potCents} />
                    </p>
                    <p className="text-xs text-muted">{formatLongDate(s.myPayoutDate)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-2.5">
                    <p className="text-xs text-muted">Siguiente pago</p>
                    <p className="font-semibold text-ink">{s.nextPayment ? formatLongDate(s.nextPayment.date) : '—'}</p>
                    <p className="text-xs text-muted">
                      Llevas <Money cents={s.paidCents} />
                    </p>
                  </div>
                </div>
                <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Calendario de la tanda">
                  {schedule.map((r) => (
                    <span key={r.n} title={formatLongDate(r.date)} className={cx('flex h-8 min-w-8 items-center justify-center rounded-lg text-xs font-semibold', r.isMyTurn ? 'bg-emerald-500 text-white' : r.date <= today ? 'bg-accent-200 text-accent-900' : 'bg-surface-2 text-muted')}>
                      {r.n}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="soft" onClick={() => void record(t, false)}>
                    Registrar aportación
                  </Button>
                  {!t.received && (
                    <Button size="sm" variant="secondary" onClick={() => void record(t, true)}>
                      Ya cobré
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
      )}
      <Tip emoji="⚠️">Una tanda no genera intereses y depende de la confianza. Si te toca de los primeros números, en la práctica es un préstamo; si te toca al final, es un ahorro forzoso. Participa solo con gente de confianza.</Tip>
      <TandaSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TandaSheet({ value, onClose }: { value: Tanda | null; onClose: () => void }) {
  const [d, setD] = useState<Tanda | null>(value);
  const exists = useData((s) => s.data.tandas.some((t) => t.id === value?.id));
  useEffect(() => setD(value), [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar tanda' : 'Nueva tanda'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button variant="secondary" aria-label="Borrar" onClick={() => { void deleteDoc('tandas', d.id, 'Tanda borrada'); onClose(); }}>
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button block disabled={!d.name || !d.contributionCents} onClick={() => { void saveDoc('tandas', { ...d, myTurn: Math.min(d.myTurn, d.participants) }, 'Tanda guardada'); onClose(); }}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Nombre" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Ej. Tanda de la oficina" />
        <MoneyInput label="Aportación por ronda" value={d.contributionCents} onChange={(v) => setD({ ...d, contributionCents: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Número de participantes" type="number" min={2} max={60} value={d.participants} onChange={(e) => setD({ ...d, participants: Math.max(2, Number(e.target.value) || 2) })} />
          <Input label="Tu número" type="number" min={1} max={d.participants} value={d.myTurn} onChange={(e) => setD({ ...d, myTurn: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Frecuencia" value={d.frequency} onChange={(e) => setD({ ...d, frequency: e.target.value as Tanda['frequency'] })} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'biweekly', label: 'Cada 2 semanas' }, { value: 'monthly', label: 'Mensual' }]} />
          <Input label="Primera ronda" type="date" value={d.startDate} onChange={(e) => e.target.value && setD({ ...d, startDate: e.target.value })} />
        </div>
        <Input label="Organiza (opcional)" value={d.organizer ?? ''} onChange={(e) => setD({ ...d, organizer: e.target.value || undefined })} />
      </div>
    </Sheet>
  );
}
