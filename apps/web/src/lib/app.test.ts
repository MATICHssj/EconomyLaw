import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, newId, todayISO, TripSchema, type Transaction } from '@fina/core';
import { LocalBackend } from '@/lib/backend/local';
import { applyChanges, commitEntries, resolveDuplicate, saveDoc } from '@/lib/actions';
import { backupDue, markBackupDone, snoozeBackup } from '@/lib/exporter';
import { getErrors, recordError, sanitize, clearErrors } from '@/lib/errorLog';
import { useData } from '@/stores/data';
import { entries, freshApp, undoLast, waitFor } from '@/test/helpers';

const txs = () => useData.getState().data.transactions;

describe('modo local (IndexedDB)', () => {
  it('guarda, avisa a los suscriptores y sobrevive a reabrir la app', async () => {
    indexedDB.deleteDatabase('fina-local');
    const a = new LocalBackend();
    let seen: unknown[] = [];
    a.subscribe('personal', 'goals', (docs) => (seen = docs));
    const goal = {
      id: 'g1',
      name: 'Viaje',
      emoji: 'i:plane',
      targetCents: 1000000,
      savedCents: 0,
      type: 'normal' as const,
      createdAt: '2026-01-01',
      archived: false,
    };
    await a.write([{ type: 'put', space: 'personal', col: 'goals', doc: goal }]);
    await waitFor(() => seen.length === 1);
    await a.setMeta({ profile: { name: 'Ana' } as never });
    a.dispose();

    const b = new LocalBackend();
    let again: unknown[] = [];
    let name: string | undefined;
    b.subscribe('personal', 'goals', (docs) => (again = docs));
    b.subscribeMeta((m) => (name = m.profile?.name));
    await waitFor(() => again.length === 1 && name === 'Ana');
    await b.write([{ type: 'delete', space: 'personal', col: 'goals', id: 'g1' }]);
    await waitFor(() => again.length === 0);
    b.dispose();
  });
});

describe('anotar (commitEntries) con deshacer', () => {
  beforeEach(async () => {
    await freshApp();
  });

  it('"galleta 30" se guarda en Tiendita y se puede deshacer', async () => {
    await commitEntries(entries('galleta 30'));
    await waitFor(() => txs().length === 1);
    expect(txs()[0]).toMatchObject({ amountCents: 3000, kind: 'expense', categoryId: 'snacks' });
    await undoLast();
    await waitFor(() => txs().length === 0);
  });

  it('MSI, gastos compartidos y préstamos crean sus documentos', async () => {
    await commitEntries(entries('tv 12000 a 12 msi'));
    await commitEntries(entries('cena 900 entre 3'));
    await commitEntries(entries('le presté 200 a juan'));
    await waitFor(() => txs().length === 3);
    const s = useData.getState().data;
    expect(s.installmentPlans).toHaveLength(1);
    expect(s.installmentPlans[0]).toMatchObject({ months: 12, totalCents: 1200000 });
    expect(s.splits).toHaveLength(1);
    expect(txs().find((t) => t.splitId)?.myShareCents).toBe(30000);
    expect(s.loans[0]).toMatchObject({ person: expect.stringMatching(/juan/i), amountCents: 20000 });
  });

  it('durante un viaje, el gasto se guarda en ese viaje', async () => {
    const today = todayISO();
    const trip = TripSchema.parse({
      id: 'trip1',
      name: 'Oaxaca',
      startDate: addDays(today, -1),
      endDate: addDays(today, 2),
      createdAt: new Date().toISOString(),
    });
    await saveDoc('trips', trip);
    await waitFor(() => useData.getState().data.trips.length === 1);
    await commitEntries(entries('tlayuda 150'));
    await waitFor(() => txs().length === 1);
    expect(txs()[0]?.tripId).toBe('trip1');
  });
});

describe('¿es el mismo gasto?', () => {
  beforeEach(async () => {
    await freshApp();
  });

  async function setup() {
    await commitEntries(entries('oxxo 245'));
    await waitFor(() => txs().length === 1);
    const manual = txs()[0]!;
    const stamp = new Date().toISOString();
    const bank: Transaction = {
      ...manual,
      id: newId(),
      source: 'notification',
      merchant: 'OXXO SUC 23',
      accountId: 'tarjeta-nu',
      dedupeHash: 'notif-1',
      duplicateOf: manual.id,
      status: 'review',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await applyChanges([{ space: 'personal', col: 'transactions', before: null, after: bank }]);
    await waitFor(() => txs().length === 2);
    return { manual, bank };
  }

  it('"Sí": se queda el tuyo con la cuenta y comercio del banco', async () => {
    const { manual, bank } = await setup();
    await resolveDuplicate(bank.id, true);
    await waitFor(() => txs().length === 1);
    expect(txs()[0]).toMatchObject({
      id: manual.id,
      accountId: 'tarjeta-nu',
      dedupeHash: 'notif-1',
    });
  });

  it('"No": se quedan los dos y ya no se pregunta', async () => {
    const { bank } = await setup();
    await resolveDuplicate(bank.id, false);
    await waitFor(() => !txs().find((t) => t.id === bank.id)?.duplicateOf);
    expect(txs()).toHaveLength(2);
  });
});

describe('respaldo y registro de errores', () => {
  it('pide respaldo cada 30 días solo sin cuenta y con datos', () => {
    localStorage.clear();
    expect(backupDue(50, true)).toBe(true);
    expect(backupDue(50, false)).toBe(false);
    expect(backupDue(5, true)).toBe(false);
    markBackupDone();
    expect(backupDue(50, true)).toBe(false);
    expect(backupDue(50, true, Date.now() + 31 * 86_400_000)).toBe(true);
    snoozeBackup(14);
    expect(backupDue(50, true, Date.now() + 31 * 86_400_000)).toBe(true);
    expect(backupDue(50, true, Date.now() + 10 * 86_400_000)).toBe(false);
  });

  it('el registro de errores no guarda datos personales y agrupa repetidos', () => {
    clearErrors();
    expect(sanitize('Falló para ana@correo.com con tarjeta 4111111111111111', 300)).toBe(
      'Falló para [correo] con tarjeta #',
    );
    recordError(new TypeError('x is undefined'));
    recordError(new TypeError('x is undefined'));
    const list = getErrors();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ message: 'TypeError: x is undefined', count: 2 });
  });
});
