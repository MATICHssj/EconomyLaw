import { useState } from 'react';
import { Link } from 'react-router';
import { Download, LogOut, Trash2 } from 'lucide-react';
import { ACCENT_PALETTES, LEVEL_INFO, type AccentName, type Level, type Profile } from '@fina/core';
import { config, hasCloud, hasWorker } from '@/config';
import { clearDemoData, hasDemoData, loadDemoData, uploadLocalData } from '@/lib/actions';
import { workerFetch } from '@/lib/api';
import { exportAllJson, exportTransactionsCsv, exportTransactionsXlsx } from '@/lib/exporter';
import { enablePush, pushStatus } from '@/lib/notifications';
import { biometricAvailable, clearPin, enrollBiometric, hasBiometric, setPin } from '@/lib/security';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/ui';
import { Button, Card, CardTitle, Chip, Input, MoneyInput, PageHeader, Segmented, Sheet, Toggle, confirmDialog, cx } from '@/components/ui';

export default function SettingsPage() {
  const profile = useData((s) => s.profile);
  const settings = useData((s) => s.settings);
  const updateProfile = useData((s) => s.updateProfile);
  const updateSettings = useData((s) => s.updateSettings);
  const txs = useData((s) => s.data.transactions);
  const backend = useData((s) => s.backend);
  const session = useSession();
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPinValue] = useState('');
  const [push, setPush] = useState(pushStatus());
  const level: Level = profile?.level ?? 'basic';
  const emailAddress = config.emailDomain && session.user ? `u-${session.user.uid.slice(0, 10).toLowerCase()}@${config.emailDomain}` : null;

  async function deleteEverything() {
    if (!(await confirmDialog('¿Borrar TODOS tus datos?', { text: 'Se borran tus movimientos, cuentas, metas y tu perfil. No se puede deshacer. Te recomendamos exportar antes.', danger: true, ok: 'Sí, borrar todo' }))) return;
    try {
      if (session.mode === 'firebase' && hasWorker()) await workerFetch('/api/account/delete', {});
      else await backend?.wipe();
      clearPin();
      toast('Tus datos fueron borrados.');
      await session.signOut();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" back />

      <Card className="space-y-3">
        <CardTitle>Cuenta</CardTitle>
        {session.mode === 'local' ? (
          <>
            <p className="text-sm text-muted">Estás usando la app <b>sin cuenta</b>: tus datos viven solo en este dispositivo.</p>
            {hasCloud() && (
              <Button
                variant="soft"
                onClick={async () => {
                  localStorage.setItem('fina:migrate', '1');
                  localStorage.removeItem('fina:mode');
                  location.reload();
                }}
              >
                Crear cuenta para sincronizar mis dispositivos
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-ink">{session.user?.email}</p>
            {localStorage.getItem('fina:migrate') === '1' && (
              <Button
                variant="soft"
                onClick={async () => {
                  const n = await uploadLocalData();
                  localStorage.removeItem('fina:migrate');
                  toast(`☁️ ${n} registros subidos a tu cuenta`, 'success');
                }}
              >
                Subir los datos de este dispositivo a mi cuenta
              </Button>
            )}
          </>
        )}
        <Button variant="secondary" onClick={() => void session.signOut()}>
          <LogOut className="h-4 w-4" /> {session.mode === 'local' ? 'Salir del modo sin cuenta' : 'Cerrar sesión'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Perfil</CardTitle>
        <Input label="Nombre" value={profile?.name ?? ''} onChange={(e) => void updateProfile({ name: e.target.value })} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">¿Cuándo te pagan?</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['Quincena (15 y 30)', { type: 'biweekly', days: [15, 30] }],
                ['Mensual', { type: 'monthly', days: [30] }],
                ['Semanal (viernes)', { type: 'weekly', days: [5] }],
                ['Variable', { type: 'irregular', days: [] }],
              ] as Array<[string, Profile['payday']]>
            ).map(([label, p]) => (
              <Chip key={label} active={profile?.payday?.type === p.type} onClick={() => void updateProfile({ payday: p })}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <MoneyInput label="Ingreso mensual aproximado" value={profile?.monthlyIncomeCents ?? 0} onChange={(v) => void updateProfile({ monthlyIncomeCents: v || undefined })} hint="Para 50/30/20, salud financiera y tope de deducciones." />
      </Card>

      <Card id="nivel" className="space-y-3">
        <CardTitle>Nivel</CardTitle>
        <p className="text-sm text-muted">Solo muestra u oculta funciones. Tus datos no cambian.</p>
        {(['basic', 'organized', 'expert'] as Level[]).map((l) => (
          <button key={l} type="button" onClick={() => void updateProfile({ level: l })} className={cx('w-full rounded-2xl border-2 p-3 text-left transition', level === l ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40' : 'border-line hover:border-accent-300')}>
            <p className="font-semibold text-ink">
              {LEVEL_INFO[l].emoji} {LEVEL_INFO[l].label} <span className="font-normal text-muted">· “{LEVEL_INFO[l].tagline}”</span>
            </p>
            <p className="text-sm text-muted">{LEVEL_INFO[l].description}</p>
          </button>
        ))}
      </Card>

      <Card className="space-y-4">
        <CardTitle>Apariencia</CardTitle>
        <Segmented value={settings.theme} onChange={(v) => void updateSettings({ theme: v })} options={[{ value: 'system', label: 'Automático' }, { value: 'light', label: '☀️ Claro' }, { value: 'dark', label: '🌙 Oscuro' }]} />
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Color</p>
          <div className="flex gap-3">
            {(Object.keys(ACCENT_PALETTES) as AccentName[]).map((a) => (
              <button key={a} type="button" onClick={() => void updateSettings({ accent: a })} aria-label={ACCENT_PALETTES[a].label} aria-pressed={settings.accent === a} className="flex flex-col items-center gap-1 text-xs text-muted">
                <span className={cx('h-10 w-10 rounded-full ring-offset-2 ring-offset-surface', settings.accent === a && 'ring-2 ring-ink')} style={{ background: ACCENT_PALETTES[a].shades['600'] }} />
                {ACCENT_PALETTES[a].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Tamaño de letra</p>
          <Segmented value={settings.fontScale} onChange={(v) => void updateSettings({ fontScale: v })} options={[{ value: 'sm', label: 'A' }, { value: 'md', label: 'A+' }, { value: 'lg', label: 'A++' }, { value: 'xl', label: 'A+++' }]} />
        </div>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Notificaciones</CardTitle>
        {push !== 'granted' ? (
          <Button
            variant="soft"
            onClick={async () => {
              const r = await enablePush();
              setPush(pushStatus());
              toast({ granted: '🔔 Notificaciones activadas', denied: 'Las bloqueaste. Actívalas en los ajustes del navegador.', unsupported: 'Este navegador no soporta notificaciones. En iPhone, primero instala la app.', 'needs-setup': 'Permiso dado. Los avisos con la app cerrada se activan cuando el servidor esté configurado.', error: 'No se pudo activar.' }[r]);
            }}
          >
            🔔 Activar notificaciones
          </Button>
        ) : (
          <p className="text-sm text-income">🔔 Notificaciones activadas en este dispositivo.</p>
        )}
        <Toggle label="Pagos de tarjeta" description={`Aviso ${settings.notifications.cardDueDaysBefore} días antes de la fecha límite`} checked={settings.notifications.cardDue} onChange={(v) => void updateSettings({ notifications: { ...settings.notifications, cardDue: v } })} />
        <Toggle label="Recurrentes" description="Renta, servicios y suscripciones" checked={settings.notifications.recurring} onChange={(v) => void updateSettings({ notifications: { ...settings.notifications, recurring: v } })} />
        <Toggle label="Presupuesto" description="Al llegar al 80 % y al 100 %" checked={settings.notifications.budgetAlerts} onChange={(v) => void updateSettings({ notifications: { ...settings.notifications, budgetAlerts: v } })} />
        <Toggle label="Resumen semanal" description="Domingo en la tarde" checked={settings.notifications.weeklySummary} onChange={(v) => void updateSettings({ notifications: { ...settings.notifications, weeklySummary: v } })} />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Input label="Silencio desde" type="time" value={settings.quietHours.from} onChange={(e) => void updateSettings({ quietHours: { ...settings.quietHours, from: e.target.value } })} />
          <Input label="hasta" type="time" value={settings.quietHours.to} onChange={(e) => void updateSettings({ quietHours: { ...settings.quietHours, to: e.target.value } })} />
        </div>
      </Card>

      <Card className="space-y-2">
        <CardTitle>Seguridad y privacidad</CardTitle>
        <Toggle label="Modo discreto" description="Oculta los montos (útil en público). También con el ojito de Inicio." checked={settings.privacyMode} onChange={(v) => void updateSettings({ privacyMode: v })} />
        <Toggle
          label="Bloqueo con PIN"
          description="Pide un PIN al abrir la app."
          checked={settings.pinEnabled}
          onChange={(v) => {
            if (v) setPinOpen(true);
            else {
              clearPin();
              void updateSettings({ pinEnabled: false });
            }
          }}
        />
        {settings.pinEnabled && biometricAvailable() && !hasBiometric() && (
          <Button variant="soft" size="sm" onClick={() => void enrollBiometric().then((ok) => toast(ok ? 'Huella / Face ID activado' : 'No se pudo activar'))}>
            Usar huella o Face ID
          </Button>
        )}
        <p className="pt-1 text-xs text-muted">🔒 Nunca pedimos ni guardamos contraseñas de tu banco.</p>
      </Card>

      {emailAddress && (
        <Card className="space-y-2">
          <CardTitle>Correos del banco (registro automático)</CardTitle>
          <p className="text-sm text-muted">Reenvía a esta dirección los correos de “compra aprobada” de tu banco y se registran solos:</p>
          <button type="button" className="w-full rounded-xl bg-surface-2 p-3 font-mono text-sm text-ink" onClick={() => void navigator.clipboard.writeText(emailAddress).then(() => toast('Dirección copiada'))}>
            {emailAddress}
          </button>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>En Gmail (computadora) → ⚙️ → Ver toda la configuración → Reenvío → “Agregar una dirección” y pega la de arriba.</li>
            <li>Busca un correo de tu banco → ⋮ → “Filtrar mensajes similares” → Crear filtro → “Reenviar a” esa dirección.</li>
            <li>Listo: cada compra te llegará como notificación para confirmar la categoría.</li>
          </ol>
        </Card>
      )}

      <Card className="space-y-2">
        <CardTitle>Tus datos</CardTitle>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportTransactionsCsv(txs)}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportTransactionsXlsx(txs)}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={exportAllJson}>
            <Download className="h-4 w-4" /> Todo (JSON)
          </Button>
        </div>
        {hasDemoData() ? (
          <Button variant="secondary" onClick={() => void clearDemoData()}>
            🧹 Borrar datos de ejemplo
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void loadDemoData()}>
            🧪 Cargar datos de ejemplo (3 meses)
          </Button>
        )}
        <Link to="/categorias" className="block rounded-xl px-1 py-2 text-sm font-medium text-accent-600">
          Editar categorías →
        </Link>
        <Button variant="ghost" className="text-rose-600" onClick={() => void deleteEverything()}>
          <Trash2 className="h-4 w-4" /> Borrar mi cuenta y todos mis datos
        </Button>
      </Card>

      <Card className="space-y-1 text-sm text-muted">
        <p>
          Fina v{config.version} · {config.buildDate}
        </p>
        <p>
          <Link className="underline" to="/privacidad">
            Aviso de privacidad
          </Link>{' '}
          ·{' '}
          <Link className="underline" to="/terminos">
            Términos
          </Link>{' '}
          ·{' '}
          <Link className="underline" to="/instalar">
            Instalar la app
          </Link>
        </p>
      </Card>

      <Sheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        title="Crea tu PIN"
        footer={
          <Button
            block
            disabled={!/^\d{4,6}$/.test(pin)}
            onClick={async () => {
              await setPin(pin);
              await updateSettings({ pinEnabled: true });
              setPinValue('');
              setPinOpen(false);
              toast('🔒 PIN activado');
            }}
          >
            Guardar PIN
          </Button>
        }
      >
        <Input label="PIN de 4 a 6 dígitos" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} hint="Se guarda cifrado solo en este dispositivo." />
      </Sheet>
    </div>
  );
}
