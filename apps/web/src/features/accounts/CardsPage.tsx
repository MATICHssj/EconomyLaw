import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { formatLongDate, formatMonthKey, monthlyInstallmentLoad, planStatus, todayISO, totalInstallmentsRemaining } from '@fina/core';
import { applyChanges, deleteDoc, installmentPlanFromForm } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import { Badge, Button, Card, CardTitle, EmptyState, Input, Money, MoneyInput, PageHeader, ProgressBar, Select, Sheet, Tip } from '@/components/ui';
import { AccountForm } from './AccountForm';

export default function CardsPage() {
  const f = useFinance();
  const accounts = useDocs('accounts');
  const plans = useDocs('installmentPlans');
  const cards = accounts.filter((a) => a.type === 'credit' && !a.archived);
  const [cardOpen, setCardOpen] = useState(false);
  const [msiOpen, setMsiOpen] = useState(false);
  const today = todayISO();
  const load = useMemo(() => monthlyInstallmentLoad(plans, today, 6), [plans, today]);
  const active = plans.map((p) => ({ p, s: planStatus(p, today) })).filter((x) => !x.s.done);
  const done = plans.length - active.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tarjetas y MSI"
        back
        actions={
          <Button size="sm" onClick={() => setCardOpen(true)}>
            <Plus className="h-4 w-4" /> Tarjeta
          </Button>
        }
      />
      {cards.length === 0 ? (
        <EmptyState emoji="💳" title="Agrega tu tarjeta de crédito" text="Con tu fecha de corte y de pago te digo cuánto pagar para no generar intereses y te aviso antes de la fecha límite." action={<Button onClick={() => setCardOpen(true)}>Agregar tarjeta</Button>} />
      ) : (
        cards.map((a) => {
          const st = f.statements.find((s) => s.accountId === a.id);
          return (
            <Link key={a.id} to={`/cuentas/${a.id}`} className="block">
              <Card className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${a.color}, #111827)` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/70">{a.name}</p>
                    <p className="text-3xl font-bold">
                      <Money cents={st?.totalOwedCents ?? 0} />
                    </p>
                    <p className="text-xs text-white/70">debes en total</p>
                  </div>
                  {st && st.daysUntilDue >= 0 && st.remainingToPayCents > 0 && <Badge tone={st.daysUntilDue <= 3 ? 'bad' : 'warn'}>Paga en {st.daysUntilDue} d</Badge>}
                </div>
                {st ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-white/60">Sin intereses</p>
                      <p className="font-semibold">
                        <Money cents={st.remainingToPayCents} />
                      </p>
                    </div>
                    <div>
                      <p className="text-white/60">Fecha límite</p>
                      <p className="font-semibold">{formatLongDate(st.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-white/60">Próximo corte</p>
                      <p className="font-semibold">{formatLongDate(st.nextCutoffDate)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/80">Configura el corte y la fecha de pago →</p>
                )}
              </Card>
            </Link>
          );
        })
      )}

      <Card>
        <CardTitle
          action={
            <Button size="sm" variant="soft" onClick={() => setMsiOpen(true)}>
              <Plus className="h-4 w-4" /> Compra a MSI
            </Button>
          }
        >
          Meses sin intereses
        </CardTitle>
        {active.length === 0 ? (
          <p className="text-sm text-muted">No tienes MSI activos. Tip: escribe “tv 12000 a 12 msi con nu” y se crea solo.</p>
        ) : (
          <>
            <div className="mb-3 rounded-xl bg-surface-2 p-3">
              <p className="text-sm text-muted">Te falta pagar de MSI</p>
              <Money cents={totalInstallmentsRemaining(plans, today)} className="text-2xl font-bold text-ink" />
            </div>
            <ul className="space-y-3">
              {active.map(({ p, s }) => (
                <li key={p.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{p.description}</p>
                      <p className="text-sm text-muted">
                        {s.paidCount}/{p.months} · <Money cents={s.monthlyCents} />/mes · {accounts.find((a) => a.id === p.accountId)?.name ?? 'Sin tarjeta'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money cents={s.remainingCents} className="font-semibold text-ink" />
                      <button type="button" className="block text-xs text-rose-600" onClick={() => void deleteDoc('installmentPlans', p.id, 'Plan de MSI borrado')}>
                        Borrar
                      </button>
                    </div>
                  </div>
                  <ProgressBar className="mt-1.5" value={(s.paidCount / p.months) * 100} />
                </li>
              ))}
            </ul>
            <h3 className="mt-5 mb-2 text-sm font-semibold text-muted">Lo que ya tienes comprometido cada mes</h3>
            <div className="flex items-end gap-1.5" aria-label="MSI por mes">
              {load.map((m) => {
                const max = Math.max(...load.map((x) => x.amountCents), 1);
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg bg-accent-400" style={{ height: `${Math.max(4, (m.amountCents / max) * 90)}px` }} title={`${m.month}: ${(m.amountCents / 100).toFixed(0)}`} />
                    <span className="text-[0.65rem] text-muted">{formatMonthKey(m.month, false).slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {done > 0 && <p className="mt-3 text-xs text-muted">✅ {done} compras a meses ya liquidadas.</p>}
      </Card>
      <Tip>Los MSI se reparten mes a mes en tu presupuesto: así ves lo que realmente pagas cada mes, no el total de golpe.</Tip>

      <AccountForm open={cardOpen} onClose={() => setCardOpen(false)} defaultType="credit" />
      <MsiSheet open={msiOpen} onClose={() => setMsiOpen(false)} />
    </div>
  );
}

function MsiSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const allAccounts = useData((s) => s.data.accounts);
  const cards = allAccounts.filter((a) => a.type === 'credit' && !a.archived);
  const [description, setDescription] = useState('');
  const [total, setTotal] = useState(0);
  const [months, setMonths] = useState(12);
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [paidMonths, setPaidMonths] = useState(0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Compra a meses sin intereses"
      footer={
        <Button
          block
          disabled={!description || !total}
          onClick={async () => {
            const { plan, tx } = installmentPlanFromForm({ description, totalCents: total, months, accountId: accountId || cards[0]?.id || null, startDate, paidMonths, categoryId: 'shopping', annualRate: 0 });
            await applyChanges([
              { space: 'personal', col: 'installmentPlans', before: null, after: plan },
              { space: 'personal', col: 'transactions', before: null, after: tx },
            ]);
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-3">
        <Input label="¿Qué compraste?" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Refrigerador" />
        <MoneyInput label="Precio total" value={total} onChange={setTotal} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Meses" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} options={[3, 6, 9, 12, 13, 18, 24].map((m) => ({ value: String(m), label: `${m} meses` }))} />
          <Input label="Fecha de compra" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <Select label="Tarjeta" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={cards.length ? cards.map((c) => ({ value: c.id, label: c.name })) : [{ value: '', label: 'Sin tarjeta' }]} />
        <Input label="Mensualidades ya pagadas" type="number" min={0} max={months} value={paidMonths} onChange={(e) => setPaidMonths(Number(e.target.value) || 0)} hint="Si la compra es anterior y ya llevas algunos pagos." />
        {total > 0 && (
          <p className="text-sm text-muted">
            Pagarás <Money cents={Math.round(total / months)} className="font-semibold text-ink" /> al mes durante {months} meses.
          </p>
        )}
      </div>
    </Sheet>
  );
}
