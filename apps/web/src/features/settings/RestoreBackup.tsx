import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  COLLECTIONS,
  COLLECTION_LABELS,
  formatLongDate,
  parseBackup,
  type ParsedBackup,
} from '@fina/core';
import type { AnyDoc, WriteOp } from '@/lib/backend/types';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { Button, Sheet, Toggle } from '@/components/ui';

const MAX_BYTES = 60 * 1024 * 1024;

/** Carga un respaldo .json: se combina con lo que ya tienes (nada se borra). */
async function restoreBackup(b: ParsedBackup, includeProfile: boolean): Promise<number> {
  const s = useData.getState();
  const ops: WriteOp[] = [];
  for (const col of COLLECTIONS)
    for (const doc of b.data[col])
      ops.push({ type: 'put', space: 'personal', col, doc: doc as AnyDoc });
  await s.write(ops);
  if (includeProfile) {
    if (b.profile) await s.updateProfile(b.profile);
    if (b.settings) await s.updateSettings(b.settings);
  }
  return ops.length;
}

export function RestoreBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [includeProfile, setIncludeProfile] = useState(true);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast('El archivo es demasiado grande para ser un respaldo de Fina.', 'error');
      return;
    }
    try {
      const r = parseBackup(JSON.parse(await file.text()));
      if (!r.ok) toast(r.error, 'error');
      else setBackup(r.backup);
    } catch {
      toast('No pude leer el archivo. Elige el .json que descargaste de Fina.', 'error');
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => input.current?.click()}>
        <Upload className="h-4 w-4" /> Restaurar un respaldo
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Elegir respaldo"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Sheet
        open={!!backup}
        onClose={() => setBackup(null)}
        title="Restaurar respaldo"
        footer={
          <Button
            block
            disabled={busy}
            onClick={async () => {
              if (!backup) return;
              setBusy(true);
              try {
                const n = await restoreBackup(backup, includeProfile);
                toast(`Listo: se restauraron ${n.toLocaleString('es-MX')} datos.`, 'success');
                setBackup(null);
              } catch {
                toast('No se pudo restaurar. Intenta de nuevo.', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? 'Restaurando…'
              : `Restaurar ${backup?.total.toLocaleString('es-MX') ?? ''} datos`}
          </Button>
        }
      >
        {backup && (
          <div className="space-y-3 text-sm">
            <p className="text-ink">
              Respaldo
              {backup.exportedAt && ` del ${formatLongDate(backup.exportedAt.slice(0, 10), true)}`}.
              Contiene:
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {COLLECTIONS.filter((c) => backup.counts[c]).map((c) => (
                <li key={c} className="flex justify-between gap-2 border-b border-line py-1">
                  <span className="text-muted">{COLLECTION_LABELS[c]}</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {backup.counts[c]!.toLocaleString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
            {backup.skipped > 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                {backup.skipped}{' '}
                {backup.skipped === 1 ? 'dato venía dañado' : 'datos venían dañados'} y se omitirán.
              </p>
            )}
            <p className="text-muted">
              Se combina con lo que ya tienes: si algo ya existe, se reemplaza por la versión del
              respaldo. No se borra nada.
            </p>
            {(backup.profile || backup.settings) && (
              <Toggle
                label="También mi perfil y ajustes"
                description="Nombre, nivel, día de pago, colores y avisos."
                checked={includeProfile}
                onChange={setIncludeProfile}
              />
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
