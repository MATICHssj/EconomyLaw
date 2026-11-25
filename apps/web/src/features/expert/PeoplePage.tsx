import { useEffect, useState } from 'react';
import { Plus, User } from 'lucide-react';
import {
  balancesByPerson,
  formatLongDate,
  newId,
  todayISO,
  type Loan,
  type Split,
  type Transaction,
} from '@fina/core';
import { commitWithUndo, defaultAccountId, saveDoc } from '@/lib/actions';
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
  Segmented,
  Sheet,
  Tip,
} from '@/components/ui';

export default function PeoplePage() {
  const loans = useData((s) => s.data.loans);
  const splits = useData((s) => s.data.splits);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [paying, setPaying] = useState<Loan | null>(null);
  const people = balancesByPerson(loans, splits);
  const owedToMe = people.filter((p) => p.netCents > 0).reduce((s, p) => s + p.netCents, 0);
  const iOwe = people.filter((p) => p.netCents < 0).reduce((s, p) => s - p.netCents, 0);
  const open = loans.filter((l) => !l.closed);
  const openSplits = splits.filter((s) => s.participants.some((p) => !p.isMe && !p.paid));

  const blank = (): Loan => ({
    id: newId(),
    person: '',
    direction: 'lent',
    amountCents: 0,
    paidCents: 0,
    dueDate: null,
    createdAt: new Date().toISOString(),
    closed: false,
  });

  async function toggleSplit(split: Split & { space?: 'personal' | 'household' }, idx: number) {
    const { space, ...s } = split;
    await saveDoc('splits', {
      ...s,
      space,
      participants: s.participants.map((p, i) => (i === idx ? { ...p, paid: !p.paid } : p)),
    });
  }
  async function renameSplit(
    split: Split & { space?: 'personal' | 'household' },
    idx: number,
    name: string,
  ) {
    const { space, ...s } = split;
    await saveDoc('splits', {
      ...s,
      space,
      participants: s.participants.map((p, i) => (i === idx ? { ...p, name } : p)),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Préstamos y compartidos"
        back
        actions={
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> Préstamo
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-xs text-muted">Te deben</p>
          <Money cents={owedToMe} className="text-xl font-bold text-income" />
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted">Debes</p>
          <Money cents={iOwe} className="text-xl font-bold text-ink" />
        </Card>
      </div>
      {people.length === 0 && openSplits.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="Cuentas claras con todos"
          text='Escribe "le presté 200 a Juan" o "cena 900 entre 3" y aquí verás quién te debe.'
        />
      ) : (
        <Card>
          <CardTitle>Por persona</CardTitle>
          <ul className="space-y-2">
            {people.map((p) => (
              <li key={p.person} className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <User className="h-4 w-4 text-muted" aria-hidden />
                  {p.person}
                </span>
                <span className="text-sm">
                  {p.netCents > 0 ? (
                    <>
                      te debe <Money cents={p.netCents} className="font-semibold text-income" />
                    </>
                  ) : (
                    <>
                      le debes <Money cents={-p.netCents} className="font-semibold text-ink" />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {open.length > 0 && (
        <Card className="p-2">
          <CardTitle className="px-2 pt-2">Préstamos abiertos</CardTitle>
          {open.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setEditing(l)}
              >
                <p className="font-medium text-ink">
                  {l.direction === 'lent' ? `Le prestaste a ${l.person}` : `${l.person} te prestó`}
                  {l.dueDate && l.dueDate < todayISO() && <Badge tone="bad">vencido</Badge>}
                </p>
                <p className="text-sm text-muted">
                  Pagado <Money cents={l.paidCents} /> de <Money cents={l.amountCents} />
                  {l.dueDate && ` · para el ${formatLongDate(l.dueDate)}`}
                </p>
              </button>
              <Button size="sm" variant="soft" onClick={() => setPaying(l)}>
                Abono
              </Button>
            </div>
          ))}
        </Card>
      )}
      {openSplits.length > 0 && (
        <Card>
          <CardTitle>Gastos compartidos</CardTitle>
          <ul className="space-y-4">
            {openSplits.map((s) => (
              <li key={s.id}>
                <p className="font-medium text-ink">
                  {s.description} · <Money cents={s.totalCents} />{' '}
                  <span className="text-sm text-muted">({formatLongDate(s.date)})</span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {s.participants.map((p, i) =>
                    p.isMe ? null : (
                      <li key={i} className="flex items-center gap-2">
                        <input
                          aria-label={`¿${p.name} ya pagó?`}
                          type="checkbox"
                          checked={p.paid}
                          onChange={() => void toggleSplit(s, i)}
                          className="h-5 w-5 accent-[var(--a-600)]"
                        />
                        <input
                          aria-label="Nombre"
                          defaultValue={p.name}
                          onBlur={(e) =>
                            e.target.value !== p.name && void renameSplit(s, i, e.target.value)
                          }
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-ink hover:border-line focus:border-accent-500"
                        />
                        <Money
                          cents={p.shareCents}
                          className={p.paid ? 'text-muted line-through' : 'font-semibold text-ink'}
                        />
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Toca un nombre para cambiarlo. Cuando te paguen, márcalo o escribe “Ana me pagó 300”.
          </p>
        </Card>
      )}
      <Tip>
        Prestar a familia y amigos es normal en México. Anótalo para que no se te olvide… ni a ellos
      </Tip>
      <LoanSheet value={editing} onClose={() => setEditing(null)} />
      <PaymentSheet loan={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

function LoanSheet({ value, onClose }: { value: Loan | null; onClose: () => void }) {
  const [d, setD] = useState<Loan | null>(value);
  useEffect(() => {
    setD(value);
  }, [value]);
  if (!d) return null;
  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title="Préstamo"
      footer={
        <Button
          block
          disabled={!d.person || !d.amountCents}
          onClick={() => {
            void saveDoc(
              'loans',
              { ...d, closed: d.paidCents >= d.amountCents },
              'Préstamo guardado',
            );
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-3">
        <Segmented
          value={d.direction}
          onChange={(v) => setD({ ...d, direction: v })}
          options={[
            { value: 'lent', label: 'Yo presté' },
            { value: 'borrowed', label: 'Me prestaron' },
          ]}
        />
        <Input
          label="Persona"
          value={d.person}
          onChange={(e) => setD({ ...d, person: e.target.value })}
        />
        <MoneyInput
          label="Monto"
          value={d.amountCents}
          onChange={(v) => setD({ ...d, amountCents: v })}
        />
        <MoneyInput
          label="Ya pagado"
          value={d.paidCents}
          onChange={(v) => setD({ ...d, paidCents: v })}
        />
        <Input
          label="Fecha para pagar (opcional)"
          type="date"
          value={d.dueDate ?? ''}
          onChange={(e) => setD({ ...d, dueDate: e.target.value || null })}
        />
        <Input
          label="Nota"
          value={d.note ?? ''}
          onChange={(e) => setD({ ...d, note: e.target.value || undefined })}
        />
      </div>
    </Sheet>
  );
}

function PaymentSheet({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    setAmount(loan ? loan.amountCents - loan.paidCents : 0);
  }, [loan]);
  if (!loan) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={loan.direction === 'lent' ? `${loan.person} te pagó` : `Le pagaste a ${loan.person}`}
      footer={
        <Button
          block
          disabled={!amount}
          onClick={async () => {
            const stamp = new Date().toISOString();
            const tx: Transaction = {
              id: newId(),
              kind: loan.direction === 'lent' ? 'loan_collected' : 'loan_repaid',
              amountCents: amount,
              currency: 'MXN',
              amountMxnCents: amount,
              accountId: defaultAccountId(),
              toAccountId: null,
              categoryId: null,
              tags: [],
              description:
                loan.direction === 'lent' ? `${loan.person} me pagó` : `Le pagué a ${loan.person}`,
              date: todayISO(),
              createdAt: stamp,
              updatedAt: stamp,
              source: 'app',
              status: 'cleared',
              reconciled: false,
              person: loan.person,
              loanId: loan.id,
              attachments: [],
            };
            const { space, ...l } = loan as Loan & { space?: 'personal' | 'household' };
            const paid = l.paidCents + amount;
            await commitWithUndo(
              [
                { space: space ?? 'personal', col: 'transactions', before: null, after: tx },
                {
                  space: space ?? 'personal',
                  col: 'loans',
                  before: l,
                  after: { ...l, paidCents: paid, closed: paid >= l.amountCents },
                },
              ],
              paid >= l.amountCents ? '¡Préstamo liquidado!' : 'Abono registrado',
            );
            onClose();
          }}
        >
          Registrar
        </Button>
      }
    >
      <MoneyInput label="Monto" value={amount} onChange={setAmount} autoFocus />
    </Sheet>
  );
}
