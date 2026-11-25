import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, Filter, Search, X } from 'lucide-react';
import {
  addMonthsKey,
  categoryFilterIds,
  formatMonthKey,
  formatRelativeDay,
  monthEnd,
  monthKey,
  monthStart,
  CATEGORY_FAMILIES,
  isSpending,
  normalizeText,
  spendingAmount,
  type Transaction,
} from '@fina/core';
import { useToday } from '@/lib/finance';
import { useData, useDocs, type WithSpace } from '@/stores/data';
import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  LinkButton,
  Money,
  PageHeader,
  Select,
  Button,
} from '@/components/ui';
import { useUI } from '@/stores/ui';
import { TransactionRow } from './TransactionRow';
import { exportTransactionsCsv } from '@/lib/exporter';
import { SpaceSwitcher } from '@/features/household/SpaceSwitcher';

type KindFilter = 'all' | 'expense' | 'income' | 'other' | 'review';

export function TransactionsPage() {
  const txs = useDocs('transactions');
  const accounts = useData((s) => s.data.accounts);
  const categories = useData((s) => s.data.categories);
  const today = useToday();
  const openCapture = useUI((s) => s.openCapture);
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState(params.get('cat') ?? '');
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [showFilters, setShowFilters] = useState(!!(params.get('cat') || params.get('from')));
  // Al llegar desde Inicio o Reportes ("ver los gastos de esta categoría").
  useEffect(() => {
    const cat = params.get('cat');
    if (cat === null && !params.get('from')) return;
    setCategoryId(cat ?? '');
    setFrom(params.get('from') ?? '');
    setTo(params.get('to') ?? '');
    setShowFilters(true);
  }, [params]);
  const catIds = useMemo(() => categoryFilterIds(categoryId), [categoryId]);
  const [limit, setLimit] = useState(150);

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    const tagQ = nq.startsWith('#') ? nq.slice(1) : null;
    return txs
      .filter((t) => {
        if (kind === 'expense' && t.kind !== 'expense') return false;
        if (kind === 'income' && t.kind !== 'income') return false;
        if (kind === 'other' && (t.kind === 'expense' || t.kind === 'income')) return false;
        if (kind === 'review' && t.status !== 'review' && t.categoryId !== 'review') return false;
        if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
        if (catIds && !catIds.has(t.categoryId ?? '')) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        if (tagQ) return t.tags.some((tg) => tg.includes(tagQ));
        if (nq)
          return normalizeText(
            `${t.description} ${t.merchant ?? ''} ${t.note ?? ''} ${t.tags.join(' ')} ${(t.amountCents / 100).toString()}`,
          ).includes(nq);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [txs, q, kind, accountId, catIds, from, to]);

  const groups = useMemo(() => {
    const map = new Map<string, WithSpace<Transaction>[]>();
    for (const t of filtered.slice(0, limit)) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [filtered, limit]);

  const totalSpent = filtered.filter(isSpending).reduce((s, t) => s + spendingAmount(t), 0);
  const totalIncome = filtered
    .filter((t) => t.kind === 'income')
    .reduce((s, t) => s + t.amountMxnCents, 0);
  const reviewCount = txs.filter((t) => t.status === 'review' || t.categoryId === 'review').length;
  const activeFilters = [accountId, categoryId, from, to].filter(Boolean).length;
  const thisMonth = monthKey(today);
  const lastMonth = addMonthsKey(thisMonth, -1);
  const periods = [
    { label: 'Este mes', from: monthStart(thisMonth), to: monthEnd(thisMonth) },
    {
      label: formatMonthKey(lastMonth, false),
      from: monthStart(lastMonth),
      to: monthEnd(lastMonth),
    },
    { label: 'Este año', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
    { label: 'Todo', from: '', to: '' },
  ];
  const categoryLabel = categoryId.startsWith('fam:')
    ? CATEGORY_FAMILIES[categoryId.slice(4)]?.label
    : categories.find((c) => c.id === categoryId)?.name;
  const periodLabel =
    !from && !to
      ? 'en total'
      : (periods.find((p) => p.from === from && p.to === to)?.label.toLowerCase() ??
        `del ${from || '…'} al ${to || '…'}`);

  return (
    <div>
      <PageHeader
        title="Movimientos"
        actions={
          <>
            <IconButton label="Exportar a CSV" onClick={() => void exportTransactionsCsv(filtered)}>
              <Download className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      <SpaceSwitcher className="mb-3" />
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-bg/95 px-4 pt-1 pb-2 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (tacos, oxxo, #viaje, 120…)"
              aria-label="Buscar movimientos"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-ink outline-none"
            />
            {q && (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ('')}>
                <X className="h-4 w-4 text-muted" />
              </button>
            )}
          </div>
          <IconButton
            label="Filtros"
            onClick={() => setShowFilters((v) => !v)}
            className={activeFilters ? 'bg-accent-50 text-accent-700' : ''}
          >
            <Filter className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {(
            [
              ['all', 'Todos'],
              ['expense', 'Gastos'],
              ['income', 'Ingresos'],
              ['other', 'Transferencias y más'],
              ['review', `Por revisar${reviewCount ? ` (${reviewCount})` : ''}`],
            ] as Array<[KindFilter, string]>
          ).map(([v, l]) => (
            <Chip key={v} active={kind === v} onClick={() => setKind(v)}>
              {l}
            </Chip>
          ))}
        </div>
        {showFilters && (
          <Card className="grid grid-cols-2 gap-2 p-3">
            <Select
              aria-label="Cuenta"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={[
                { value: '', label: 'Todas las cuentas' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
            <Select
              aria-label="Categoría"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...Object.entries(CATEGORY_FAMILIES).map(([id, fam]) => ({
                  value: `fam:${id}`,
                  label: `${fam.label} (${fam.hint})`,
                })),
                ...categories
                  .filter((c) => !c.archived)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <div className="col-span-2 flex flex-wrap gap-2">
              {periods.map((p) => (
                <Chip
                  key={p.label}
                  active={from === p.from && to === p.to}
                  onClick={() => {
                    setFrom(p.from);
                    setTo(p.to);
                  }}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <label className="text-xs text-muted">
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink"
              />
            </label>
            <label className="text-xs text-muted">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink"
              />
            </label>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2"
                onClick={() => {
                  setAccountId('');
                  setCategoryId('');
                  setFrom('');
                  setTo('');
                }}
              >
                Quitar filtros
              </Button>
            )}
          </Card>
        )}
        {categoryLabel && (
          <Card className="bg-accent-50/60 dark:bg-accent-950/30">
            <p className="text-sm text-muted">
              {categoryLabel} · {periodLabel}
            </p>
            <Money cents={totalSpent} className="text-2xl font-bold text-ink" />
            <p className="text-sm text-muted">
              {filtered.filter(isSpending).length} compras
              {filtered.filter(isSpending).length > 0 && (
                <>
                  {' '}
                  · promedio{' '}
                  <Money
                    cents={Math.round(totalSpent / filtered.filter(isSpending).length)}
                    className="text-ink"
                  />
                </>
              )}
            </p>
          </Card>
        )}
        {!categoryLabel && (q || activeFilters > 0 || kind !== 'all') && filtered.length > 0 && (
          <p className="text-sm text-muted">
            {filtered.length} movimientos · gastos{' '}
            <Money cents={totalSpent} className="font-semibold text-ink" />
            {totalIncome > 0 && (
              <>
                {' '}
                · ingresos <Money cents={totalIncome} kind="income" className="font-semibold" />
              </>
            )}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        txs.length === 0 ? (
          <EmptyState
            emoji="✍️"
            title="Aún no hay movimientos"
            text='Toca el botón + y escribe algo como "galleta 30". Así de fácil.'
            action={<Button onClick={() => openCapture()}>Anotar mi primer gasto</Button>}
          />
        ) : (
          <EmptyState
            emoji="🔍"
            title="Sin resultados"
            text="Prueba con otra palabra o quita los filtros."
          />
        )
      ) : (
        <div className="mt-2 space-y-4">
          {groups.map(([date, items]) => {
            const daySpent = items.filter(isSpending).reduce((s, t) => s + spendingAmount(t), 0);
            return (
              <section key={date}>
                <div className="mb-1 flex items-center justify-between px-2">
                  <h2 className="text-sm font-semibold text-muted">
                    {formatRelativeDay(date, today)}
                  </h2>
                  {daySpent > 0 && (
                    <Money cents={daySpent} kind="expense" className="text-sm text-muted" />
                  )}
                </div>
                <Card className="p-1">
                  {items.map((t) => (
                    <TransactionRow key={t.id} tx={t} />
                  ))}
                </Card>
              </section>
            );
          })}
          {filtered.length > limit && (
            <Button variant="secondary" block onClick={() => setLimit((l) => l + 200)}>
              Ver más ({filtered.length - limit} restantes)
            </Button>
          )}
        </div>
      )}
      {txs.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted">
          Tip: en el celular desliza un movimiento a la izquierda para editarlo o borrarlo. ¿Tienes
          un estado de cuenta?{' '}
          <LinkButton to="/importar" variant="ghost" size="sm">
            Impórtalo
          </LinkButton>
        </p>
      )}
    </div>
  );
}
