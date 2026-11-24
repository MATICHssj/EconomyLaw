import { toCsv, COLLECTIONS, type Transaction } from '@fina/core';
import { useData } from '@/stores/data';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function txRows(txs: Transaction[]) {
  const s = useData.getState();
  const acc = new Map(s.data.accounts.map((a) => [a.id, a.name]));
  const cat = new Map(s.data.categories.map((c) => [c.id, c.name]));
  const header = ['Fecha', 'Tipo', 'Descripción', 'Comercio', 'Categoría', 'Cuenta', 'Cuenta destino', 'Monto', 'Moneda', 'Monto MXN', 'Tu parte', 'Etiquetas', 'Nota', 'Conciliado', 'Origen'];
  const rows = txs.map((t) => [
    t.date,
    t.kind,
    t.description,
    t.merchant ?? '',
    t.categoryId ? (cat.get(t.categoryId) ?? t.categoryId) : '',
    t.accountId ? (acc.get(t.accountId) ?? '') : '',
    t.toAccountId ? (acc.get(t.toAccountId) ?? '') : '',
    (t.amountCents / 100).toFixed(2),
    t.currency,
    (t.amountMxnCents / 100).toFixed(2),
    t.myShareCents !== undefined ? (t.myShareCents / 100).toFixed(2) : '',
    t.tags.map((x) => `#${x}`).join(' '),
    t.note ?? '',
    t.reconciled ? 'sí' : 'no',
    t.source,
  ]);
  return { header, rows };
}

export function exportTransactionsCsv(txs: Transaction[]) {
  const { header, rows } = txRows([...txs].sort((a, b) => a.date.localeCompare(b.date)));
  // BOM para que Excel abra bien los acentos.
  downloadBlob(new Blob(['﻿' + toCsv([header, ...rows])], { type: 'text/csv;charset=utf-8' }), `fina-movimientos-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportTransactionsXlsx(txs: Transaction[]) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const { header, rows } = txRows([...txs].sort((a, b) => a.date.localeCompare(b.date)));
  const data = [header.map((h) => ({ value: h, fontWeight: 'bold' as const })), ...rows.map((r) => r.map((v, i) => (i === 7 || i === 9 || (i === 10 && v !== '') ? { type: Number, value: Number(v) } : { type: String, value: String(v) })))];
  const blob = await writeXlsxFile(data as never, { buffer: false } as never) as unknown as Blob;
  downloadBlob(blob, `fina-movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Respaldo completo: todos tus datos en JSON (para llevártelos a donde quieras). */
export function exportAllJson() {
  const s = useData.getState();
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), app: 'Fina', profile: s.profile, settings: s.settings };
  for (const col of COLLECTIONS) data[col] = s.data[col].map(({ space: _s, ...rest }) => rest);
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `fina-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
}
