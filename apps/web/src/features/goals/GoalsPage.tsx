import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addMonths, addMonthsKey, emergencyMonths, formatLongDate, goalProgress, monthEnd, monthKey, monthStart, newId, summarizePeriod, todayISO, type Goal, type Transaction } from '@fina/core';
import { commitWithUndo, defaultAccountId, deleteDoc, saveDoc } from '@/lib/actions';
import { useData, useDocs } from '@/stores/data';
import { Badge, Button, Card, EmptyState, Input, Money, MoneyInput, PageHeader, ProgressBar, Segmented, Select, Sheet, Tip } from '@/components/ui';

/** Gasto mensual promedio en necesidades (últimos 3 meses) para el fondo de emergencia. */
function useEssentialMonthly(): number {
  const txs = useData((s) => s.data.transactions);
  const plans = useData((s) => s.data.installmentPlans);
  const cats = useData((s) => s.data.categories);
  return useMemo(() => {
    const needs = new Set(cats.filter((c) => c.group === 'needs').map((c) => c.id));
    const mk = monthKey(todayISO());
    let total = 0;
    for (let i = 1; i <= 3; i++) {
      const k = addMonthsKey(mk, -i);
      const s = summarizePeriod(txs, plans, monthStart(k), monthEnd(k));
      total += Object.entries(s.byCategory).filter(([c]) => needs.has(c)).reduce((a, [, v]) => a + v, 0);
    }
    return Math.round(total / 3);
  }, [txs, plans, cats]);
}

export default function GoalsPage() {
  const goals = useDocs('goals');
  const profile = useData((s) => s.profile);
  const essential = useEssentialMonthly();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contrib, setContrib] = useState<Goal | null>(null);
  const today = todayISO();
  const active = goals.filter((g) => !g.archived);

  const blank = (type: Goal['type'] = 'normal'): Goal => ({
    id: newId(),
    name: type === 'emergency' ? 'Fondo de emergencia' : '',
    emoji: type === 'emergency' ? '🛟' : '🎯',
    targetCents: type === 'emergency' ? Math.max(essential * 3, 0) : 0,
    savedCents: 0,
    targetDate: addMonths(today, type === 'emergency' ? 12 : 6),
    accountId: null,
    type,
    monthsTarget: type === 'emergency' ? 3 : undefined,
    createdAt: new Date().toISOString(),
    archived: false,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Metas de ahorro" back actions={<Button size="sm" onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> Meta</Button>} />
      {!active.some((g) => g.type === 'emergency') && (
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="font-semibold text-ink">🛟 Empieza por tu fondo de emergencia</p>
          <p className="mt-1 text-sm text-muted">
            Es el colchón para imprevistos (doctor, perder el trabajo, el coche). La meta: 3 a 6 meses de gastos básicos{essential > 0 && <> ≈ <Money cents={essential * 3} /></>}.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setEditing(blank('emergency'))}>
            Crear fondo de emergencia
          </Button>
        </Card>
      )}
      {active.length === 0 ? (
        <EmptyState emoji="🎯" title="Ponte una meta" text="Un viaje, un enganche, la laptop… Te digo cuánto apartar cada quincena para llegar a tiempo." />
      ) : (
        active.map((g) => {
          const p = goalProgress(g, today, profile?.payday);
          return (
            <Card key={g.id}>
              <button type="button" className="w-full text-left" onClick={() => setEditing(g)}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{g.name}</p>
                      {g.space === 'household' && <Badge>🏠 compartida</Badge>}
                      {p.pct >= 100 && <Badge tone="good">¡Lograda! 🎉</Badge>}
                    </div>
                    <p className="text-sm text-muted">
                      <Money cents={g.savedCents} className="font-semibold text-ink" /> de <Money cents={g.targetCents} /> {g.targetDate && `· para el ${formatLongDate(g.targetDate, true)}`}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-accent-600">{p.pct}%</span>
                </div>
                <ProgressBar className="mt-3" value={p.pct} status={p.pct >= 100 ? 'ok' : 'accent'} />
              </button>
              {p.remainingCents > 0 && (p.perPaycheckCents || p.perMonthCents) && (
                <p className="mt-2 text-sm text-muted">
                  Aparta <Money cents={p.perPaycheckCents ?? p.perMonthCents ?? 0} className="font-semibold text-ink" /> {p.perPaycheckCents ? `cada pago (${p.paychecksLeft} pagos)` : 'al mes'} para lograrlo a tiempo.
                </p>
              )}
              {g.type === 'emergency' && essential > 0 && <p className="mt-1 text-sm text-muted">Cubre {emergencyMonths(g.savedCents, essential)} meses de tus gastos básicos.</p>}
              <Button size="sm" variant="soft" className="mt-3" onClick={() => setContrib(g)}>
                + Aportar
              </Button>
            </Card>
          );
        })
      )}
      <Tip>Truco: el día que te paguen, aparta primero para tus metas (“págate a ti primero”) y vive con el resto. También puedes escribir “ahorré 500 para el viaje”.</Tip>
      <GoalSheet value={editing} essential={essential} onClose={() => setEditing(null)} />
      <ContributionSheet goal={contrib} onClose={() => setContrib(null)} />
    </div>
  );
}

