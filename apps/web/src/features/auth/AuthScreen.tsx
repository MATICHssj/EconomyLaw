import { useState } from 'react';
import { BRAND } from '@fina/core';
import { useSession } from '@/stores/session';
import { Button, Input, Segmented } from '@/components/ui';
import { Logo } from '@/components/Logo';

/** Pantalla de entrada: Google, correo o probar sin cuenta. */
export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const startLocal = useSession((s) => s.startLocal);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const fb = await import('@/lib/firebase');
      setError(fb.authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-col justify-center bg-gradient-to-br from-accent-600 to-accent-900 px-8 py-12 text-white lg:w-1/2 lg:px-16">
        <div className="[&_span]:text-white">
          <Logo size="lg" />
        </div>
        <h1 className="mt-8 max-w-md text-3xl leading-tight font-bold lg:text-4xl">{BRAND.slogan}</h1>
        <ul className="mt-6 space-y-2 text-white/90">
          <li>✍️ Escribe “galleta 30” y listo. También por WhatsApp.</li>
          <li>💳 Tarjetas, MSI, quincenas, tandas y CETES: hecho para México.</li>
          <li>💑 Finanzas en pareja: cuentas claras sin pleitos.</li>
          <li>🔒 Nunca te pedimos la contraseña de tu banco.</li>
        </ul>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-5">
          <Button variant="secondary" size="lg" block disabled={busy} onClick={() => void run(async () => (await import('@/lib/firebase')).signInGoogle())}>
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continuar con Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> o con tu correo <span className="h-px flex-1 bg-line" />
          </div>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'login', label: 'Entrar' }, { value: 'signup', label: 'Crear cuenta' }]} />
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const fb = await import('@/lib/firebase');
                if (mode === 'login') await fb.signInEmail(email, password);
                else await fb.signUpEmail(name, email, password);
              });
            }}
          >
            {mode === 'signup' && <Input label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />}
            <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <Input label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {info && <p className="text-sm text-income">{info}</p>}
            <Button type="submit" block size="lg" disabled={busy}>
              {mode === 'login' ? 'Entrar' : 'Crear mi cuenta gratis'}
            </Button>
            {mode === 'login' && (
              <button
                type="button"
                className="w-full text-center text-sm text-accent-600"
                onClick={() =>
                  void run(async () => {
                    const fb = await import('@/lib/firebase');
                    await fb.resetPassword(email);
                    setInfo('Te enviamos un correo para cambiar tu contraseña.');
                  })
                }
              >
                Olvidé mi contraseña
              </button>
            )}
          </form>
          <div className="rounded-2xl bg-surface-2 p-4 text-center">
            <p className="text-sm text-muted">¿Solo quieres probar?</p>
            <Button variant="ghost" onClick={startLocal}>
              Usar sin cuenta (solo en este dispositivo)
            </Button>
          </div>
          <p className="text-center text-xs text-muted">
            Al continuar aceptas los <a className="underline" href="#/terminos">Términos</a> y el <a className="underline" href="#/privacidad">Aviso de privacidad</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
