import { formatMoney, formatRelativeDay, INSTITUTION_MAP, splitCents } from '@fina/core';
import type { ParsedEntry } from '@fina/parser';
import { useCategory, useToday } from '@/lib/finance';
import { useData } from '@/stores/data';
import { Badge, cx } from '@/components/ui';

const KIND_LABELS: Record<ParsedEntry['kind'], { label: string; emoji: string }> = {
  expense: { label: 'Gasto', emoji: '' },
  income: { label: 'Ingreso', emoji: '💰' },
  transfer: { label: 'Transferencia', emoji: '🔁' },
  debt_payment: { label: 'Pago de tarjeta', emoji: '💳' },
  loan_given: { label: 'Préstamo', emoji: '🤝' },
  loan_received: { label: 'Te prestaron', emoji: '🤝' },
  loan_collected: { label: 'Te pagaron', emoji: '✅' },
  loan_repaid: { label: 'Pagaste deuda', emoji: '✅' },
  investment: { label: 'Inversión', emoji: '📈' },
  tanda: { label: 'Tanda', emoji: '🫙' },
};

/** Vista previa en vivo: "🍪 Tiendita · −$30 · Efectivo · Hoy" */
export function EntryPreview({ entry, compact }: { entry: ParsedEntry; compact?: boolean }) {
  const cat = useCategory(entry.categoryId ?? (entry.kind === 'expense' ? 'review' : null));
  const accounts = useData((s) => s.data.accounts);
  const today = useToday();
  const kind = KIND_LABELS[entry.kind];
  const accountName = (id?: string, hint?: string) =>
    accounts.find((a) => a.id === id)?.name ??
    (hint ? (INSTITUTION_MAP[hint]?.name ?? hint) : undefined);
  const from = accountName(entry.accountId, entry.accountHint);
  const to = accountName(entry.toAccountId, entry.toAccountHint);
  const isIn =
    entry.kind === 'income' || entry.kind === 'loan_collected' || entry.kind === 'loan_received';
  const showCategory = entry.kind === 'expense' || entry.kind === 'income';
  const emoji = showCategory ? cat.emoji : kind.emoji;
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3',
        compact && 'p-2.5',
      )}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{ background: `${cat.color}22` }}
        aria-hidden
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-ink">{entry.description}</span>
          <span
            className={cx(
              'shrink-0 text-lg font-bold tabular-nums',
              isIn ? 'text-income' : 'text-ink',
            )}
          >
            {isIn ? '+' : entry.kind === 'expense' ? '−' : ''}
            {formatMoney(entry.amountCents, { currency: entry.currency })}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <span>{showCategory ? cat.name : kind.label}</span>
          {from && <span>· {from}</span>}
          {to && <span>→ {to}</span>}
          <span>· {formatRelativeDay(entry.date, today)}</span>
          {entry.currency !== 'MXN' && <span>· ≈ {formatMoney(entry.amountMxnCents)}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {entry.installments && (
            <Badge tone="accent">
              {entry.installments} MSI ·{' '}
              {formatMoney(splitCents(entry.amountMxnCents, entry.installments)[0]!)}/mes
            </Badge>
          )}
          {entry.splitCount && (
            <Badge tone="accent">
              Entre {entry.splitCount}: tu parte{' '}
              {formatMoney(splitCents(entry.amountMxnCents, entry.splitCount)[0]!)}
            </Badge>
          )}
          {entry.recurrence && (
            <Badge tone="accent">
              🔁{' '}
              {
                {
                  weekly: 'Cada semana',
                  biweekly: 'Cada quincena',
                  monthly: 'Cada mes',
                  yearly: 'Cada año',
                }[entry.recurrence]
              }
            </Badge>
          )}
          {entry.person && <Badge>👤 {entry.person}</Badge>}
          {entry.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          {entry.confidence < 0.6 && entry.kind === 'expense' && (
            <Badge tone="warn">Por revisar</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