function GoalSheet({ value, onClose, essential }: { value: Goal | null; onClose: () => void; essential: number }) {
  const [d, setD] = useState<Goal | null>(value);
  const accounts = useData((s) => s.data.accounts);
  const exists = useData((s) => s.data.goals.some((g) => g.id === value?.id));
  useEffect(() => setD(value), [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={exists ? 'Editar meta' : 'Nueva meta'}
      footer={
        <div className="flex gap-2">
          {exists && (
            <Button variant="secondary" aria-label="Borrar" onClick={() => { void deleteDoc('goals', d.id, 'Meta borrada'); onClose(); }}>
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button block disabled={!d.name || !d.targetCents} onClick={() => { void saveDoc('goals', d, 'Meta guardada'); onClose(); }}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented value={d.type} onChange={(t) => setD({ ...d, type: t })} options={[{ value: 'normal', label: '🎯 Meta' }, { value: 'emergency', label: '🛟 Emergencia' }]} />
        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <Input label="Emoji" value={d.emoji} onChange={(e) => setD({ ...d, emoji: e.target.value.slice(0, 4) })} />
          <Input label="Nombre" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Ej. Viaje a Oaxaca" />
        </div>
        {d.type === 'emergency' && (
          <Select
            label="¿Cuántos meses de gastos quieres cubrir?"
            value={String(d.monthsTarget ?? 3)}
            onChange={(e) => {
              const m = Number(e.target.value);
              setD({ ...d, monthsTarget: m, targetCents: essential > 0 ? essential * m : d.targetCents });
            }}
            options={[1, 2, 3, 4, 6, 9, 12].map((m) => ({ value: String(m), label: `${m} ${m === 1 ? 'mes' : 'meses'}` }))}
          />
        )}
        <MoneyInput label="¿Cuánto necesitas?" value={d.targetCents} onChange={(v) => setD({ ...d, targetCents: v })} />
        <MoneyInput label="¿Cuánto llevas ahorrado?" value={d.savedCents} onChange={(v) => setD({ ...d, savedCents: v })} />
        <Input label="¿Para cuándo?" type="date" value={d.targetDate ?? ''} onChange={(e) => setD({ ...d, targetDate: e.target.value || null })} />
        <Select label="¿Dónde guardas este dinero? (opcional)" value={d.accountId ?? ''} onChange={(e) => setD({ ...d, accountId: e.target.value || null })} options={[{ value: '', label: 'No especificar' }, ...accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))]} />
      </div>
    </Sheet>
  );
}

function ContributionSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [amount, setAmount] = useState(0);
  const accounts = useData((s) => s.data.accounts);
  const [from, setFrom] = useState('');
  useEffect(() => {
    setAmount(0);
    setFrom(defaultAccountId('debit') ?? '');
  }, [goal]);
  if (!goal) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Aportar a ${goal.name}`}
      footer={
        <Button
          block
          disabled={!amount}
          onClick={async () => {
            const stamp = new Date().toISOString();
            const tx: Transaction = {
              id: newId(),
              kind: 'transfer',
              amountCents: amount,
              currency: 'MXN',
              amountMxnCents: amount,
              accountId: from || null,
              toAccountId: goal.accountId && goal.accountId !== from ? goal.accountId : null,
              categoryId: null,
              tags: [],
              description: `Ahorro: ${goal.name}`,
              date: todayISO(),
              createdAt: stamp,
              updatedAt: stamp,
              source: 'app',
              status: 'cleared',
              reconciled: false,
              goalId: goal.id,
              attachments: [],
            };
            const { space, ...g } = goal as Goal & { space?: 'personal' | 'household' };
            await commitWithUndo(
              [
                { space: space ?? 'personal', col: 'transactions', before: null, after: tx },
                { space: space ?? 'personal', col: 'goals', before: g, after: { ...g, savedCents: g.savedCents + amount } },
              ],
              `🎉 +${(amount / 100).toLocaleString('es-MX')} a ${goal.name}`,
            );
            onClose();
          }}
        >
          Aportar
        </Button>
      }
    >
      <div className="space-y-3">
        <MoneyInput label="Monto" value={amount} onChange={setAmount} autoFocus />
        <Select label="Sale de" value={from} onChange={(e) => setFrom(e.target.value)} options={[{ value: '', label: 'Sin cuenta' }, ...accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))]} />
      </div>
    </Sheet>
  );
}
