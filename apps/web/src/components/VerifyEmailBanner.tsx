import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/ui';

/** Aviso para confirmar el correo (cuentas con correo y contraseña). */
export function VerifyEmailBanner() {
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const refresh = useSession((s) => s.refreshUser);
  const [sent, setSent] = useState(false);
  if (mode !== 'firebase' || !user || user.emailVerified) return null;
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
      role="status"
    >
      <MailCheck className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        Confirma tu correo <b>{user.email}</b> para proteger tu cuenta y activar WhatsApp y el modo
        pareja.
      </span>
      <button
        type="button"
        className="font-semibold underline"
        disabled={sent}
        onClick={async () => {
          const fb = await import('@/lib/firebase');
          await fb.resendVerification();
          setSent(true);
          toast('Te reenviamos el correo de verificación.');
        }}
      >
        {sent ? 'Enviado' : 'Reenviar'}
      </button>
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => void refresh().then(() => toast('Listo, revisamos tu verificación.'))}
      >
        Ya lo confirmé
      </button>
    </div>
  );
}
