import { useMemo } from 'react';
import { levelAtLeast, type Level } from '@fina/core';
import { useData } from '@/stores/data';

/**
 * "Misiones": la ruta guiada que enseña a usar la app paso a paso y te hace
 * crecer de nivel. Cada misión se completa sola al detectar que ya lo hiciste.
 */
export interface Mission {
  id: string;
  level: Level;
  emoji: string;
  title: string;
  text: string;
  to: string;
  cta: string;
  done: (s: ReturnType<typeof useData.getState>) => boolean;
}

export const MISSIONS: Mission[] = [
  {
    id: 'first_tx',
    level: 'basic',
    emoji: '✍️',
    title: 'Anota tu primer gasto',
    text: 'Toca + y escribe algo como "café 45". Así de fácil.',
    to: '/?capture=1',
    cta: 'Anotar',
    done: (s) => s.data.transactions.some((t) => t.source !== 'demo'),
  },
  {
    id: 'five_tx',
    level: 'basic',
    emoji: '🔥',
    title: 'Anota 5 gastos',
    text: 'El hábito es lo que cambia tus finanzas. Anota todo, hasta los chicles.',
    to: '/?capture=1',
    cta: 'Anotar',
    done: (s) => s.data.transactions.filter((t) => t.source !== 'demo').length >= 5,
  },
  {
    id: 'income',
    level: 'basic',
    emoji: '💰',
    title: 'Registra tu ingreso',
    text: 'Escribe "+15000 quincena" para saber cuánto te queda.',
    to: '/?capture=1',
    cta: 'Registrar',
    done: (s) => s.data.transactions.some((t) => t.kind === 'income' && t.source !== 'demo'),
  },
  {
    id: 'whatsapp',
    level: 'basic',
    emoji: '💬',
    title: 'Anota por WhatsApp',
    text: 'Vincula tu número y manda tus gastos como si le escribieras a un amigo.',
    to: '/whatsapp',
    cta: 'Vincular',
    done: (s) => !!s.settings && localStorage.getItem('fina:wa-linked') === '1',
  },
  {
    id: 'learn',
    level: 'basic',
    emoji: '🎓',
    title: 'Toma tu primera lección',
    text: '2 minutos: ¿qué son los gastos hormiga y cómo se comen tu quincena?',
    to: '/aprende/hormiga',
    cta: 'Aprender',
    done: () => (localStorage.getItem('fina:lessons') ?? '').includes('hormiga'),
  },
  {
    id: 'accounts',
    level: 'organized',
    emoji: '🏦',
    title: 'Agrega tus cuentas',
    text: 'Efectivo, débito, tarjetas, Mercado Pago… con su saldo actual.',
    to: '/cuentas',
    cta: 'Agregar',
    done: (s) => s.data.accounts.filter((a) => !a.id.startsWith('demo_')).length >= 2,
  },
  {
    id: 'card',
    level: 'organized',
    emoji: '💳',
    title: 'Configura tu tarjeta de crédito',
    text: 'Con fecha de corte y de pago te avisamos antes de que te cobren intereses.',
    to: '/tarjetas',
    cta: 'Configurar',
    done: (s) =>
      s.data.accounts.some((a) => a.type === 'credit' && a.credit && !a.id.startsWith('demo_')),
  },
  {
    id: 'budget',
    level: 'organized',
    emoji: '🐷',
    title: 'Crea tu primer presupuesto',
    text: 'Ponle tope a 3 categorías. Te avisamos al 80 %.',
    to: '/presupuesto',
    cta: 'Crear',
    done: (s) => s.data.budgets.some((b) => !b.demo && Object.keys(b.lines).length > 0),
  },
  {
    id: 'goal',
    level: 'organized',
    emoji: '🎯',
    title: 'Ponte una meta',
    text: 'Fondo de emergencia, viaje, enganche… y te decimos cuánto apartar por quincena.',
    to: '/metas',
    cta: 'Crear meta',
    done: (s) => s.data.goals.some((g) => !g.id.startsWith('demo_')),
  },
  {
    id: 'household',
    level: 'organized',
    emoji: '💑',
    title: 'Invita a tu pareja',
    text: 'Lleven juntos los gastos de la casa y vean quién le debe a quién.',
    to: '/hogar',
    cta: 'Invitar',
    done: (s) => !!s.household,
  },
  {
    id: 'debts',
    level: 'expert',
    emoji: '⛓️',
    title: 'Arma tu plan para salir de deudas',
    text: 'Compara bola de nieve vs. avalancha y conoce tu fecha de libertad.',
    to: '/deudas',
    cta: 'Planear',
    done: (s) => s.data.debts.some((d) => !d.id.startsWith('demo_')),
  },
  {
    id: 'networth',
    level: 'expert',
    emoji: '📊',
    title: 'Conoce tu patrimonio',
    text: 'Lo que tienes menos lo que debes. El número que de verdad importa.',
    to: '/patrimonio',
    cta: 'Ver',
    done: () => (localStorage.getItem('fina:seen') ?? '').includes('networth'),
  },
];

export function useMissions() {
  const state = useData();
  const level = state.profile?.level ?? 'basic';
  return useMemo(() => {
    const visible = MISSIONS.filter((m) => levelAtLeast(level, m.level));
    const done = visible.filter((m) => {
      try {
        return m.done(state);
      } catch {
        return false;
      }
    });
    const next = visible.find((m) => !done.includes(m)) ?? null;
    return {
      missions: visible,
      done: new Set(done.map((m) => m.id)),
      next,
      progress: visible.length ? done.length / visible.length : 1,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, state.data, state.household, state.settings]);
}

export function markSeen(key: string) {
  try {
    const cur = localStorage.getItem('fina:seen') ?? '';
    if (!cur.includes(key)) localStorage.setItem('fina:seen', `${cur},${key}`);
  } catch {
    /* sin almacenamiento */
  }
}
