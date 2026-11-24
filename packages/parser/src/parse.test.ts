import { describe, expect, it } from 'vitest';
import { parse, parseMany, ruleFromCorrection, splitEntries, type ParseContext, type ParsedEntry } from './index';

const today = '2025-11-20'; // jueves
const accounts: ParseContext['accounts'] = [
  { id: 'cash', name: 'Efectivo', type: 'cash', institution: 'cash' },
  { id: 'bbva', name: 'BBVA Débito', type: 'debit', institution: 'bbva' },
  { id: 'nu', name: 'Nu Crédito', type: 'credit', institution: 'nu' },
  { id: 'mp', name: 'Mercado Pago', type: 'wallet', institution: 'mercadopago' },
];
const ctx: ParseContext = { today, accounts };

function ok(text: string, c: ParseContext = ctx): ParsedEntry {
  const r = parse(text, c);
  if (!r.ok) throw new Error(`No se pudo leer "${text}": ${r.message}`);
  return r.entry;
}

describe('casos obligatorios §4.4', () => {
  it('galleta de la tienda 30 pesos', () => {
    const e = ok('galleta de la tienda 30 pesos');
    expect(e).toMatchObject({ kind: 'expense', amountCents: 3000, description: 'Galleta de la tienda', categoryId: 'snacks', date: today });
  });
  it('galleta 30', () => {
    expect(ok('galleta 30')).toMatchObject({ kind: 'expense', amountCents: 3000, categoryId: 'snacks' });
  });
  it('uber 85', () => {
    expect(ok('uber 85')).toMatchObject({ kind: 'expense', amountCents: 8500, categoryId: 'transport', merchant: 'Uber' });
  });
  it('ayer tacos 120', () => {
    expect(ok('ayer tacos 120')).toMatchObject({ kind: 'expense', amountCents: 12000, categoryId: 'food', date: '2025-11-19', description: 'Tacos' });
  });
  it('+15000 quincena', () => {
    expect(ok('+15000 quincena')).toMatchObject({ kind: 'income', amountCents: 1500000, categoryId: 'salary', description: 'Quincena' });
  });
  it('me pagaron 15 mil', () => {
    expect(ok('me pagaron 15 mil')).toMatchObject({ kind: 'income', amountCents: 1500000, categoryId: 'salary' });
  });
  it('gasolina 500 con bbva', () => {
    expect(ok('gasolina 500 con bbva')).toMatchObject({ kind: 'expense', amountCents: 50000, categoryId: 'gas', accountHint: 'bbva', accountId: 'bbva', description: 'Gasolina' });
  });
  it('netflix 299 cada mes', () => {
    expect(ok('netflix 299 cada mes')).toMatchObject({ kind: 'expense', amountCents: 29900, categoryId: 'subscriptions', recurrence: 'monthly', merchant: 'Netflix', description: 'Netflix' });
  });
  it('le presté 200 a Juan', () => {
    expect(ok('le presté 200 a Juan')).toMatchObject({ kind: 'loan_given', amountCents: 20000, person: 'Juan', description: 'Préstamo a Juan' });
  });
  it('Juan me pagó 200', () => {
    expect(ok('Juan me pagó 200')).toMatchObject({ kind: 'loan_collected', amountCents: 20000, person: 'Juan' });
  });
  it('cena 900 entre 3', () => {
    expect(ok('cena 900 entre 3')).toMatchObject({ kind: 'expense', amountCents: 90000, splitCount: 3, categoryId: 'food', description: 'Cena' });
  });
  it('tv 12000 a 12 msi con nu', () => {
    expect(ok('tv 12000 a 12 msi con nu')).toMatchObject({ kind: 'expense', amountCents: 1200000, installments: 12, accountHint: 'nu', accountId: 'nu', description: 'TV' });
  });
  it('pagué 3500 de la tarjeta nu', () => {
    expect(ok('pagué 3500 de la tarjeta nu')).toMatchObject({ kind: 'debt_payment', amountCents: 350000, toAccountHint: 'nu', toAccountId: 'nu' });
  });
  it('pasé 1000 de bbva a efectivo', () => {
    expect(ok('pasé 1000 de bbva a efectivo')).toMatchObject({ kind: 'transfer', amountCents: 100000, accountId: 'bbva', toAccountId: 'cash' });
  });
  it('hotel 200 dls #viaje', () => {
    const e = ok('hotel 200 dls #viaje', { ...ctx, fxRates: { USD: 18 } });
    expect(e).toMatchObject({ kind: 'expense', amountCents: 20000, currency: 'USD', amountMxnCents: 360000, tags: ['viaje'], categoryId: 'travel', description: 'Hotel' });
  });
  it('montos con comas, k y palabras', () => {
    expect(ok('$1,250.50 super')).toMatchObject({ amountCents: 125050, categoryId: 'groceries' });
    expect(ok('1.5k súper')).toMatchObject({ amountCents: 150000, categoryId: 'groceries' });
    expect(ok('mil doscientos súper')).toMatchObject({ amountCents: 120000, categoryId: 'groceries' });
  });
  it('oxxo 45.50 refresco y papas', () => {
    expect(ok('oxxo 45.50 refresco y papas')).toMatchObject({ kind: 'expense', amountCents: 4550, merchant: 'OXXO', categoryId: 'snacks', description: 'Refresco y papas' });
  });
  it('tanda 500', () => {
    expect(ok('tanda 500')).toMatchObject({ kind: 'tanda', amountCents: 50000, target: 'tanda' });
  });
  it('cetes 5000', () => {
    expect(ok('cetes 5000')).toMatchObject({ kind: 'investment', amountCents: 500000, target: 'investment', targetName: 'CETES', categoryId: 'investments' });
  });
});

