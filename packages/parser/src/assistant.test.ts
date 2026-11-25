import { describe, expect, it } from 'vitest';
import { buildDefaultCategories, generateDemoData } from '@fina/core';
import { askAssistant, type AssistantData } from './index';

const today = '2025-11-20';
const demo = generateDemoData(today, '2025-11-20T12:00:00.000Z');
const data: AssistantData = {
  today,
  transactions: demo.transactions!,
  categories: buildDefaultCategories(),
  accounts: demo.accounts!,
  budgets: demo.budgets,
  plans: demo.installmentPlans,
  loans: demo.loans,
  splits: demo.splits,
  debts: demo.debts,
  payday: { type: 'biweekly', days: [15, 30] },
};

describe('Pregúntale a Fina', () => {
  it('cuánto gasté en Uber en octubre (con números reales)', () => {
    const r = askAssistant('¿cuánto gasté en Uber en octubre?', data);
    const expected = demo.transactions!.filter((t) => t.merchant === 'Uber' && t.date.startsWith('2025-10')).reduce((s, t) => s + t.amountCents, 0);
    expect(r.intent).toBe('spent');
    expect(r.text).toContain('Uber');
    expect(r.text).toContain(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', minimumFractionDigits: expected % 100 ? 2 : 0, maximumFractionDigits: expected % 100 ? 2 : 0 }).format(expected / 100));
  });
  it('categorías', () => {
    expect(askAssistant('cuánto llevo en comida este mes', data).text).toMatch(/Comida/);
  });
  it('"comida" suma toda la familia (súper, restaurantes, café…) con desglose', () => {
    const r = askAssistant('¿cuánto he gastado en comida este mes?', data);
    const ids = new Set(['groceries', 'food', 'coffee', 'snacks', 'delivery']);
    const expected = demo
      .transactions!.filter((t) => t.kind === 'expense' && t.date.startsWith('2025-11') && t.date <= today && ids.has(t.categoryId ?? ''))
      .reduce((s, t) => s + (t.myShareCents ?? t.amountMxnCents), 0);
    expect(r.intent).toBe('spent');
    expect(r.text).toMatch(/toda la comida/);
    expect(r.text).toMatch(/Súper y despensa/);
    expect(r.text).toContain(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', minimumFractionDigits: expected % 100 ? 2 : 0, maximumFractionDigits: expected % 100 ? 2 : 0 }).format(expected / 100));
  });
  it('me alcanza', () => {
    const r = askAssistant('¿me alcanza para unos tenis de 1800?', data);
    expect(r.intent).toBe('afford');
    expect(r.text).toMatch(/\$1,800/);
  });
  it('top, deudas, quién me debe, presupuesto, hormiga', () => {
    expect(askAssistant('¿en qué se me va el dinero?', data).intent).toBe('top');
    expect(askAssistant('cuánto debo', data).text).toMatch(/Debes/);
    expect(askAssistant('quién me debe', data).text).toMatch(/Juan/);
    expect(askAssistant('cómo voy con mi presupuesto de comida', data).intent).toBe('budget');
    expect(askAssistant('mis gastos hormiga', data).text).toMatch(/hormiga/);
  });
  it('no inventa: si no entiende, lo dice', () => {
    expect(askAssistant('¿cuál es el sentido de la vida?', data).intent).toBe('unknown');
  });
});
