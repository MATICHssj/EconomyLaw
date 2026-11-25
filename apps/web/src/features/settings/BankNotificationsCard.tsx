import { useEffect, useState } from 'react';
import { BANK_APPS, BankNotifications, bankNotificationsAvailable } from '@/lib/bankNotifications';
import { Button, Card, CardTitle, Sheet, Toggle } from '@/components/ui';

/** Solo en el APK de Android: leer notificaciones de las apps bancarias elegidas. */
export function BankNotificationsCard() {
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const available = bankNotificationsAvailable();

  useEffect(() => {
    if (!available) return;
    const refresh = () => {
      void BankNotifications.isEnabled().then((r) => setEnabled(r.enabled));
      void BankNotifications.getAllowedApps().then((r) => setAllowed(r.packages));
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [available]);

  if (!available) return null;
  const toggleApp = async (pkg: string, on: boolean) => {
    const next = on ? [...new Set([...allowed, pkg])] : allowed.filter((p) => p !== pkg);
    setAllowed(next);
    await BankNotifications.setAllowedApps({ packages: next });
  };

  return (
    <Card className="space-y-2">
      <CardTitle>Notificaciones del banco (Android)</CardTitle>
      <p className="text-sm text-muted">
        Cuando tu banco te avise “Compraste $120 en Starbucks”, lo registro solo. Todo se procesa en
        tu teléfono.
      </p>
      {enabled ? (
        <>
          <p className="text-sm text-income">Permiso activado. Elige de qué apps leer:</p>
          {BANK_APPS.map((b) => (
            <Toggle
              key={b.package}
              label={b.name}
              checked={allowed.includes(b.package)}
              onChange={(v) => void toggleApp(b.package, v)}
            />
          ))}
        </>
      ) : (
        <Button variant="soft" onClick={() => setPrivacyOpen(true)}>
          Activar
        </Button>
      )}
      <Sheet
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Antes de activar"
        footer={
          <Button
            block
            onClick={() => {
              setPrivacyOpen(false);
              void BankNotifications.openSettings();
            }}
          >
            Entendido, abrir el permiso
          </Button>
        }
      >
        <ul className="space-y-2 text-sm text-ink">
          <li>
            Solo leo las apps de banco que TÚ elijas. Ignoro WhatsApp, correos, mensajes y todo lo
            demás.
          </li>
          <li>El texto se procesa en tu teléfono para sacar el monto y el comercio.</li>
          <li>
            Nunca leo contraseñas, códigos ni tokens (y los bancos no los mandan en notificaciones).
          </li>
          <li>
            Puedes desactivarlo cuando quieras en Ajustes del teléfono → Notificaciones → Acceso a
            notificaciones.
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          En la siguiente pantalla busca “Fina” y actívalo. Luego regresa aquí para elegir tus
          bancos.
        </p>
      </Sheet>
    </Card>
  );
}
