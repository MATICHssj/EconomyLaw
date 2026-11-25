import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  addMonthsKey,
  daysBetween,
  formatLongDate,
  formatMonthKey,
  installmentsBetween,
  monthEnd,
  monthKey,
  monthStart,
  nextPayday,
  occurrencesBetween,
  spendingItems,
  tandaSchedule,
  weekday,
  type ISODate,
} from '@fina/core';
import { useFinance, useToday } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import { Card, IconButton, Money, PageHeader, cx } from '@/components/ui';

interface DayEvent {
  title: string;
  emoji: string;
  amountCents: number;
  direction: 'in' | 'out';
}

/** Calendario de dinero: días de pago, cobros, vencimientos y lo que gastaste cada día. */
export default function CalendarPage() {
  const today = useToday();
  const [month, setMonth] = useState(monthKey(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const f = useFinance();
  const recurring = useDocs('recurring');
  const plans = useDocs('installmentPlans');
  const txs = useDocs('transactions');
  const tandas = useData((s) => s.data.tandas);
  const accounts = useData((s) => s.data.accounts);
  const profile = useData((s) => s.profile);

  const { events, spent } = useMemo(() => {
    const from = monthStart(month);
    const to = monthEnd(month);
    const ev: Record<string, DayEvent[]> = {};
    const add = (d: string, e: DayEvent) => (ev[d] ??= []).push(e);
    for (const r of recurring.filter((x) => x.active))
      for (const d of occurrencesBetween(r, from, to))
        add(d, {
          title: r.name,
          emoji: r.template.kind === 'income' ? '💰' : '🔁',
          amountCents: r.template.amountCents,
          direction: r.template.kind === 'income' ? 'in' : 'out',
        });
    for (const c of installmentsBetween(plans, from, to))
      add(c.date, {
        title: `${c.description} ${c.n}/${c.of}`,
        emoji: '🗓️',
        amountCents: c.amountCents,
        direction: 'out',
      });
    for (const t of tandas.filter((x) => !x.archived))
      for (const r of tandaSchedule(t))
        if (r.date >= from && r.date <= to)
          add(r.date, {
            title: r.isMyTurn ? `¡Cobras la tanda ${t.name}!` : `Tanda ${t.name}`,
            emoji: '🫙',
            amountCents: r.isMyTurn ? t.contributionCents * t.participants : t.contributionCents,
            direction: r.isMyTurn ? 'in' : 'out',
          });
    for (const st of f.statements) {
      const acc = accounts.find((a) => a.id === st.accountId);
      if (st.dueDate >= from && st.dueDate <= to)
        add(st.dueDate, {
          title: `Límite de pago ${acc?.name ?? ''}`,
          emoji: '💳',
          amountCents: st.remainingToPayCents,
          direction: 'out',
        });
      if (st.nextCutoffDate >= from && st.nextCutoffDate <= to)
        add(st.nextCutoffDate, {
          title: `Corte ${acc?.name ?? ''}`,
          emoji: '✂️',
          amountCents: 0,
          direction: 'out',
        });
    }
    if (profile?.payday && !recurring.some((r) => r.active && r.template.kind === 'income')) {
      let d = nextPayday(from, profile.payday);
      let guard = 0;
      while (d && d <= to && guard++ < 10) {
        add(d, { title: 'Día de pago', emoji: '💵', amountCents: 0, direction: 'in' });
        d = nextPayday(addDays(d, 1), profile.payday);
      }
    }
    const sp: Record<string, number> = {};
    for (const it of spendingItems(txs, plans, { from, to }))
      sp[it.date] = (sp[it.date] ?? 0) + it.amountCents;
    return { events: ev, spent: sp };
  }, [month, recurring, plans, tandas, f.statements, accounts, profile, txs]);

  const first = monthStart(month);
  const offset = (weekday(first) + 6) % 7;
  const days: ISODate[] = [];
  for (let d = first; d <= monthEnd(month); d = addDays(d, 1)) days.push(d);
  const sel = events[selected] ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Calendario" subtitle="Tus pagos, cobros y vencimientos del mes." back />
      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <IconButton label="Mes anterior" onClick={() => setMonth((m) => addMonthsKey(m, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <span className="font-semibold text-ink">{formatMonthKey(month)}</span>
          <IconButton label="Mes siguiente" onClick={() => setMonth((m) => addMonthsKey(m, 1))}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <span key={d} className="pb-1">
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {days.map((d) => {
            const ev = events[d] ?? [];
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-label={`${formatLongDate(d)}${ev.length ? `, ${ev.length} eventos` : ''}`}
                aria-pressed={selected === d}
                className={cx(
                  'flex min-h-14 flex-col items-center gap-0.5 rounded-xl border p-1 transition',
                  selected === d
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/50'
                    : 'border-transparent hover:bg-surface-2',
                  d < today && 'opacity-70',
                )}
              >
                <span
                  className={cx(
                    'text-sm font-semibold',
                    isToday
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white'
                      : 'text-ink',
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                <span className="flex flex-wrap justify-center text-[0.65rem] leading-none">
                  {ev.slice(0, 3).map((e, i) => (
                    <span key={i}>{e.emoji}</span>
                  ))}
                </span>
                {spent[d] ? (
                  <span className="text-[0.6rem] text-muted tabular-nums">
                    {Math.round(spent[d] / 100)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold text-ink">{formatLongDate(selected, true)}</h2>
        {spent[selected] ? (
          <p className="text-sm text-muted">
            Gastaste <Money cents={spent[selected]!} className="font-semibold text-ink" /> este día.
          </p>
        ) : null}
        {sel.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin pagos ni cobros programados.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sel.map((e, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-xl">{e.emoji}</span>
                <span className="flex-1 text-ink">{e.title}</span>
                {e.amountCents > 0 && (
                  <Money
                    cents={e.amountCents}
                    kind={e.direction === 'in' ? 'income' : 'neutral'}
                    className="font-semibold"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {selected > today && (
          <p className="mt-3 text-xs text-muted">Faltan {daysBetween(today, selected)} días.</p>
        )}
      </Card>
    </div>
  );
}
