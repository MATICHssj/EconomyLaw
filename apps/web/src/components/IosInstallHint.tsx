import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { isStandalone } from '@/lib/pwa';

const KEY = 'fina:ios-hint-dismissed';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|WhatsApp/i.test(ua);
}

/**
 * iPhone: guía para "Agregar a pantalla de inicio" (así Fina se abre como app
 * a pantalla completa). Aparece si llegas desde la página de descarga
 * (?instalar=1) o la primera vez que abres Fina en Safari.
 */
export function IosInstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (isStandalone()) return;
    const fromDownload = new URLSearchParams(location.search).has('instalar');
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === '1';
    } catch {
      /* sin almacenamiento */
    }
    if (isIosSafari() && (fromDownload || !dismissed)) setShow(true);
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  };
  return (
    <div
      role="dialog"
      aria-label="Instalar Fina en tu iPhone"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-50 rounded-2xl border border-line bg-surface p-4 shadow-xl animate-sheet"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar"
        className="absolute top-2 right-2 rounded-full p-2 text-muted hover:bg-surface-2"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 font-semibold text-ink">Instala Fina en tu iPhone</p>
      <ol className="mt-2 space-y-1.5 text-sm text-ink">
        <li>
          1. Toca <Share className="inline h-4 w-4 align-[-2px] text-accent-600" /> <b>Compartir</b>{' '}
          (abajo en el centro de Safari).
        </li>
        <li>
          2. Elige <b>“Agregar a pantalla de inicio”</b> y luego <b>“Agregar”</b>.
        </li>
        <li>3. Abre Fina desde su ícono: se ve como cualquier app y se actualiza sola.</li>
      </ol>
      <div className="mt-2 flex justify-center text-accent-600" aria-hidden>
        ↓
      </div>
    </div>
  );
}
