import { useState } from 'react';
import { clearErrors, errorReport, getErrors } from '@/lib/errorLog';
import { toast } from '@/stores/ui';

/** Ajustes: cuántos errores ha registrado la app en este teléfono, para copiarlos o borrarlos. */
export function DiagnosticsRow() {
  const [count, setCount] = useState(() => getErrors().length);
  if (!count) return <p>Sin errores registrados en este dispositivo.</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-3">
      <span>
        {count} {count === 1 ? 'error registrado' : 'errores registrados'}
      </span>
      <button
        type="button"
        className="font-medium text-accent-600"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(errorReport(10));
            toast('Copiado. Pégalo en tus comentarios.', 'success');
          } catch {
            toast('No pude copiar. Usa Más → Enviar comentarios.', 'error');
          }
        }}
      >
        Copiar
      </button>
      <button
        type="button"
        className="font-medium text-muted"
        onClick={() => {
          clearErrors();
          setCount(0);
        }}
      >
        Borrar
      </button>
    </p>
  );
}
