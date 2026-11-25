import { useEffect, useState } from 'react';
import { CornerDownLeft, Mic, PenLine } from 'lucide-react';
import { useSpeech } from '@/lib/speech';
import { useData } from '@/stores/data';
import { cx } from '@/components/ui';
import { EntryPreview } from './EntryPreview';
import { EXAMPLES, useCapture } from './useCapture';

/** Barra de captura siempre visible: escribe "galleta 30" y Enter. */
export function QuickCaptureBar({ autoFocus }: { autoFocus?: boolean }) {
  const { text, setText, entries, problems, submit } = useCapture();
  const household = useData((s) => s.household);
  const spaceFilter = useData((s) => s.spaceFilter);
  const speech = useSpeech((t) => setText(t));
  const [exampleIdx, setExampleIdx] = useState(0);

  useEffect(() => {
    if (text) return;
    const t = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), 3000);
    return () => clearInterval(t);
  }, [text]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit({
            space: household && spaceFilter === 'household' ? 'household' : 'personal',
          });
        }}
        className={cx(
          'flex items-center gap-2 rounded-2xl border-2 bg-surface px-3 shadow-sm transition focus-within:border-accent-500',
          text ? 'border-accent-500' : 'border-line',
        )}
      >
        <PenLine className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Anotar gasto o ingreso"
          placeholder={`Escribe: ${EXAMPLES[exampleIdx]}`}
          enterKeyHint="done"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[1.05rem] text-ink outline-none placeholder:text-muted/60 focus-visible:outline-none"
        />
        {speech.supported && !text && (
          <button
            type="button"
            aria-label="Dictar por voz"
            onClick={speech.listening ? speech.stop : speech.start}
            className={cx(
              'rounded-full p-2 text-muted hover:bg-surface-2',
              speech.listening && 'animate-pulse text-rose-600',
            )}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
        {entries.length > 0 && (
          <button
            type="submit"
            className="flex items-center gap-1 rounded-xl bg-accent-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Guardar <CornerDownLeft className="h-4 w-4" />
          </button>
        )}
      </form>
      {text && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {entries.map((e, i) => (
            <EntryPreview key={i} entry={e} compact />
          ))}
          {problems.map(
            (p, i) =>
              !p.ok && (
                <p key={i} className="px-1 text-sm text-amber-700 dark:text-amber-300">
                  {p.message}
                </p>
              ),
          )}
        </div>
      )}
    </div>
  );
}
