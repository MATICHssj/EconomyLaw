import { useEffect, useState } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { checkPin, hasBiometric, hasPin, verifyBiometric } from '@/lib/security';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { LogoMark } from '@/components/Logo';
import { cx } from '@/components/ui';

/** Bloquea la app al abrirla y si estuvo en segundo plano más de 1 minuto. */
export function useAutoLock() {
  const enabled = useData((s) => s.settings.pinEnabled);
  const ready = useData((s) => s.ready);
  useEffect(() => {
    if (!ready || !enabled || !hasPin()) return;
    useUI.getState().setLocked(true);
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) useUI.getState().setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, ready]);
}

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const unlock = () => useUI.getState().setLocked(false);

  useEffect(() => {
    if (hasBiometric()) void verifyBiometric().then((ok) => ok && unlock());
  }, []);

  useEffect(() => {
    if (pin.length < 4) return;
    void checkPin(pin).then((ok) => {
      if (ok) unlock();
      else if (pin.length >= 6) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    });
  }, [pin]);

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <LogoMark className="h-14 w-14" />
      <div className="text-center">
        <h1 className="text-xl font-bold text-ink">Ingresa tu PIN</h1>
        <p className="text-sm text-muted">Tus finanzas están protegidas</p>
      </div>
      <div className={cx('flex gap-3', error && 'animate-pop')} aria-live="polite" aria-label={`${pin.length} dígitos`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cx('h-3.5 w-3.5 rounded-full transition', i < pin.length ? (error ? 'bg-rose-500' : 'bg-accent-600') : 'bg-line')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        {hasBiometric() ? (
          <Key label="Usar huella" onClick={() => void verifyBiometric().then((ok) => ok && unlock())}>
            <Fingerprint className="h-7 w-7" />
          </Key>
        ) : (
          <span />
        )}
        <Key onClick={() => press('0')}>0</Key>
        <Key label="Borrar" onClick={() => setPin((p) => p.slice(0, -1))}>
          <Delete className="h-6 w-6" />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-18 w-18 items-center justify-center rounded-full bg-surface text-2xl font-semibold text-ink shadow-sm active:bg-surface-2" style={{ height: '4.5rem', width: '4.5rem' }}>
      {children}
    </button>
  );
}
