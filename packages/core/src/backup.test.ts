import { describe, expect, it } from 'vitest';
import { generateDemoData, parseBackup, COLLECTIONS } from './index';

describe('respaldos', () => {
  const demo = generateDemoData('2026-01-15', '2026-01-15T12:00:00.000Z');
  const file = {
    exportedAt: '2026-01-15T12:00:00.000Z',
    app: 'Fina',
    profile: { name: 'Ana', level: 'organized' },
    settings: { theme: 'dark' },
    ...Object.fromEntries(COLLECTIONS.map((c) => [c, demo[c] ?? []])),
  };

  it('carga un respaldo completo y valida cada documento', () => {
    const r = parseBackup(JSON.parse(JSON.stringify(file)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.skipped).toBe(0);
    expect(r.backup.counts.transactions).toBe(demo.transactions!.length);
    expect(r.backup.counts.trips).toBe(1);
    expect(r.backup.profile?.name).toBe('Ana');
    expect(r.backup.exportedAt).toBe('2026-01-15T12:00:00.000Z');
  });

  it('omite documentos inválidos sin romper el resto', () => {
    const broken = { ...file, transactions: [...demo.transactions!, { id: 'x', amountCents: 'mucho' }] };
    const r = parseBackup(broken);
    expect(r.ok && r.backup.skipped).toBe(1);
    expect(r.ok && r.backup.counts.transactions).toBe(demo.transactions!.length);
  });

  it('rechaza archivos que no son de Fina', () => {
    expect(parseBackup({ hola: 'mundo' }).ok).toBe(false);
    expect(parseBackup([1, 2, 3]).ok).toBe(false);
    expect(parseBackup(null).ok).toBe(false);
    expect(parseBackup({ app: 'Fina' }).ok).toBe(false);
  });
});
