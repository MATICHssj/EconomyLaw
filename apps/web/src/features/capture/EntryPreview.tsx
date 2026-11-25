import { formatMoney, formatRelativeDay, INSTITUTION_MAP, splitCents } from '@fina/core';
import type { ParsedEntry } from '@fina/parser';
import { Repeat, User } from 'lucide-react';
import { useCategory, useToday } from '@/lib/finance';
import { CatIcon, IconTile, kindIcon } from '@/components/icons';
import { useData } from '@/stores/data';
import { Badge, cx } from '@/components/ui';

const KIND_LABELS: Record<ParsedEntry['kind'], string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  debt_payment: 'Pago de tarjeta',
  loan_given: 'Préstamo',
  loan_received: 'Te prestaron',
  loan_collected: 'Te pagaron',
  loan_repaid: 'Pagaste deuda',
  investment: 'Inversión',
  tanda: 'Tanda',
};

/** Vista previa en vivo: "Tiendita · −$30 · Efectivo · Hoy" */
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
  const KindIco = showCategory ? undefined : kindIcon(entry.kind);
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3',
        compact && 'p-2.5',
      )}
    >
      {KindIco ? <IconTile icon={KindIco} /> : <CatIcon category={cat} />}
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
          <span>{showCategory ? cat.name : kind}</span>
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
              <Repeat className="mr-1 inline h-3 w-3" aria-hidden />
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
          {entry.person && (
            <Badge>
              <User className="mr-1 inline h-3 w-3" aria-hidden />
              {entry.person}
            </Badge>
          )}
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
