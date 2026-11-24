import type { Category } from './schemas';

type DefaultCategory = Omit<Category, 'archived' | 'system' | 'order' | 'parentId'> & { parentId?: string };

/**
 * Categorías por defecto. El id es un "slug" estable que también usa el parser,
 * así el usuario no tiene que crear nada para empezar.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ——— Gastos: necesidades ———
  { id: 'groceries', name: 'Súper y despensa', emoji: '🛒', color: '#16a34a', type: 'expense', group: 'needs' },
  { id: 'housing', name: 'Vivienda', emoji: '🏠', color: '#0891b2', type: 'expense', group: 'needs' },
  { id: 'utilities', name: 'Servicios', emoji: '💡', color: '#ca8a04', type: 'expense', group: 'needs' },
  { id: 'transport', name: 'Transporte', emoji: '🚕', color: '#2563eb', type: 'expense', group: 'needs' },
  { id: 'gas', name: 'Gasolina', emoji: '⛽', color: '#dc2626', type: 'expense', group: 'needs' },
  { id: 'car', name: 'Auto', emoji: '🚗', color: '#475569', type: 'expense', group: 'needs' },
  { id: 'health', name: 'Salud', emoji: '💊', color: '#e11d48', type: 'expense', group: 'needs' },
  { id: 'education', name: 'Educación', emoji: '🎓', color: '#7c3aed', type: 'expense', group: 'needs' },
  { id: 'kids', name: 'Hijos', emoji: '🧸', color: '#f97316', type: 'expense', group: 'needs' },
  { id: 'pets', name: 'Mascotas', emoji: '🐶', color: '#a16207', type: 'expense', group: 'needs' },
  { id: 'debt_costs', name: 'Comisiones e intereses', emoji: '💳', color: '#be123c', type: 'expense', group: 'needs' },
  { id: 'taxes', name: 'Impuestos y trámites', emoji: '🧾', color: '#57534e', type: 'expense', group: 'needs' },
  // ——— Gastos: gustos ———
  { id: 'food', name: 'Comida y restaurantes', emoji: '🌮', color: '#ea580c', type: 'expense', group: 'wants' },
  { id: 'snacks', name: 'Tiendita y antojos', emoji: '🍪', color: '#d97706', type: 'expense', group: 'wants' },
  { id: 'coffee', name: 'Café', emoji: '☕', color: '#92400e', type: 'expense', group: 'wants' },
  { id: 'delivery', name: 'Comida a domicilio', emoji: '🛵', color: '#f59e0b', type: 'expense', group: 'wants' },
  { id: 'subscriptions', name: 'Suscripciones', emoji: '📺', color: '#9333ea', type: 'expense', group: 'wants' },
  { id: 'shopping', name: 'Compras', emoji: '🛍️', color: '#db2777', type: 'expense', group: 'wants' },
  { id: 'clothing', name: 'Ropa y calzado', emoji: '👕', color: '#c026d3', type: 'expense', group: 'wants' },
  { id: 'home', name: 'Hogar', emoji: '🛋️', color: '#0d9488', type: 'expense', group: 'wants' },
  { id: 'entertainment', name: 'Entretenimiento', emoji: '🎬', color: '#8b5cf6', type: 'expense', group: 'wants' },
  { id: 'travel', name: 'Viajes', emoji: '✈️', color: '#0284c7', type: 'expense', group: 'wants' },
  { id: 'personal_care', name: 'Cuidado personal', emoji: '💇', color: '#ec4899', type: 'expense', group: 'wants' },
  { id: 'sports', name: 'Deporte y gym', emoji: '🏋️', color: '#65a30d', type: 'expense', group: 'wants' },
  { id: 'gifts', name: 'Regalos', emoji: '🎁', color: '#e879f9', type: 'expense', group: 'wants' },
  { id: 'alcohol', name: 'Bebidas y fiesta', emoji: '🍻', color: '#b45309', type: 'expense', group: 'wants' },
  { id: 'donations', name: 'Donativos', emoji: '🤝', color: '#14b8a6', type: 'expense', group: 'wants' },
  { id: 'business', name: 'Negocio', emoji: '💼', color: '#334155', type: 'expense', group: 'needs' },
  // ——— Ahorro ———
  { id: 'savings', name: 'Ahorro', emoji: '🐷', color: '#059669', type: 'expense', group: 'savings' },
  { id: 'investments', name: 'Inversiones', emoji: '📈', color: '#047857', type: 'expense', group: 'savings' },
  { id: 'debt_extra', name: 'Abono extra a deudas', emoji: '⛓️‍💥', color: '#0f766e', type: 'expense', group: 'savings' },
  // ——— Sistema ———
  { id: 'other', name: 'Otros', emoji: '📦', color: '#64748b', type: 'expense', group: 'wants' },
  { id: 'review', name: 'Por revisar', emoji: '❓', color: '#94a3b8', type: 'expense', group: 'none' },
  { id: 'adjustment', name: 'Ajuste de saldo', emoji: '⚖️', color: '#94a3b8', type: 'expense', group: 'none' },
  // ——— Ingresos ———
  { id: 'salary', name: 'Sueldo', emoji: '💼', color: '#059669', type: 'income', group: 'income' },
  { id: 'bonus', name: 'Aguinaldo y bonos', emoji: '🎄', color: '#10b981', type: 'income', group: 'income' },
  { id: 'freelance', name: 'Freelance', emoji: '💻', color: '#0d9488', type: 'income', group: 'income' },
  { id: 'sales', name: 'Ventas', emoji: '🏷️', color: '#0891b2', type: 'income', group: 'income' },
  { id: 'returns', name: 'Rendimientos', emoji: '📈', color: '#16a34a', type: 'income', group: 'income' },
  { id: 'refunds', name: 'Reembolsos', emoji: '↩️', color: '#22c55e', type: 'income', group: 'income' },
  { id: 'gifts_received', name: 'Regalos recibidos', emoji: '🎁', color: '#84cc16', type: 'income', group: 'income' },
  { id: 'tanda_payout', name: 'Tanda cobrada', emoji: '🫙', color: '#65a30d', type: 'income', group: 'income' },
  { id: 'other_income', name: 'Otros ingresos', emoji: '💰', color: '#4d7c0f', type: 'income', group: 'income' },
];

/** Categorías que nunca cuentan como gasto real en reportes. */
export const NON_SPENDING_CATEGORIES = new Set(['adjustment']);

export const SYSTEM_CATEGORY_IDS = new Set(['review', 'adjustment', 'other', 'other_income']);

export function buildDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    ...c,
    parentId: c.parentId ?? null,
    archived: false,
    system: SYSTEM_CATEGORY_IDS.has(c.id),
    order: i,
  }));
}

export const DEFAULT_CATEGORY_MAP: Record<string, DefaultCategory> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c]),
);

/** Categorías candidatas a "gasto hormiga". */
export const ANT_CATEGORIES = new Set(['snacks', 'coffee', 'delivery', 'alcohol']);
