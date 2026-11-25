import { useMemo, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import {
  BANK_PROFILES,
  dedupe,
  parseStatement,
  type ColumnMapping,
  type ImportStatus,
  type ParsedStatement,
} from '@fina/bank-profiles';
import { INSTITUTION_MAP, newId, type Transaction } from '@fina/core';
import { guessCategory, parse } from '@fina/parser';
import { applyChanges, newAccount, parseContext } from '@/lib/actions';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { Badge, Button, Card, Money, PageHeader, Select, Tip, Toggle, cx } from '@/components/ui';

type Row = ReturnType<typeof dedupe>[number] & { include: boolean; categoryId: string | null };

async function readFile(file: File): Promise<{ text?: string; rows?: string[][] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { default: readXlsxFile } = await import('read-excel-file');
    const rows = await readXlsxFile(file);
    return {
      rows: rows.map((r) =>
        r.map((c) =>
          c instanceof Date ? c.toISOString().slice(0, 10) : c === null ? '' : String(c),
        ),
      ),
    };
  }
  const buf = await file.arrayBuffer();
  // Muchos bancos exportan en Windows-1252: si UTF-8 falla, reintentamos.
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
  return { text };
}

export default function ImportPage() {
  const accounts = useData((s) => s.data.accounts);
  const txs = useData((s) => s.data.transactions);
  const [file, setFile] = useState<{ name: string; text?: string; rows?: string[][] } | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('new');
  const [invert, setInvert] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const parsed: ParsedStatement | null = useMemo(
    () =>
      file
        ? parseStatement(
            { fileName: file.name, text: file.text, rows: file.rows },
            { profileId: profileId || undefined, mapping, invert },
          )
        : null,
    [file, profileId, mapping, invert],
  );

  // Recalcula filas cuando cambia el archivo o la configuración.
  const key = parsed
    ? `${parsed.imported.length}-${profileId}-${invert}-${JSON.stringify(mapping)}-${accountId}`
    : '';
  const [lastKey, setLastKey] = useState('');
  if (parsed && key !== lastKey) {
    setLastKey(key);
    const existing = txs.filter(
      (t) => accountId === 'new' || t.accountId === accountId || t.toAccountId === accountId,
    );
    const ctx = parseContext();
    setRows(
      dedupe(parsed.imported, existing).map((r) => {
        const ruled = parse(`${r.description} ${r.amountCents / 100}`, ctx);
        const cat =
          (ruled.ok && ruled.entry.categorySource === 'rule'
            ? ruled.entry.categoryId
            : undefined) ??
          guessCategory(r.description, r.direction === 'in' ? 'income' : 'expense')?.categoryId ??
          (r.direction === 'in' ? 'other_income' : 'review');
        return { ...r, include: r.status === 'new', categoryId: cat };
      }),
    );
    if (!profileId) setProfileId(parsed.profile.id);
    if (accountId === 'new') {
      const match = accounts.find(
        (a) => a.institution && a.institution === parsed.profile.institutionId && !a.archived,
      );
      if (match) setAccountId(match.id);
    }
  }

  async function onFile(f: File) {
    setBusy(true);
    try {
      const content = await readFile(f);
      setProfileId('');
      setMapping(undefined);
      setInvert(false);
      setAccountId('new');
      setLastKey('');
      setFile({ name: f.name, ...content });
    } catch {
      toast('No pude leer ese archivo. ¿Es CSV, Excel u OFX?', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!parsed) return;
    const selected = rows.filter((r) => r.include);
    if (!selected.length) return;
    const changes = [];
    let accId = accountId;
    if (accId === 'new') {
      const inst = INSTITUTION_MAP[parsed.profile.institutionId];
      const acc = newAccount({
        name: inst?.name ?? 'Cuenta importada',
        type: parsed.profile.defaultAccountType,
        institution: inst?.id,
        color: inst?.color ?? '#64748b',
        icon: parsed.profile.defaultAccountType === 'credit' ? '' : '',
      });
      accId = acc.id;
      changes.push({
        space: 'personal' as const,
        col: 'accounts' as const,
        before: null,
        after: acc,
      });
    }
    const stamp = new Date().toISOString();
    for (const r of selected) {
      const tx: Transaction = {
        id: newId(),
        kind: r.direction === 'out' ? 'expense' : 'income',
        amountCents: r.amountCents,
        currency: 'MXN',
        amountMxnCents: r.amountCents,
        accountId: accId,
        toAccountId: null,
        categoryId: r.categoryId,
        tags: [],
        description: r.description.slice(0, 120),
        date: r.date,
        createdAt: stamp,
        updatedAt: stamp,
        source: 'import',
        status: r.categoryId === 'review' ? 'review' : 'cleared',
        reconciled: true,
        attachments: [],
        dedupeHash: r.hash,
      };
      changes.push({
        space: 'personal' as const,
        col: 'transactions' as const,
        before: null,
        after: tx,
      });
    }
    await applyChanges(changes);
    toast(`${selected.length} movimientos importados`, 'success');
    setFile(null);
    setRows([]);
  }

  const counts = rows.reduce<Record<ImportStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { new: 0, duplicate: 0, probable: 0 },
  );
  const header = parsed?.mapping
    ? (parsed.rows[parsed.mapping.headerRow] ?? [])
    : (parsed?.rows[0] ?? []);
  const colOptions = [
    { value: '', label: '—' },
    ...header.map((h, i) => ({ value: String(i), label: h || `Columna ${i + 1}` })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Importar estado de cuenta"
        subtitle="CSV, Excel u OFX de tu banco. Nunca pedimos contraseñas."
        back
      />
      {!file ? (
        <>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface p-10 text-center transition hover:border-accent-400">
            <Upload className="h-10 w-10 text-accent-500" />
            <span className="text-lg font-semibold text-ink">
              {busy ? 'Leyendo…' : 'Elige o arrastra tu archivo'}
            </span>
            <span className="text-sm text-muted">
              BBVA, Banorte, Santander, Banamex, HSBC, Scotiabank, Nu, Mercado Pago, Hey, Azteca,
              Spin, Klar, Stori y más
            </span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.ofx,.qfx"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
            />
          </label>
          <Card>
            <h2 className="font-semibold text-ink">¿Cómo descargo mi estado de cuenta?</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Entra a la banca en línea de tu banco (en la computadora es más fácil).</li>
              <li>Busca “Movimientos” o “Consultar movimientos” de tu cuenta o tarjeta.</li>
              <li>
                Elige el periodo y toca “Exportar” / “Descargar” en Excel, CSV u OFX (no PDF).
              </li>
              <li>
                Súbelo aquí. Yo detecto el banco, las columnas y no duplico lo que ya anotaste.
              </li>
            </ol>
          </Card>
          <Tip>
            ¿Prefieres que se registren solos? Reenvía los correos de “compra aprobada” de tu banco
            (Ajustes → Correos del banco) o, en Android, activa la lectura de notificaciones del
            banco.
          </Tip>
        </>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-accent-500" />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{file.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                Cambiar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Banco"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                options={BANK_PROFILES.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Select
                label="Importar a la cuenta"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={[
                  { value: 'new', label: 'Crear cuenta nueva' },
                  ...accounts
                    .filter((a) => !a.archived)
                    .map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </div>
            <Toggle
              label="Invertir signos"
              description="Úsalo si los gastos aparecen como ingresos."
              checked={invert}
              onChange={setInvert}
            />
            {parsed?.format !== 'ofx' && (
              <details className="rounded-xl bg-surface-2 p-3" open={!parsed?.mapping}>
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  {parsed?.mapping
                    ? 'Columnas detectadas (cambiar)'
                    : 'No reconocí las columnas: elígelas'}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['date', 'description', 'amount', 'debit', 'credit'] as const).map((role) => (
                    <Select
                      key={role}
                      label={
                        {
                          date: 'Fecha',
                          description: 'Descripción',
                          amount: 'Monto (una columna)',
                          debit: 'Cargos / retiros',
                          credit: 'Abonos / depósitos',
                        }[role]
                      }
                      value={String((parsed?.mapping ?? mapping)?.[role] ?? '')}
                      onChange={(e) => {
                        const base: ColumnMapping = parsed?.mapping ??
                          mapping ?? { headerRow: 0, date: 0, description: 1 };
                        setMapping({
                          ...base,
                          [role]: e.target.value === '' ? undefined : Number(e.target.value),
                        });
                      }}
                      options={colOptions}
                    />
                  ))}
                </div>
              </details>
            )}
          </Card>

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="good">{counts.new} nuevos</Badge>
                {counts.probable > 0 && (
                  <Badge tone="warn">{counts.probable} ya capturados a mano</Badge>
                )}
                {counts.duplicate > 0 && <Badge>{counts.duplicate} ya importados</Badge>}
              </div>
              <Card className="max-h-[50vh] overflow-y-auto p-2">
                <ul>
                  {rows.map((r, i) => (
                    <li
                      key={r.hash}
                      className={cx(
                        'flex items-center gap-3 rounded-xl px-2 py-2',
                        !r.include && 'opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Importar ${r.description}`}
                        checked={r.include}
                        onChange={(e) =>
                          setRows((rs) =>
                            rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)),
                          )
                        }
                        className="h-5 w-5 accent-[var(--a-600)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{r.description}</p>
                        <p className="text-xs text-muted">
                          {r.date} {r.status === 'probable' && '· parece que ya lo anotaste'}{' '}
                          {r.status === 'duplicate' && '· ya importado'}
                        </p>
                      </div>
                      <Money
                        cents={r.amountCents}
                        kind={r.direction === 'in' ? 'income' : 'expense'}
                        className="text-sm font-semibold"
                      />
                    </li>
                  ))}
                </ul>
              </Card>
              <Button
                block
                size="lg"
                onClick={() => void doImport()}
                disabled={!rows.some((r) => r.include)}
              >
                Importar {rows.filter((r) => r.include).length} movimientos
              </Button>
            </>
          ) : (
            <Card>
              <p className="text-sm text-muted">
                No encontré movimientos. Revisa las columnas o el banco seleccionado.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
