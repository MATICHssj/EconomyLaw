import { Download, Monitor, Share, Smartphone } from 'lucide-react';
import { config } from '@/config';
import { isCapacitor, isStandalone, platform } from '@/lib/pwa';
import { useUI } from '@/stores/ui';
import { Button, Card, CardTitle, PageHeader, Tip } from '@/components/ui';

export default function InstallPage() {
  const installEvent = useUI((s) => s.installEvent);
  const setInstallEvent = useUI((s) => s.setInstallEvent);
  const p = platform();
  const installed = isStandalone() || isCapacitor();

  return (
    <div className="space-y-4">
      <PageHeader title="Instala la app" subtitle="Gratis, sin tiendas y en 10 segundos." back />
      {installed && <Tip emoji="✅">¡Ya estás usando la app instalada!</Tip>}
      {installEvent && (
        <Button
          block
          size="lg"
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
        >
          <Download className="h-5 w-5" /> Instalar Fina en este dispositivo
        </Button>
      )}
      <Card className={p === 'android' ? 'border-accent-300' : ''}>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Android
          </span>
        </CardTitle>
        <p className="text-sm text-muted">Dos opciones:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            <b>App completa (APK)</b>: incluye avisos sin internet y lectura opcional de
            notificaciones del banco.
          </li>
          <li>
            <b>Desde Chrome</b>: menú ⋮ → “Instalar aplicación” / “Agregar a la pantalla principal”.
          </li>
        </ol>
        <a
          href={config.apkUrl}
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 font-semibold text-white hover:bg-accent-700"
        >
          <Download className="h-5 w-5" /> Descargar para Android (APK)
        </a>
        <p className="mt-2 text-xs text-muted">
          Al abrir el APK, Android te pedirá permitir “instalar apps de fuentes desconocidas” para
          tu navegador. Es normal en apps que no están en Google Play.
        </p>
      </Card>
      <Card className={p === 'ios' ? 'border-accent-300' : ''}>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Share className="h-5 w-5" /> iPhone / iPad
          </span>
        </CardTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            Abre esta página en <b>Safari</b>.
          </li>
          <li>
            Toca el botón <b>Compartir</b> (el cuadrito con flecha hacia arriba).
          </li>
          <li>
            Elige <b>“Agregar a inicio”</b> y luego “Agregar”.
          </li>
          <li>Abre Fina desde tu pantalla de inicio y activa las notificaciones en Ajustes.</li>
        </ol>
      </Card>
      <Card className={p === 'desktop' ? 'border-accent-300' : ''}>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Monitor className="h-5 w-5" /> Computadora (Chrome o Edge)
          </span>
        </CardTitle>
        <p className="text-sm text-muted">
          Haz clic en el ícono de instalar ⊕ en la barra de direcciones, o menú ⋮ → “Instalar Fina”.
          Se abre en su propia ventana, como cualquier programa.
        </p>
      </Card>
      <Tip>Funciona sin internet: anota tus gastos donde sea y se sincronizan al reconectar.</Tip>
    </div>
  );
}
