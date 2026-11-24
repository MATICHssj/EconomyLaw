import { LogoMark } from './Logo';

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-label="Cargando">
      <LogoMark className="h-16 w-16 animate-pulse" />
    </div>
  );
}