describe('casos difíciles', () => {
  it('sin monto pide el monto', () => {
    const r = parse('galleta', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('no_amount');
      expect(r.message).toContain('¿Cuánto fue?');
      expect(r.partial.categoryId).toBe('snacks');
    }
  });
  it('texto vacío', () => {
    expect(parse('   ', ctx).ok).toBe(false);
  });
  it('montos negativos se toman como gasto', () => {
    expect(ok('-30 galleta')).toMatchObject({ kind: 'expense', amountCents: 3000, categoryId: 'snacks' });
    expect(ok('galleta -30')).toMatchObject({ kind: 'expense', amountCents: 3000 });
  });
  it('emojis', () => {
    expect(ok('🌮 120')).toMatchObject({ amountCents: 12000, categoryId: 'food' });
    expect(ok('café ☕ 45')).toMatchObject({ categoryId: 'coffee', description: 'Café' });
  });
  it('faltas de ortografía comunes', () => {
    expect(ok('gasolna 500')).toMatchObject({ categoryId: 'gas' });
    expect(ok('super 800')).toMatchObject({ categoryId: 'groceries' });
    expect(ok('súper 800')).toMatchObject({ categoryId: 'groceries' });
    expect(ok('farmasia 230')).toMatchObject({ categoryId: 'health' });
  });
  it('fechas', () => {
    expect(ok('antier uber 60').date).toBe('2025-11-18');
    expect(ok('el lunes tacos 90').date).toBe('2025-11-17');
    expect(ok('15 de nov gasolina 500').date).toBe('2025-11-15');
    expect(ok('el 3 renta 7500').date).toBe('2025-11-03');
    expect(ok('el 25 renta 7500').date).toBe('2025-10-25');
    expect(ok('28/12 regalo 500').date).toBe('2024-12-28');
  });
  it('pago con tarjeta no es pago de tarjeta', () => {
    expect(ok('cena 600 con tarjeta nu')).toMatchObject({ kind: 'expense', accountId: 'nu', categoryId: 'food' });
  });
  it('pago de luz es gasto', () => {
    expect(ok('pagué 350 de luz')).toMatchObject({ kind: 'expense', categoryId: 'utilities' });
  });
  it('retiro de cajero es transferencia a efectivo', () => {
    expect(ok('retiré 500 del cajero bbva')).toMatchObject({ kind: 'transfer', accountId: 'bbva', toAccountId: 'cash', description: 'Retiro de efectivo' });
  });
  it('en efectivo y mercado pago', () => {
    expect(ok('tortas 80 en efectivo')).toMatchObject({ accountId: 'cash', description: 'Tortas' });
    expect(ok('uber 120 con mercado pago')).toMatchObject({ accountId: 'mp', merchant: 'Uber' });
  });
  it('números ambiguos: cantidad + monto', () => {
    expect(ok('2 refrescos 40')).toMatchObject({ amountCents: 4000, categoryId: 'snacks' });
  });
  it('reglas aprendidas tienen prioridad', () => {
    const e = ok('galleta 30', { ...ctx, rules: [{ pattern: 'galleta', categoryId: 'kids' }] });
    expect(e).toMatchObject({ categoryId: 'kids', categorySource: 'rule' });
  });
  it('préstamo recibido y pago a quien me prestó', () => {
    expect(ok('Ana me prestó 1000')).toMatchObject({ kind: 'loan_received', person: 'Ana' });
    expect(ok('le pagué 500 a Ana', { ...ctx, people: { Ana: 'borrowed' } })).toMatchObject({ kind: 'loan_repaid', person: 'Ana' });
    expect(ok('le pagué 500 al plomero')).toMatchObject({ kind: 'expense', categoryId: 'home' });
  });
  it('ahorro', () => {
    expect(ok('ahorré 500 para el viaje')).toMatchObject({ kind: 'transfer', target: 'goal', targetName: 'viaje' });
  });
  it('aguinaldo', () => {
    expect(ok('aguinaldo 18000')).toMatchObject({ kind: 'income', categoryId: 'bonus' });
  });
  it('tanda cobrada', () => {
    expect(ok('me tocó la tanda 5000')).toMatchObject({ kind: 'income', categoryId: 'tanda_payout' });
  });
  it('sin categoría baja la confianza', () => {
    const e = ok('cosa rara 300');
    expect(e.categoryId).toBeUndefined();
    expect(e.confidence).toBeLessThan(0.6);
  });
  it('confianza alta con comercio conocido', () => {
    expect(ok('starbucks 89').confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('varios movimientos en un mensaje', () => {
  it('separa por comas', () => {
    const r = parseMany('tacos 120, refresco 25, uber 60', ctx);
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.ok && x.entry.amountCents)).toEqual([12000, 2500, 6000]);
  });
  it('no separa comas de miles ni "y" sin monto', () => {
    expect(splitEntries('$1,250.50 super')).toEqual(['$1,250.50 super']);
    expect(splitEntries('oxxo 45.50 refresco y papas')).toEqual(['oxxo 45.50 refresco y papas']);
    expect(splitEntries('tacos 120 y refresco 25')).toEqual(['tacos 120', 'refresco 25']);
  });
  it('hereda "ayer"', () => {
    const r = parseMany('ayer tacos 120, refresco 25', ctx);
    expect(r.every((x) => x.ok && x.entry.date === '2025-11-19')).toBe(true);
  });
});

describe('aprendizaje', () => {
  it('crea la regla con la palabra clave', () => {
    expect(ruleFromCorrection({ description: 'Galleta de la tienda', rawText: 'galleta de la tienda 30' })).toBe('galleta');
    expect(ruleFromCorrection({ merchant: 'OXXO', description: 'Refresco', rawText: '' })).toBe('oxxo');
  });
});
