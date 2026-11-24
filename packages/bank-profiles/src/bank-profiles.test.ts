import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dedupe, parseBankAmount, parseBankDate, parseBankNotice, parseStatement, availableConnectors } from './index';

const fx = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

describe('estados de cuenta', () => {
  it('lee el CSV de BBVA (cargo/abono, encabezado en la fila 3)', () => {
    const r = parseStatement({ fileName: 'bbva_movimientos.csv', text: fx('bbva_movimientos.csv') });
    expect(r.profile.id).toBe('bbva');
    expect(r.imported).toHaveLength(5);
    expect(r.imported[0]).toMatchObject({ date: '2025-11-20', amountCents: 4550, direction: 'out' });
    expect(r.imported[2]).toMatchObject({ amountCents: 1500000, direction: 'in' });
    expect(r.imported[3]!.amountCents).toBe(125050);
  });
  it('lee el CSV de Nu (crédito: positivo = compra)', () => {
    const r = parseStatement({ fileName: 'nu_credito.csv', text: fx('nu_credito.csv') });
    expect(r.profile.id).toBe('nu');
    expect(r.imported.map((x) => [x.direction, x.amountCents])).toEqual([
      ['out', 8900],
      ['out', 149900],
      ['in', 350000],
      ['out', 12900],
    ]);
  });
  it('lee OFX', () => {
    const r = parseStatement({ fileName: 'banamex.ofx', text: fx('banamex.ofx') });
    expect(r.format).toBe('ofx');
    expect(r.imported).toHaveLength(2);
    expect(r.imported[0]).toMatchObject({ date: '2025-11-18', amountCents: 23000, direction: 'out', externalId: 'A1' });
  });
  it('fechas y montos en formatos mexicanos', () => {
    expect(parseBankDate('15/11/2025')).toBe('2025-11-15');
    expect(parseBankDate('15-nov-2025')).toBe('2025-11-15');
    expect(parseBankDate('15/Nov/25')).toBe('2025-11-15');
    expect(parseBankDate('2025-11-15T10:00:00')).toBe('2025-11-15');
    expect(parseBankAmount('$1,234.56')).toBe(123456);
    expect(parseBankAmount('(1,234.56)')).toBe(-123456);
    expect(parseBankAmount('1.234,56')).toBe(123456);
    expect(parseBankAmount('-85.00')).toBe(-8500);
  });
  it('no duplica lo capturado a mano (±3 días, mismo monto) ni lo ya importado', () => {
    const r = parseStatement({ fileName: 'bbva.csv', text: fx('bbva_movimientos.csv') });
    const existing = [
      { id: 'm1', date: '2025-11-19', amountMxnCents: 4550, kind: 'expense', description: 'oxxo', source: 'app' },
      { id: 'i1', date: '2025-11-15', amountMxnCents: 29900, kind: 'expense', description: 'NETFLIX.COM', source: 'import', dedupeHash: r.imported[4]!.hash },
    ];
    const d = dedupe(r.imported, existing);
    expect(d.map((x) => x.status)).toEqual(['probable', 'new', 'new', 'new', 'duplicate']);
    expect(d[0]!.matchId).toBe('m1');
  });
});

describe('correos y notificaciones bancarias', () => {
  it('BBVA compra aprobada', () => {
    const n = parseBankNotice({ from: 'notificaciones@bbva.mx', subject: 'Compra aprobada', text: 'Se realizó una compra aprobada por $245.00 en OXXO SUC 23 con tu tarjeta terminación 1234 el 20/11/2025.' });
    expect(n).toMatchObject({ bankId: 'bbva', kind: 'expense', amountCents: 24500, merchant: 'OXXO', last4: '1234', date: '2025-11-20', categoryId: 'snacks' });
  });
  it('Nu "Compraste"', () => {
    expect(parseBankNotice({ from: 'hola@nu.com.mx', text: 'Compraste $120.00 en STARBUCKS COYOACAN con tu tarjeta Nu.' })).toMatchObject({ bankId: 'nu', amountCents: 12000, merchant: 'Starbucks', categoryId: 'coffee' });
  });
  it('Mercado Pago pago y depósito', () => {
    expect(parseBankNotice({ from: 'info@mercadopago.com', text: 'Pagaste $350.50 a Farmacias del Ahorro.' })).toMatchObject({ kind: 'expense', amountCents: 35050, categoryId: 'health' });
    expect(parseBankNotice({ from: 'info@mercadopago.com', text: 'Recibiste $1,000.00 de Juan Pérez' })).toMatchObject({ kind: 'income', amountCents: 100000 });
  });
  it('genérico (banco desconocido) y texto que no es compra', () => {
    expect(parseBankNotice({ text: 'Cargo por $89.90 en SPOTIFY a las 10:30' })).toMatchObject({ kind: 'expense', amountCents: 8990 });
    expect(parseBankNotice({ text: 'Tu estado de cuenta ya está disponible' })).toBeNull();
  });
});

describe('conectores', () => {
  it('Belvo está apagado sin credenciales', () => {
    expect(availableConnectors().map((c) => c.id)).toEqual(['manual']);
    expect(availableConnectors({ BELVO_SECRET_ID: 'x', BELVO_SECRET_PASSWORD: 'y' }).map((c) => c.id)).toEqual(['manual', 'belvo']);
  });
});
