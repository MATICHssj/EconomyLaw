import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { config, hasCloud } from '@/config';
import { createWhatsAppLinkCode } from '@/lib/household';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/ui';
import { Button, Card, CardTitle, PageHeader, Tip } from '@/components/ui';

const EXAMPLES = [
  ['galleta 30', 'Gasto de $30 en Tiendita'],
  ['tacos 120, refresco 25, uber 60', '3 gastos de una vez'],
  ['🎤 nota de voz', '“me gasté doscientos en gasolina”'],
  ['📸 foto del ticket', 'Leo el total, el comercio y la fecha'],
  ['saldo · hoy · semana · mes', 'Resúmenes al instante'],
  ['presupuesto comida', '¿Cuánto te queda?'],
  ['deshacer', 'Borra lo último que mandaste'],
  ['¿cuánto llevo en uber este mes?', 'Preguntas con tus datos reales'],
];

export default function WhatsAppPage() {
  const mode = useSession((s) => s.mode);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = hasCloud() && mode === 'firebase' && !!config.whatsappNumber;

  async function link() {
    setBusy(true);
    try {
      const c = await createWhatsAppLinkCode();
      setCode(c);
      localStorage.setItem('fina:wa-linked', '1');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="WhatsApp" subtitle="Anota tus gastos como si le escribieras a un amigo." back />
      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
        <MessageCircle className="h-10 w-10" />
        <h2 className="mt-2 text-xl font-bold">Manda “uber 85” y listo</h2>
        <p className="mt-1 text-white/85">Te respondo con lo que entendí, cuánto llevas en el mes y botones para corregir o deshacer. Gratis.</p>
      </Card>
      {ready ? (
        <Card className="space-y-3 text-center">
          {code ? (
            <>
              <p className="text-sm text-muted">Tu código (válido 10 minutos)</p>
              <p className="text-4xl font-extrabold tracking-[0.3em] text-ink">{code}</p>
              <a className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700" href={`https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(`vincular ${code}`)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="h-5 w-5" /> Abrir WhatsApp y vincular
              </a>
              <p className="text-xs text-muted">Se abrirá un chat con el mensaje “vincular {code}”. Solo tócale enviar.</p>
            </>
          ) : (
            <Button block size="lg" disabled={busy} onClick={() => void link()}>
              Vincular mi WhatsApp
            </Button>
          )}
        </Card>
      ) : (
        <Tip emoji="🔧">{!hasCloud() || mode !== 'firebase' ? 'Para usar WhatsApp necesitas entrar con tu cuenta (el bot guarda en tu cuenta en la nube).' : 'El bot de WhatsApp aún no está configurado. El dueño de la app debe seguir la guía docs/GUIA-DUENO.md → WhatsApp.'}</Tip>
      )}
      <Card>
        <CardTitle>Lo que entiendo</CardTitle>
        <ul className="space-y-2">
          {EXAMPLES.map(([msg, desc]) => (
            <li key={msg} className="flex items-start gap-3">
              <span className="rounded-2xl rounded-tl-sm bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{msg}</span>
              <span className="pt-1.5 text-sm text-muted">{desc}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Tip>🔒 Tu número se guarda cifrado (hash) y los mensajes originales se borran a los 30 días. Para desvincular, escribe “desvincular” en el chat.</Tip>
    </div>
  );
}
