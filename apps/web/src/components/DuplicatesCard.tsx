import { useMemo } from 'react';
import { Copy } from 'lucide-react';
import { formatRelativeDay, pendingDuplicates, type Transaction } from '@fina/core';
import { resolveDuplicate } from '@/lib/actions';
import { useToday } from '@/lib/finance';
import { useData } from '@/stores/data';
import { Button, Card, Money } from './ui';

/** "¿Es el mismo gasto?": lo que llegó del banco vs. lo que anotaste a mano. */
export function DuplicatesCard() {
  const transactions = useData((s) => s.data.transactions);
  const accounts = useData((s) => s.data.accounts);
  const today = useToday();
  const pending = useMemo(() => pendingDuplicates(transactions), [transactions]);
  if (!pending.length) return null;
  const accountName = (t: Transaction) => accounts.find((a) => a.id === t.accountId)?.name;
  const line = (t: Transaction) =>
    [formatRelativeDay(t.date, today), accountName(t)].filter(Boolean).join(' · ');
  return (
    <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/30">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Copy className="h-5 w-5 text-sky-600" />
        {pending.length === 1
          ? '¿Es el mismo gasto?'
          : `¿Son los mismos gastos? (${pending.length})`}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {pending.slice(0, 5).map(({ bank, manual }) => (
          <li key={bank.id} className="py-2.5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-xs text-muted">Tú anotaste</p>
                <p className="truncate font-medium text-ink">{manual.description}</p>
                <Money cents={manual.amountMxnCents} className="font-semibold text-ink" />
                <p className="truncate text-xs text-muted">{line(manual)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Llegó del banco</p>
                <p className="truncate font-medium text-ink">{bank.merchant ?? bank.description}</p>
                <Money cents={bank.amountMxnCents} className="font-semibold text-ink" />
                <p className="truncate text-xs text-muted">{line(bank)}</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void resolveDuplicate(bank.id, true)}>
                Sí, es el mismo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void resolveDuplicate(bank.id, false)}
              >
                No, son dos
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
