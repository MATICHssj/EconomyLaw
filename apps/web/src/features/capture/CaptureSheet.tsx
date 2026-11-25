import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Mic, MicOff, Send } from 'lucide-react';
import { hasWorker } from '@/config';
import { scanReceipt } from '@/lib/api';
import { useSpeech } from '@/lib/speech';
import { useData } from '@/stores/data';
import { toast, useUI } from '@/stores/ui';
import { Button, Chip, IconButton, Segmented, Sheet, Tip, cx } from '@/components/ui';
import { EntryPreview } from './EntryPreview';
import { EXAMPLES, useCapture } from './useCapture';
import type { Space } from '@/lib/backend/types';

export function CaptureSheet() {
  const open = useUI((s) => s.captureOpen);
  const initial = useUI((s) => s.captureText);
  const close = useUI((s) => s.closeCapture);
  const { text, setText, entries, problems, submit } = useCapture();
  const household = useData((s) => s.household);
  const spaceFilter = useData((s) => s.spaceFilter);
  const [space, setSpace] = useState<Space>('personal');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speech = useSpeech((t) => setText(t));
  const txs = useData((s) => s.data.transactions);

  useEffect(() => {
    if (open) {
      setText(initial);
      setSpace(household && spaceFilter === 'household' ? 'household' : 'personal');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sugerencias: tus últimas descripciones distintas (para repetir con un toque).
  const recent = Array.from(
    new Set(
      [...txs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40)
        .filter((t) => t.kind === 'expense')
        .map((t) => t.description.toLowerCase()),
    ),
  ).slice(0, 5);

  async function onSave() {
    const ok = await submit({ space });
    if (ok) close();
  }

  async function onPhoto(file: File) {
    setScanning(true);
    try {
      const r = await scanReceipt(file);
      if (r.total)
        setText(
          `${r.merchant ?? 'ticket'} ${r.total}${r.date ? ` ${r.date.split('-').reverse().slice(0, 2).join('/')}` : ''}`,
        );
      else toast('No pude leer el total del ticket. Escríbelo tú 🙏', 'error');
    } catch (e) {
      toast((e as Error).message || 'No se pudo leer el ticket', 'error');
    } finally {
      setScanning(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Anotar"
      footer={
        <Button block size="lg" disabled={!entries.length} onClick={onSave}>
          <Send className="h-5 w-5" />
          {entries.length > 1 ? `Guardar ${entries.length} movimientos` : 'Guardar'}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
        className="space-y-3"
      >
        <div
          className={cx(
            'flex items-center gap-1 rounded-2xl border-2 bg-surface px-2 transition',
            text ? 'border-accent-500' : 'border-line',
          )}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej. galleta 30"
            aria-label="¿Qué gastaste o recibiste?"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-transparent px-2 py-3.5 text-lg text-ink outline-none placeholder:text-muted/60 focus-visible:outline-none"
          />
          {speech.supported && (
            <IconButton
              label={speech.listening ? 'Detener dictado' : 'Dictar por voz'}
              onClick={speech.listening ? speech.stop : speech.start}
              className={speech.listening ? 'animate-pulse bg-rose-50 text-rose-600' : ''}
            >
              {speech.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </IconButton>
          )}
          {hasWorker() && (
            <>
              <IconButton
                label="Foto del ticket"
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </IconButton>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => e.target.files?.[0] && void onPhoto(e.target.files[0])}
              />
            </>
          )}
        </div>
        {speech.error && <p className="text-sm text-rose-600">{speech.error}</p>}

        {household && (
          <Segmented
            label="¿Dónde se guarda?"
            value={space}
            onChange={setSpace}
            options={[
              { value: 'personal', label: '🙋 Personal' },
              { value: 'household', label: `🏠 ${household.name}` },
            ]}
          />
        )}

        {entries.length > 0 && (
          <div className="space-y-2" aria-live="polite">
            {entries.map((e, i) => (
              <EntryPreview key={i} entry={e} />
            ))}
          </div>
        )}
        {problems.map(
          (p, i) =>
            !p.ok && (
              <p
                key={i}
                className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                {p.message}
              </p>
            ),
        )}

        {!text && (
          <div className="space-y-3">
            {recent.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                  Recientes
                </p>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {recent.map((r) => (
                    <Chip key={r} onClick={() => setText(`${r} `)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                Prueba escribir
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.slice(0, 8).map((ex) => (
                  <Chip key={ex} onClick={() => setText(ex)}>
                    {ex}
                  </Chip>
                ))}
              </div>
            </div>
            <Tip>
              Escribe como hablas: <b>qué + cuánto</b>. Puedes agregar la cuenta (<i>con nu</i>), la
              fecha (<i>ayer</i>), dividir (<i>entre 3</i>) o meses sin intereses (<i>a 12 msi</i>).
            </Tip>
          </div>
        )}
      </form>
    </Sheet>
  );
}
