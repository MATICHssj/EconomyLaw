import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonthsKey,
  antExpenses,
  availableMoney,
  budgetProgress,
  cardStatement,
  computeBalances,
  creditOwed,
  daysBetween,
  detectSubscriptions,
  installmentsBetween,
  monthEnd,
  monthKey,
  monthStart,
  nextPayday,
  safeToSpendPerDay,
  summarizePeriod,
  tandaSchedule,
  todayISO,
  upcomingRecurring,
  type Category,
  type CardStatement,
  type ISODate,
  type UpcomingItem,
} from '@fina/core';
import { useData, useDocs } from '@/stores/data';

/** Fecha de hoy que se actualiza sola a medianoche. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const t = setInterval(() => {
      const d = todayISO();
      setToday((prev) => (prev === d ? prev : d));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useData((s) => s.data.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

const FALLBACK_CATEGORY: Category = { id: 'other', name: 'Otros', emoji: '📦', color: '#64748b', type: 'expense', group: 'wants', archived: false, system: true, order: 99 };

export function useCategory(id: string | null | undefined): Category {
  const map = useCategoryMap();
  return (id && map.get(id)) || (id === null ? { ...FALLBACK_CATEGORY, name: 'Sin categoría', emoji: '↔️' } : FALLBACK_CATEGORY);
}

/**
 * Todo lo que necesita la pantalla de Inicio, calculado una sola vez y
 * memorizado: saldos, gasto del mes, presupuesto, próximos pagos, etc.
 */
export function useFinance() {
  const today = useToday();
  const transactions = useDocs('transactions');
  const accounts = useDocs('accounts');
  const plans = useDocs('installmentPlans');
  const budgets = useDocs('budgets');
  const recurring = useDocs('recurring');
  const tandas = useData((s) => s.data.tandas);
  const loans = useData((s) => s.data.loans);
  const profile = useData((s) => s.profile);

  return useMemo(() => {
    const month = monthKey(today);
    const balances = computeBalances(accounts, transactions);
    const available = availableMoney(accounts, balances);
    const owed = creditOwed(accounts, balances);
    const monthSummary = summarizePeriod(transactions, plans, monthStart(month), monthEnd(month));
    const prevKey = addMonthsKey(month, -1);
    const dayOfMonth = Number(today.slice(8));
    const prevSamePoint = summarizePeriod(transactions, plans, monthStart(prevKey), `${prevKey}-${String(Math.min(dayOfMonth, 28)).padStart(2, '0')}`);
    const prevFull = summarizePeriod(transactions, plans, monthStart(prevKey), monthEnd(prevKey));
    const spentToDate = summarizePeriod(transactions, plans, monthStart(month), today).spentCents;
    const budget = budgets.find((b) => b.id === month);
    const prevBudget = budgets.find((b) => b.id === prevKey);
    const budgetLines = budgetProgress(budget, monthSummary.byCategory, { budget: prevBudget, spentByCategory: prevFull.byCategory });
    const budgetTotal = budgetLines.reduce((s, l) => s + l.assignedCents + l.carriedCents, 0);
    const budgetSpent = budgetLines.reduce((s, l) => s + l.spentCents, 0);

    const statements: CardStatement[] = accounts
      .filter((a) => a.type === 'credit' && a.credit && !a.archived)
      .map((a) => cardStatement(a, transactions, plans, balances[a.id] ?? 0, today))
      .filter((s): s is CardStatement => s !== null);

    const horizon = addDays(today, 30);
    const upcoming: UpcomingItem[] = [...upcomingRecurring(recurring, today, 30)];
    for (const st of statements) {
      const acc = accounts.find((a) => a.id === st.accountId)!;
      if (st.remainingToPayCents > 0 && st.dueDate >= today && st.dueDate <= horizon) {
        upcoming.push({ id: `card_${acc.id}`, type: 'card', title: `Pagar ${acc.name}`, emoji: '💳', date: st.dueDate, daysUntil: daysBetween(today, st.dueDate), amountCents: st.remainingToPayCents, direction: 'out', refId: acc.id });
      }
    }
    for (const c of installmentsBetween(plans, addDays(today, 1), horizon)) {
      upcoming.push({ id: `msi_${c.planId}_${c.n}`, type: 'installment', title: `${c.description} (${c.n}/${c.of})`, emoji: '🗓️', date: c.date, daysUntil: daysBetween(today, c.date), amountCents: c.amountCents, direction: 'out', refId: c.planId });
    }
    for (const t of tandas.filter((x) => !x.archived)) {
      for (const r of tandaSchedule(t)) {
        if (r.date < today || r.date > horizon) continue;
        upcoming.push({ id: `tanda_${t.id}_${r.n}`, type: 'tanda', title: r.isMyTurn ? `¡Te toca la tanda ${t.name}!` : `Tanda ${t.name}`, emoji: '🫙', date: r.date, daysUntil: daysBetween(today, r.date), amountCents: r.isMyTurn ? t.contributionCents * t.participants : t.contributionCents, direction: r.isMyTurn ? 'in' : 'out', refId: t.id });
      }
    }
    for (const l of loans.filter((x) => !x.closed && x.dueDate && x.dueDate <= horizon)) {
      upcoming.push({ id: `loan_${l.id}`, type: 'loan', title: l.direction === 'lent' ? `${l.person} te debe pagar` : `Pagarle a ${l.person}`, emoji: '🤝', date: l.dueDate!, daysUntil: daysBetween(today, l.dueDate!), amountCents: l.amountCents - l.paidCents, direction: l.direction === 'lent' ? 'in' : 'out', refId: l.id });
    }
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    const payday = profile?.payday ?? { type: 'biweekly' as const, days: [15, 30] };
    const np = nextPayday(addDays(today, 1), payday);
    // Los MSI se pagan dentro del pago de la tarjeta: no los contamos dos veces.
    const committed = upcoming.filter((u) => u.direction === 'out' && u.type !== 'installment' && (!np || u.date < np)).reduce((s, u) => s + u.amountCents, 0);
    const safe = safeToSpendPerDay({ today, availableCents: available, committedCents: committed, nextPayday: np });

    const ant = antExpenses(transactions, monthStart(month), today);
    const subscriptions = detectSubscriptions(transactions, recurring, today);
    const reviewCount = transactions.filter((t) => t.status === 'review' || t.categoryId === 'review').length;

    return {
      today,
      month,
      balances,
      available,
      owed,
      monthSummary,
      spentToDate,
      prevSamePoint,
      prevFull,
      budget,
      budgetLines,
      budgetTotal,
      budgetSpent,
      statements,
      upcoming,
      nextPayday: np,
      committed,
      safe,
      ant,
      subscriptions,
      reviewCount,
      hasAccounts: accounts.length > 0,
      txCount: transactions.length,
    };
  }, [today, transactions, accounts, plans, budgets, recurring, tandas, loans, profile]);
}
