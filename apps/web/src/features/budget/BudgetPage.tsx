import { CatIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Repeat, Sparkles, Trash2 } from 'lucide-react';
import {
  addMonthsKey,
  budgetProgress,
  fiftyThirtyTwenty,
  formatMonthKey,
  isFeatureVisible,
  monthEnd,
  monthKey,
  monthStart,
  summarizePeriod,
  suggestBudgetLines,
  zeroBasedState,
  type Budget,
  type BudgetLine,
} from '@fina/core';
import { saveDoc } from '@/lib/actions';
import { useCategoryMap, useToday } from '@/lib/finance';
import { useData, useDocs } from '@/stores/data';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  IconButton,
  Money,
  MoneyInput,
  PageHeader,
  ProgressBar,
  Segmented,
  Sheet,
  Tip,
  Toggle,
  cx,
} from '@/components/ui';
import { CategoryPicker } from '@/features/transactions/CategoryPicker';
import { SpaceSwitcher } from '@/features/household/SpaceSwitcher';

type Method = Budget['method'];

export default function BudgetPage() {
  const today = useToday();
  const [month, setMonth] = useState(monthKey(today));
  const txs = useDocs('transactions');
  const plans = useDocs('installmentPlans');
  const budgets = useDocs('budgets');
  const categories = useData((s) => s.data.categories);
  const catMap = useCategoryMap();
  const level = useData((s) => s.profile?.level ?? 'basic');
  const profile = useData((s) => s.profile);
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const [editing, setEditing] = useState<{ categoryId: string | null; line: BudgetLine } | null>(
    null,
  );

  const budget = budgets.find((b) => b.id === month);
  const prevKey = addMonthsKey(month, -1);
  const prevBudget = budgets.find((b) => b.id === prevKey);
  const method: Method = budget?.method ?? settings.budgetMethod;

  const data = useMemo(() => {
    const cur = summarizePeriod(txs, plans, monthStart(month), monthEnd(month));
    const prev = summarizePeriod(txs, plans, monthStart(prevKey), monthEnd(prevKey));
    const lines = budgetProgress(budget, cur.byCategory, {
      budget: prevBudget,
      spentByCategory: prev.byCategory,
    });
    const history = [1, 2, 3].map(
      (i) =>
        summarizePeriod(
          txs,
          plans,
          monthStart(addMonthsKey(month, -i)),
          monthEnd(addMonthsKey(month, -i)),
        ).byCategory,
    );
    const saved = txs
      .filter(
        (t) =>
          t.date >= monthStart(month) &&
          t.date <= monthEnd(month) &&
          (t.kind === 'investment' || t.goalId || t.kind === 'debt_payment'),
      )
      .reduce((s, t) => s + t.amountMxnCents, 0);
    return { cur, lines, history, saved };
  }, [txs, plans, month, prevKey, budget, prevBudget]);

  const income = budget?.incomeCents ?? (data.cur.incomeCents || profile?.monthlyIncomeCents || 0);

  async function save(next: Budget) {
    await saveDoc('budgets', { ...next, demo: undefined });
  }
  const base = (): Budget => budget ?? { id: month, method, lines: {} };

  async function setMethod(m: Method) {
    await updateSettings({ budgetMethod: m });
    if (budget) await save({ ...budget, method: m });
  }

  async function suggest() {
    const lines = suggestBudgetLines(data.history);
    await save({ ...base(), lines: { ...lines, ...(budget?.lines ?? {}) } });
  }

  async function copyPrev() {
    if (!prevBudget) return;
    await save({
      ...base(),
      method: prevBudget.method,
      lines: structuredClone(prevBudget.lines),
      incomeCents: prevBudget.incomeCents,
    });
  }

  const totalAssigned = data.lines.reduce((s, l) => s + l.assignedCents, 0);
  const totalSpent = data.lines.reduce((s, l) => s + l.spentCents, 0);
  const unbudgeted = Object.entries(data.cur.byCategory)
    .filter(([c, v]) => v > 0 && !budget?.lines[c])
    .sort((a, b) => b[1] - a[1]);
  const zero = zeroBasedState(budget, data.cur.incomeCents);

  return (
    <div className="space-y-4">
      <PageHeader title="Presupuesto" subtitle="Dale un trabajo a tu dinero antes de gastarlo." />
      <SpaceSwitcher />
      <div className="flex items-center justify-between rounded-2xl bg-surface p-1.5">
        <IconButton label="Mes anterior" onClick={() => setMonth((m) => addMonthsKey(m, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <span className="font-semibold text-ink">{formatMonthKey(month)}</span>
        <IconButton label="Mes siguiente" onClick={() => setMonth((m) => addMonthsKey(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>

      <Segmented<Method>
        label="Método de presupuesto"
        value={method}
        onChange={(m) => void setMethod(m)}
        options={[
          { value: 'category', label: 'Por categoría' },
          { value: '503020', label: '50/30/20' },
          ...(isFeatureVisible(level, 'zeroBudget')
            ? [{ value: 'zero' as Method, label: 'Base cero' }]
            : []),
        ]}
      />

      {method === '503020' && (
        <Card>
          <CardTitle>Regla 50/30/20</CardTitle>
          {income > 0 ? (
            <div className="space-y-4">
              {fiftyThirtyTwenty(income, data.cur.byCategory, categories, data.saved).groups.map(
                (g) => (
                  <div key={g.group}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-ink">
                        {g.label} <span className="text-muted">(meta {g.targetPct} %)</span>
                      </span>
                      <span className="text-muted">
                        <Money cents={g.actualCents} className="font-semibold text-ink" /> de{' '}
                        <Money cents={g.targetCents} /> · {g.actualPct} %
                      </span>
                    </div>
                    <ProgressBar
                      value={g.targetCents ? (g.actualCents / g.targetCents) * 100 : 0}
                      status={g.status === 'ok' ? 'ok' : g.status === 'warn' ? 'warn' : 'over'}
                    />
                  </div>
                ),
              )}
              <p className="text-xs text-muted">
                Basado en un ingreso de <Money cents={income} />. 50 % para necesidades (renta,
                súper, servicios), 30 % para gustos y 20 % para ahorro o pagar deudas.
              </p>
            </div>
          ) : (
            <Tip>
              Para usar 50/30/20 necesito tu ingreso: regístralo (ej. “+15000 quincena”) o ponlo en
              Ajustes.
            </Tip>
          )}
        </Card>
      )}

      {method === 'zero' && (
        <Card
          className={cx(
            zero.toAssignCents < 0
              ? 'border-rose-300'
              : zero.toAssignCents > 0
                ? 'border-amber-300'
                : 'border-emerald-300',
          )}
        >
          <p className="text-sm text-muted">Dinero por asignar</p>
          <Money cents={zero.toAssignCents} className="text-3xl font-extrabold text-ink" />
          <p className="mt-1 text-sm text-muted">
            {zero.toAssignCents > 0
              ? 'Asigna cada peso a un sobre hasta llegar a $0.'
              : zero.toAssignCents < 0
                ? 'Asignaste más de lo que tienes. Quita de algún sobre.'
                : '¡Perfecto! Cada peso tiene un trabajo.'}
          </p>
          <p className="mt-2 text-xs text-muted">
            Ingresos del mes <Money cents={zero.availableToAssignCents} /> − asignado{' '}
            <Money cents={zero.assignedCents} />. Activa “pasar sobrante” en un sobre para que lo
            que no gastes se acumule.
          </p>
        </Card>
      )}

      {(method === 'category' || method === 'zero') && (
        <>
          {data.lines.length > 0 && (
            <Card>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted">Gastado de lo presupuestado</p>
                  <p className="text-2xl font-bold text-ink">
                    <Money cents={totalSpent} />{' '}
                    <span className="text-base font-medium text-muted">
                      / <Money cents={totalAssigned} />
                    </span>
                  </p>
                </div>
                <Badge
                  tone={
                    totalSpent > totalAssigned
                      ? 'bad'
                      : totalSpent > totalAssigned * 0.8
                        ? 'warn'
                        : 'good'
                  }
                >
                  {totalAssigned ? Math.round((totalSpent / totalAssigned) * 100) : 0} %
                </Badge>
              </div>
              <ProgressBar
                className="mt-3"
                value={totalAssigned ? (totalSpent / totalAssigned) * 100 : 0}
                status={
                  totalSpent > totalAssigned
                    ? 'over'
                    : totalSpent > totalAssigned * 0.8
                      ? 'warn'
                      : 'accent'
                }
              />
            </Card>
          )}
          {data.lines.length === 0 ? (
            <Card>
              <EmptyState
                emoji="🐷"
                title="Aún no hay presupuesto este mes"
                text="Pon un tope a tus categorías y te aviso al 80 % y al 100 %. Te puedo sugerir montos según lo que gastaste los últimos 3 meses."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => void suggest()}>
                      <Sparkles className="h-4 w-4" /> Sugerir presupuesto
                    </Button>
                    {prevBudget && (
                      <Button variant="secondary" onClick={() => void copyPrev()}>
                        <Copy className="h-4 w-4" /> Copiar mes anterior
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setEditing({
                          categoryId: null,
                          line: { assignedCents: 0, rollover: false },
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Agregar categoría
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <Card className="p-2">
              <ul>
                {data.lines.map((l) => {
                  const c = catMap.get(l.categoryId);
                  return (
                    <li key={l.categoryId}>
                      <button
                        type="button"
                        className="w-full rounded-xl px-2 py-3 text-left hover:bg-surface-2"
                        onClick={() =>
                          setEditing({
                            categoryId: l.categoryId,
                            line: budget!.lines[l.categoryId]!,
                          })
                        }
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium text-ink">
                            <CatIcon category={c} size="sm" /> {c?.name ?? l.categoryId}
                            {budget!.lines[l.categoryId]?.rollover && (
                              <Repeat
                                className="h-3.5 w-3.5 text-muted"
                                aria-label="Pasa el sobrante"
                              />
                            )}
                          </span>
                          <span
                            className={cx(
                              'text-sm',
                              l.availableCents < 0 ? 'font-semibold text-rose-600' : 'text-muted',
                            )}
                          >
                            {l.availableCents >= 0 ? (
                              <>
                                quedan{' '}
                                <Money
                                  cents={l.availableCents}
                                  className="font-semibold text-ink"
                                />
                              </>
                            ) : (
                              <>
                                te pasaste <Money cents={-l.availableCents} />
                              </>
                            )}
                          </span>
                        </div>
                        <ProgressBar value={l.pct} status={l.status} />
                        <p className="mt-1 text-xs text-muted">
                          <Money cents={l.spentCents} /> de{' '}
                          <Money cents={l.assignedCents + l.carriedCents} />
                          {l.carriedCents !== 0 && (
                            <>
                              {' '}
                              (incluye <Money cents={l.carriedCents} /> del mes pasado)
                            </>
                          )}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2 p-2">
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() =>
                    setEditing({ categoryId: null, line: { assignedCents: 0, rollover: false } })
                  }
                >
                  <Plus className="h-4 w-4" /> Agregar categoría
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void suggest()}>
                  <Sparkles className="h-4 w-4" /> Completar con sugerencias
                </Button>
              </div>
            </Card>
          )}
          {unbudgeted.length > 0 && data.lines.length > 0 && (
            <Card>
              <CardTitle>Gastos sin presupuesto</CardTitle>
              <ul className="space-y-1">
                {unbudgeted.slice(0, 6).map(([c, v]) => (
                  <li key={c} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      <CatIcon category={catMap.get(c)} size="sm" /> {catMap.get(c)?.name ?? c}
                    </span>
                    <span className="flex items-center gap-2">
                      <Money cents={v} className="text-muted" />
                      <button
                        type="button"
                        className="font-semibold text-accent-600"
                        onClick={() =>
                          setEditing({
                            categoryId: c,
                            line: { assignedCents: Math.ceil(v / 5000) * 5000, rollover: false },
                          })
                        }
                      >
                        Presupuestar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <BudgetLineSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={async (categoryId, line) => {
          const b = base();
          await save({ ...b, method, lines: { ...b.lines, [categoryId]: line } });
          setEditing(null);
        }}
        onDelete={async (categoryId) => {
          const b = base();
          const lines = { ...b.lines };
          delete lines[categoryId];
          await save({ ...b, lines });
          setEditing(null);
        }}
      />
    </div>
  );
}

function BudgetLineSheet({
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  editing: { categoryId: string | null; line: BudgetLine } | null;
  onClose: () => void;
  onSave: (categoryId: string, line: BudgetLine) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
}) {
  const [cat, setCat] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [rollover, setRollover] = useState(false);
  const key = editing ? `${editing.categoryId}` : '';
  const [lastKey, setLastKey] = useState('');
  if (editing && key !== lastKey) {
    setLastKey(key);
    setCat(editing.categoryId);
    setAmount(editing.line.assignedCents);
    setRollover(editing.line.rollover);
  }
  return (
    <Sheet
      open={!!editing}
      onClose={onClose}
      title={editing?.categoryId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      footer={
        <div className="flex gap-2">
          {editing?.categoryId && (
            <Button
              variant="secondary"
              aria-label="Quitar"
              onClick={() => void onDelete(editing.categoryId!)}
            >
              <Trash2 className="h-5 w-5 text-rose-600" />
            </Button>
          )}
          <Button
            block
            disabled={!cat || amount <= 0}
            onClick={() => cat && void onSave(cat, { assignedCents: amount, rollover })}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!editing?.categoryId && <CategoryPicker value={cat} onChange={setCat} />}
        <MoneyInput
          label="¿Cuánto quieres gastar como máximo este mes?"
          value={amount}
          onChange={setAmount}
          autoFocus={!!editing?.categoryId}
        />
        <Toggle
          label="Pasar sobrante al siguiente mes"
          description="Lo que no gastes se acumula (método de sobres). Si te pasas, se descuenta."
          checked={rollover}
          onChange={setRollover}
        />
      </div>
    </Sheet>
  );
}
