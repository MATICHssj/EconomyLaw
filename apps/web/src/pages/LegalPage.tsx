import { APP_NAME } from '@fina/core';
import { Card, PageHeader, Tip } from '@/components/ui';

const PRIVACY: Array<[string, string]> = [
  ['Responsable', `${APP_NAME} es un proyecto independiente. El responsable del tratamiento de tus datos personales es el titular del proyecto (datos de contacto en la app y en el repositorio público).`],
  ['Qué datos recabamos', 'Nombre, correo electrónico (si creas cuenta), los movimientos, cuentas, presupuestos y metas que tú capturas, y —solo si lo activas— tu número de WhatsApp (guardado como hash irreversible), las notificaciones o correos de tu banco que tú reenvías y tokens de notificaciones push.'],
  ['Qué NO recabamos', 'Nunca pedimos, guardamos ni transmitimos contraseñas, NIP, claves de banca en línea ni números completos de tarjeta.'],
  ['Para qué los usamos', 'Exclusivamente para darte el servicio: registrar y analizar tus finanzas, enviarte recordatorios y responder tus mensajes. No vendemos ni compartimos tus datos con terceros para publicidad.'],
  ['Dónde se guardan', 'En tu dispositivo y, si creas cuenta, en Google Firebase (Firestore). El procesamiento de WhatsApp, correos y recordatorios ocurre en Cloudflare Workers. El texto original de mensajes y correos se borra a los 30 días; solo queda el movimiento.'],
  ['Inteligencia artificial', 'Si está activada, las notas de voz, fotos de tickets y frases ambiguas se procesan con modelos de IA de Cloudflare Workers AI solo para extraer el movimiento. No se usan para entrenar modelos.'],
  ['Tus derechos (ARCO)', 'Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos. Desde Ajustes puedes exportar todos tus datos (JSON/CSV/Excel) y borrar tu cuenta con todo su contenido en cualquier momento.'],
  ['Cambios', 'Si este aviso cambia, te lo informaremos dentro de la app.'],
];

const TERMS: Array<[string, string]> = [
  ['El servicio', `${APP_NAME} es una herramienta para organizar tus finanzas personales. Es gratuita y se ofrece “tal cual”.`],
  ['No es asesoría', 'La información, cálculos, proyecciones y lecciones son educativos y aproximados. No constituyen asesoría financiera, fiscal ni legal. Para decisiones importantes consulta a un profesional.'],
  ['Tu responsabilidad', 'Eres responsable de la información que capturas y de mantener seguro tu dispositivo y tu cuenta. Si compartes un hogar, los integrantes verán lo que registres en el espacio compartido.'],
  ['Disponibilidad', 'Hacemos lo posible por que el servicio funcione siempre, pero puede haber interrupciones. La app funciona sin internet y guarda una copia en tu dispositivo.'],
  ['Uso aceptable', 'No uses la app para actividades ilícitas ni intentes vulnerar su seguridad.'],
  ['Terminación', 'Puedes dejar de usar la app y borrar tu cuenta cuando quieras desde Ajustes.'],
];

export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const items = doc === 'privacy' ? PRIVACY : TERMS;
  return (
    <div className="space-y-4">
      <PageHeader title={doc === 'privacy' ? 'Aviso de privacidad' : 'Términos y condiciones'} back />
      <Tip emoji="⚖️">Borrador en lenguaje claro. Pendiente de revisar con un abogado antes de un lanzamiento público.</Tip>
      <Card className="space-y-4">
        {items.map(([title, text]) => (
          <section key={title}>
            <h2 className="font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
          </section>
        ))}
      </Card>
    </div>
  );
}
