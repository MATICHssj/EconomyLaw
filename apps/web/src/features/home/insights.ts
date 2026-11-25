import { useMemo } from 'react';
import {
  daysLeftInMonth,
  daysWithoutAntExpenses,
  formatMoney,
  isFeatureVisible,
  monthlyEquivalent,
} from '@fina/core';
import type { useFinance } from '@/lib/finance';
import { useCategoryMap } from '@/lib/finance';
import { useData } from '@/stores/data';

export interface Insight {
  id: string;
  tone: 'good' | 'warn' | 'bad' | 'info';
  emoji: string;
  title: string;
  text?: string;
  to?: string;
}

/** Alertas y mensajes con personalidad para la pantalla de Inicio. */
export function useInsights(f: ReturnType<typeof useFinance>): Insight[] {
  const catMap = useCategoryMap();
  const level = useData((s) => s.profile?.level ?? 'basic');
  const txs = useData((s) => s.data.transactions);
  const income = useData((s) => s.profile?.monthlyIncomeCents);
  return useMemo(() => {
    const out: Insight[] = [];
    const daysLeft = daysLeftInMonth(f.today);

    for (const st of f.statements) {
      if (st.remainingToPayCents > 0 && st.daysUntilDue >= 0 && st.daysUntilDue <= 5) {
        out.push({
          id: `card-${st.accountId}`,
          tone: st.daysUntilDue <= 1 ? 'bad' : 'warn',
          emoji: '💳',
          title:
            st.daysUntilDue === 0
              ? `Hoy vence el pago de tu tarjeta`
              : `Tu tarjeta vence en ${st.daysUntilDue} ${st.daysUntilDue === 1 ? 'día' : 'días'}`,
          text: `Paga ${formatMoney(st.remainingToPayCents)} para no generar intereses (mínimo ${formatMoney(st.minimumPaymentCents)}).`,
          to: `/cuentas/${st.accountId}`,
        });
      }
    }

    if (isFeatureVisible(level, 'budgets')) {
      for (const l of f.budgetLines) {
        const c = catMap.get(l.categoryId);
        if (!c) continue;
        if (l.status === 'over') {
          out.push({
            id: `over-${l.categoryId}`,
            tone: 'bad',
            emoji: c.emoji,
            title: `Te pasaste en ${c.name}`,
            text: `Llevas ${formatMoney(l.spentCents)} de ${formatMoney(l.assignedCents + l.carriedCents)}.`,
            to: '/presupuesto',
          });
        } else if (l.status === 'warn') {
          out.push({
            id: `warn-${l.categoryId}`,
            tone: 'warn',
            emoji: c.emoji,
            title: `Te quedan ${formatMoney(l.availableCents)} en ${c.name} para ${daysLeft} días`,
            text: `Ya usaste el ${l.pct} % de tu presupuesto.`,
            to: '/presupuesto',
          });
        }
      }
    }

    if (f.reviewCount > 0) {
      out.push({
        id: 'review',
        tone: 'info',
        emoji: '❓',
        title: `${f.reviewCount} ${f.reviewCount === 1 ? 'movimiento' : 'movimientos'} por revisar`,
        text: 'No supe en qué categoría van. Ayúdame una vez y aprendo.',
        to: '/movimientos',
      });
    }

    if (isFeatureVisible(level, 'subscriptions') && f.subscriptions.length > 0) {
      const total = f.subscriptions.reduce(
        (s, x) => s + monthlyEquivalent(x.amountCents, x.frequency),
        0,
      );
      out.push({
        id: 'subs',
        tone: 'info',
        emoji: '📺',
        title: `Detecté ${f.subscriptions.length} ${f.subscriptions.length === 1 ? 'cargo que se repite' : 'cargos que se repiten'}`,
        text: `≈ ${formatMoney(total)} al mes. ¿Los sigues usando?`,
        to: '/recurrentes',
      });
    }

    const streak = daysWithoutAntExpenses(txs, f.today);
    if (txs.length > 10 && streak >= 3) {
      out.push({
        id: 'streak',
        tone: 'good',
        emoji: '🎉',
        title: `¡Vas muy bien! Llevas ${streak} días sin gastos hormiga`,
        to: '/aprende/hormiga',
      });
    }

    // Solo alertamos si ya no esperas más ingresos este mes (o si rebasas tu ingreso mensual declarado).
    const monthlyIncome = Math.max(f.monthSummary.incomeCents, income ?? 0);
    const noMorePaydays = !f.nextPayday || f.nextPayday.slice(0, 7) !== f.month;
    if (
      monthlyIncome > 0 &&
      f.monthSummary.spentCents > monthlyIncome &&
      (noMorePaydays || (income ?? 0) > 0)
    ) {
      out.push({
        id: 'over-income',
        tone: 'bad',
        emoji: '🚨',
        title: 'Este mes gastas más de lo que te entra',
        text: `Vas ${formatMoney(f.monthSummary.spentCents - monthlyIncome)} arriba. Revisa tus categorías más altas.`,
        to: '/reportes',
      });
    }

    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [f, catMap, level, txs, income]);
}
