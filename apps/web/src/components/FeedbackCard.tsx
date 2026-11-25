import { useState } from 'react';
import { Mail, MessageCircle, MessageSquareHeart } from 'lucide-react';
import { config } from '@/config';
import { isCapacitor } from '@/lib/pwa';
import { Button, Card, Chip, Sheet } from './ui';

const TOPICS = ['Algo no funciona', 'Tengo una idea', 'No entendí cómo…', 'Me encantó'];

function deviceLine(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : 'Computadora';
  return `Fina ${config.version}${config.build ? ` (compilación ${config.build})` : ''} · ${os}${isCapacitor() ? ' · APK' : ' · web'}`;
}

/** Beta: los que prueban la app mandan comentarios por WhatsApp o correo. */
export function FeedbackCard() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [text, setText] = useState('');
  if (!config.feedbackEmail && !config.feedbackWhatsApp) return null;
  const body = `${topic}: ${text.trim()}\n\n— ${deviceLine()}`;
  const send = (url: string) => {
    window.open(url, '_blank');
    setOpen(false);
    setText('');
  };
  return (
    <>
      <Card className="flex items-center gap-3">
        <MessageSquareHeart className="h-6 w-6 shrink-0 text-accent-600" />
        <div className="flex-1">
          <p className="font-semibold text-ink">Enviar comentarios</p>
          <p className="text-sm text-muted">¿Algo falla o se te ocurre una mejora? Cuéntanos.</p>
        </div>
        <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
          Escribir
        </Button>
      </Card>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Enviar comentarios"
        footer={
          <div className="flex gap-2">
            {config.feedbackWhatsApp && (
              <Button
                block
                disabled={!text.trim()}
                onClick={() =>
                  send(
                    `https://wa.me/${config.feedbackWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`,
                  )
                }
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            )}
            {config.feedbackEmail && (
              <Button
                block
                variant={config.feedbackWhatsApp ? 'secondary' : 'primary'}
                disabled={!text.trim()}
                onClick={() =>
                  send(
                    `mailto:${config.feedbackEmail}?subject=${encodeURIComponent(`Fina beta: ${topic}`)}&body=${encodeURIComponent(body)}`,
                  )
                }
              >
                <Mail className="h-4 w-4" /> Correo
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>
                {t}
              </Chip>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={1500}
            placeholder="Cuéntanos qué pasó o qué te gustaría. Si es un error: ¿qué estabas haciendo?"
            className="w-full rounded-xl border border-line bg-surface p-3 text-ink outline-none focus:border-accent-500"
            aria-label="Tu comentario"
          />
          <p className="text-xs text-muted">
            Se agrega la versión de la app y tu tipo de teléfono. Nunca se envían tus movimientos.
          </p>
        </div>
      </Sheet>
    </>
  );
}
