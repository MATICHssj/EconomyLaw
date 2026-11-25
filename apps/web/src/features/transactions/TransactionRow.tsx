import { useRef, useState, type PointerEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Transaction } from '@fina/core';
import { deleteTransaction } from '@/lib/actions';
import { useCategory } from '@/lib/finance';
import { useData, type WithSpace } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { Badge, Money, cx } from '@/components/ui';

const KIND_EMOJI: Partial<Record<Transaction['kind'], string>> = {
  transfer: '🔁',
  debt_payment: '💳',
  loan_given: '🤝',
  loan_received: '🤝',
  loan_collected: '✅',
  loan_repaid: '✅',
  investment: '📈',
  tanda: '🫙',
};

const IN_KINDS = new Set(['income', 'loan_received', 'loan_collected']);

/** Renglón de movimiento. En el celular se desliza a la izquierda para editar o borrar. */
export function TransactionRow({
  tx,
  showDate,
}: {
  tx: WithSpace<Transaction>;
  showDate?: boolean;
}) {
  const cat = useCategory(tx.categoryId);
  const accounts = useData((s) => s.data.accounts);
  const editTx = useUI((s) => s.editTx);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; dx: number } | null>(null);
  const moved = useRef(false);
  const account = accounts.find((a) => a.id === tx.accountId);
  const toAccount = accounts.find((a) => a.id === tx.toAccountId);
  const emoji = KIND_EMOJI[tx.kind] ?? cat.emoji;
  const isIn = IN_KINDS.has(tx.kind);
  const neutral = tx.kind === 'transfer' || tx.kind === 'debt_payment' || tx.kind === 'investment';

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY, dx };
    moved.current = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!moved.current && Math.abs(ddy) > Math.abs(ddx)) {
      start.current = null;
      return;
    }
    if (Math.abs(ddx) > 6) moved.current = true;
    setDx(Math.max(-140, Math.min(0, start.current.dx + ddx)));
  };
  const onUp = () => {
    if (!start.current) return;
    setDx((v) => (v < -60 ? -140 : 0));
    start.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[140px] transition-opacity"
        style={{ opacity: dx < 0 ? 1 : 0 }}
        aria-hidden={dx === 0}
      >
        <button
          type="button"
          className="flex flex-1 items-center justify-center bg-accent-600 text-white"
          onClick={() => {
            setDx(0);
            editTx(tx.id);
          }}
          aria-label="Editar"
        >
          <Pencil className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center bg-rose-600 text-white"
          onClick={() => {
            setDx(0);
            void deleteTransaction(tx.id);
          }}
          aria-label="Borrar"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      <button
        type="button"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => {
          if (moved.current) return;
          if (dx !== 0) setDx(0);
          else editTx(tx.id);
        }}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className="relative flex w-full items-center gap-3 bg-surface px-2 py-2.5 text-left transition-transform duration-150 hover:bg-surface-2"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: `${cat.color}1f` }}
          aria-hidden
        >
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{tx.description}</span>
            {tx.status === 'review' && <Badge tone="warn">Revisar</Badge>}
            {tx.space === 'household' && <span title="Compartido en el hogar">🏠</span>}
          </div>
          <div className="truncate text-sm text-muted">
            {neutral
              ? toAccount
                ? `${account?.name ?? '—'} → ${toAccount.name}`
                : account?.name
              : cat.name}
            {!neutral && account && ` · ${account.name}`}
            {showDate && ` · ${tx.date.slice(8)}/${tx.date.slice(5, 7)}`}
            {tx.installmentPlanId && ' · MSI'}
            {tx.myShareCents !== undefined && ' · compartido'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Money
            cents={tx.amountCents}
            currency={tx.currency}
            kind={isIn ? 'income' : neutral ? 'neutral' : 'expense'}
            className={cx('font-semibold', !isIn && !neutral && 'text-ink')}
          />
          {tx.myShareCents !== undefined && (
            <div className="text-xs text-muted">
              tu parte <Money cents={tx.myShareCents} />
            </div>
          )}
          {tx.currency !== 'MXN' && (
            <div className="text-xs text-muted">
              ≈ <Money cents={tx.amountMxnCents} />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
