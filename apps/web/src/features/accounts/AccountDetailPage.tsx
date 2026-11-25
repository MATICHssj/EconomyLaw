import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { CheckCheck, Pencil, Scale } from 'lucide-react';
import {
  ACCOUNT_TYPE_LABELS,
  formatLongDate,
  interestIfMinimum,
  isFeatureVisible,
  newId,
  todayISO,
  type Transaction,
} from '@fina/core';
import { applyChanges, commitWithUndo } from '@/lib/actions';
import { useFinance } from '@/lib/finance';
import { useData } from '@/stores/data';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Money,
  MoneyInput,
  PageHeader,
  ProgressBar,
  Sheet,
  Stat,
  Tip,
} from '@/components/ui';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { AccountForm } from './AccountForm';

export default function AccountDetailPage() {
  const { id } = useParams();
  const account = useData((s) => s.data.accounts.find((a) => a.id === id));
  const allTxs = useData((s) => s.data.transactions);
  const level = useData((s) => s.profile?.level ?? 'basic');
  const f = useFinance();
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [target, setTarget] = useState(0);
  const txs = useMemo(
    () =>
      allTxs
        .filter((t) => t.accountId === id || t.toAccountId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [allTxs, id],
  );
  if (!account) return <EmptyState emoji="🤷" title="Cuenta no encontrada" />;
  const balance = f.balances[account.id] ?? 0;
  const isCredit = account.type === 'credit';
  const st = f.statements.find((s) => s.accountId === account.id);
  const expert = isFeatureVisible(level, 'reconciliation');
  const unreconciled = txs.filter((t) => !t.reconciled);
  const reconciledBalance =
    account.openingBalanceCents +
    txs
      .filter((t) => t.reconciled)
      .reduce(
        (s, t) =>
          s +
          (t.toAccountId === account.id
            ? t.amountMxnCents
            : t.kind === 'income' || t.kind === 'loan_received' || t.kind === 'loan_collected'
              ? t.amountMxnCents
              : -t.amountMxnCents),
        0,
      );

  async function adjust() {
    const current = isCredit ? -balance : balance;
    const delta = target - current;
    if (!delta) return setAdjustOpen(false);
    const realDelta = isCredit ? -delta : delta;
    const stamp = new Date().toISOString();
    const tx: Transaction = {
      id: newId(),
      kind: realDelta > 0 ? 'income' : 'expense',
      amountCents: Math.abs(realDelta),
      currency: 'MXN',
      amountMxnCents: Math.abs(realDelta),
      accountId: account!.id,
      toAccountId: null,
      categoryId: 'adjustment',
      tags: [],
      description: 'Ajuste de saldo',
      date: todayISO(),
      createdAt: stamp,
      updatedAt: stamp,
      source: 'app',
      status: 'cleared',
      reconciled: true,
      attachments: [],
    };
    await commitWithUndo(
      [{ space: account!.space, col: 'transactions', before: null, after: tx }],
      'Saldo ajustado',
    );
    setAdjustOpen(false);
  }

  async function reconcileAll() {
    await applyChanges(
      unreconciled.map((t) => ({
        space: t.space,
        col: 'transactions' as const,
        before: t,
        after: { ...t, reconciled: true },
      })),
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={account.name}
        subtitle={ACCOUNT_TYPE_LABELS[account.type]}
        back="/cuentas"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        }
      />
      <Card>
        <p className="text-sm text-muted">{isCredit ? 'Debes' : 'Saldo actual'}</p>
        <Money
          cents={isCredit ? Math.max(0, -balance) : balance}
          className="text-4xl font-extrabold text-ink"
        />
        {isCredit && account.credit?.limitCents ? (
          <div className="mt-3">
            <ProgressBar
              value={st?.utilizationPct ?? 0}
              status={
                (st?.utilizationPct ?? 0) > 70
                  ? 'over'
                  : (st?.utilizationPct ?? 0) > 30
                    ? 'warn'
                    : 'ok'
              }
              label="Uso de la línea"
            />
            <p className="mt-1 text-sm text-muted">
              Usas {st?.utilizationPct ?? 0} % de tu línea · disponible{' '}
              <Money cents={st?.availableCreditCents ?? 0} />
            </p>
          </div>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 -ml-2"
          onClick={() => {
            setTarget(isCredit ? -balance : balance);
            setAdjustOpen(true);
          }}
        >
          <Scale className="h-4 w-4" /> Ajustar saldo
        </Button>
      </Card>

      {isCredit && st && (
        <Card>
          <CardTitle>Estado de cuenta (corte del {formatLongDate(st.cutoffDate)})</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Pago para no generar intereses"
              value={<Money cents={st.noInterestPaymentCents} />}
              hint={
                st.msiInStatementCents ? (
                  <>
                    incluye <Money cents={st.msiInStatementCents} /> de MSI
                  </>
                ) : undefined
              }
            />
            <Stat label="Pago mínimo (aprox.)" value={<Money cents={st.minimumPaymentCents} />} />
            <Stat
              label="Fecha límite de pago"
              value={formatLongDate(st.dueDate)}
              hint={st.daysUntilDue >= 0 ? `en ${st.daysUntilDue} días` : 'ya pasó'}
            />
            <Stat
              label="Te falta pagar"
              value={<Money cents={st.remainingToPayCents} />}
              hint={
                st.paidSinceCutoffCents ? (
                  <>
                    ya abonaste <Money cents={st.paidSinceCutoffCents} />
                  </>
                ) : undefined
              }
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            Compras después del corte:{' '}
            <Money cents={st.currentPeriodChargesCents} className="font-semibold text-ink" /> (van a
            tu siguiente estado de cuenta, corte {formatLongDate(st.nextCutoffDate)}).
          </p>
          {st.remainingToPayCents > 0 && account.credit && (
            <Tip emoji="⚠️" className="mt-3">
              Si solo pagas el mínimo, generas cerca de{' '}
              <b>
                <Money
                  cents={interestIfMinimum(
                    st.remainingToPayCents - st.minimumPaymentCents,
                    account.credit.annualRate,
                  )}
                />
              </b>{' '}
              de intereses (+IVA) el próximo mes. Paga el “pago para no generar intereses” siempre
              que puedas.
            </Tip>
          )}
        </Card>
      )}

      {expert && txs.length > 0 && (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Conciliación</p>
            <p className="text-sm text-muted">
              {unreconciled.length} sin conciliar · saldo conciliado{' '}
              <Money cents={reconciledBalance} />
            </p>
          </div>
          {unreconciled.length > 0 && (
            <Button size="sm" variant="soft" onClick={() => void reconcileAll()}>
              <CheckCheck className="h-4 w-4" /> Conciliar todo
            </Button>
          )}
        </Card>
      )}

      <Card className="p-2">
        <CardTitle className="px-2 pt-2">
          Movimientos {txs.length > 0 && <Badge>{txs.length}</Badge>}
        </CardTitle>
        {txs.length === 0 ? (
          <p className="p-4 text-sm text-muted">Sin movimientos todavía.</p>
        ) : (
          txs.slice(0, 100).map((t) => <TransactionRow key={t.id} tx={t} showDate />)
        )}
      </Card>

      <AccountForm open={editOpen} account={account} onClose={() => setEditOpen(false)} />
      <Sheet
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Ajustar saldo"
        footer={
          <Button block onClick={() => void adjust()}>
            Ajustar
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Escribe el saldo {isCredit ? 'que debes' : 'que tienes'} hoy según tu banco. Creo un
            movimiento de “Ajuste de saldo” por la diferencia (no cuenta como gasto).
          </p>
          <MoneyInput
            label={isCredit ? 'Lo que debes hoy' : 'Saldo real hoy'}
            value={target}
            onChange={setTarget}
            autoFocus
          />
        </div>
      </Sheet>
    </div>
  );
}
