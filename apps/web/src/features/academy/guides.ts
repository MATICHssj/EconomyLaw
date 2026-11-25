import type { Level } from '@fina/core';
import type { Lesson } from './lessons';

/**
 * Guías de "Cómo usar Fina": cortas, con pasos y un botón que te lleva a la
 * pantalla. Se agrupan en rutas según qué tanto sabes de finanzas.
 */
export const GUIDES: Lesson[] = [
  {
    id: 'primeros-pasos',
    emoji: 'i:sprout',
    title: 'Tu primer minuto con Fina',
    minutes: 1,
    track: 'app',
    level: 'basic',
    body: [
      'En **Inicio** ves lo más importante: cuánto llevas gastado este mes, **cuánto puedes gastar al día** hasta tu próximo pago y lo que tienes que pagar pronto.',
      'Abajo está la barra: **Inicio**, **Movimientos** (todo lo que has anotado), el botón **+** para anotar, **Presupuesto** y **Más** (ahí está todo lo demás).',
      'No necesitas configurar nada para empezar: anota tus gastos y Fina hace las cuentas por ti.',
    ],
    steps: [
      { text: 'Mira cuánto puedes gastar hoy', to: '/' },
      { text: 'Toca + y anota tu primer gasto', to: '/?capture=1' },
      { text: 'Revisa tus movimientos', to: '/movimientos' },
    ],
    tryIt: { label: 'Ir a Inicio', to: '/' },
  },
  {
    id: 'ver-gastos',
    emoji: 'i:chartPie',
    title: 'Ve en qué se te va el dinero',
    minutes: 2,
    track: 'app',
    level: 'basic',
    body: [
      'En **Inicio**, en “¿En qué se te va?”, **toca una categoría** y verás todos esos gastos del mes con el total y el promedio.',
      'En **Movimientos** toca el embudo para filtrar: elige **“Toda la comida”** (súper, restaurantes, café, antojos y a domicilio) y un periodo: este mes, el pasado, este año o todo.',
      'También puedes buscar por palabra: “oxxo”, “uber” o una etiqueta como “#viaje”.',
    ],
    steps: [
      { text: 'Toca una categoría en Inicio', to: '/' },
      { text: 'Ve toda tu comida del mes', to: '/movimientos?cat=fam:food' },
      { text: 'Compara meses en Reportes', to: '/reportes' },
    ],
    tryIt: { label: 'Ver mi comida del mes', to: '/movimientos?cat=fam:food' },
  },
  {
    id: 'corregir',
    emoji: 'i:settings',
    title: 'Corrige, borra o deshaz',
    minutes: 1,
    track: 'app',
    level: 'basic',
    body: [
      '¿Te equivocaste? **Toca el movimiento** para cambiar el monto, la categoría, la cuenta o la fecha.',
      'En el celular puedes **deslizarlo a la izquierda** para editar o borrar. Y cada vez que guardas, aparece **“Deshacer”** por unos segundos.',
      'Si cambias la categoría, **Fina aprende**: la próxima vez lo pone bien sola.',
    ],
    steps: [{ text: 'Abre tus movimientos y toca uno', to: '/movimientos' }],
    tryIt: { label: 'Ir a Movimientos', to: '/movimientos' },
  },
  {
    id: 'preguntale',
    emoji: 'i:sparkles',
    title: 'Pregúntale a Fina',
    minutes: 1,
    track: 'app',
    level: 'basic',
    body: [
      'Escríbele como a una amiga: **“¿cuánto gasté en comida este mes?”**, “¿me alcanza para unos tenis de 1,800?”, “¿en qué se me va el dinero?” o “¿quién me debe?”.',
      'Responde con tus números reales, sin inventar. También funciona por WhatsApp.',
    ],
    steps: [{ text: 'Hazle tu primera pregunta', to: '/asistente' }],
    tryIt: { label: 'Preguntarle algo', to: '/asistente' },
  },
  {
    id: 'whatsapp-guia',
    emoji: 'i:chat',
    title: 'Anota por WhatsApp',
    minutes: 2,
    track: 'app',
    level: 'basic',
    body: [
      'Vincula tu número en **Más → WhatsApp** y desde ahí anota como si le escribieras a alguien: “uber 85”, “súper 1250 con bbva”.',
      'Puedes mandar **nota de voz** o **foto del ticket**. Escribe “deshacer” si te equivocas, “hoy” o “mes” para ver cuánto llevas.',
    ],
    steps: [{ text: 'Vincular mi WhatsApp', to: '/whatsapp' }],
    tryIt: { label: 'Vincular WhatsApp', to: '/whatsapp' },
  },
  {
    id: 'proteger',
    emoji: 'i:check',
    title: 'Protege y respalda tus datos',
    minutes: 2,
    track: 'app',
    level: 'basic',
    body: [
      'En **Ajustes → Seguridad** pon un **PIN o tu huella** para abrir Fina.',
      'El **ojito** de Inicio oculta los montos (modo discreto), útil si alguien ve tu pantalla.',
      'Si **creas tu cuenta**, todo se respalda en la nube y lo ves en otro teléfono. Sin cuenta, todo vive en tu teléfono: descarga un respaldo de vez en cuando en Ajustes.',
    ],
    steps: [{ text: 'Activar PIN o huella', to: '/ajustes' }],
    tryIt: { label: 'Ir a Ajustes', to: '/ajustes' },
  },
  {
    id: 'cuentas-guia',
    emoji: 'i:card',
    title: 'Agrega tus cuentas y tarjetas',
    minutes: 2,
    track: 'app',
    level: 'organized',
    body: [
      'En **Más → Cuentas → Nueva** agrega efectivo, débito, Mercado Pago… con lo que tienes hoy.',
      'En tus **tarjetas de crédito** pon el límite, el **día de corte** y el **día límite de pago**: te avisamos antes y te decimos cuánto pagar para no generar intereses.',
      'En Android puedes **acercar la tarjeta** al teléfono para llenar marca, últimos 4 dígitos y vencimiento.',
    ],
    steps: [
      { text: 'Agregar una cuenta', to: '/cuentas' },
      { text: 'Configurar mi tarjeta de crédito', to: '/tarjetas' },
    ],
    tryIt: { label: 'Ir a Cuentas', to: '/cuentas' },
  },
  {
    id: 'presupuesto-guia',
    emoji: 'i:piggy',
    title: 'Tu presupuesto en 2 minutos',
    minutes: 2,
    track: 'app',
    level: 'organized',
    body: [
      'En **Presupuesto** ponle un tope a **3 categorías** donde más gastas (por ejemplo comida, salidas y transporte). No hace falta hacerlo con todo.',
      'Te aviso cuando llegues al **80 %**. Si prefieres algo automático, elige **50/30/20** y yo reparto tu ingreso.',
    ],
    steps: [{ text: 'Crear mi presupuesto', to: '/presupuesto' }],
    tryIt: { label: 'Ir a Presupuesto', to: '/presupuesto' },
  },
  {
    id: 'pagos-guia',
    emoji: 'i:calendarClock',
    title: 'Que no se te pase ningún pago',
    minutes: 2,
    track: 'app',
    level: 'organized',
    body: [
      'En **Más → Pagos pendientes** ves lo vencido, lo de esta semana y lo del mes: tarjetas, renta, servicios, MSI y tandas.',
      'Agrega **recordatorios** de cosas de una sola vez (predial, tenencia, inscripción) o que se repiten, y elige cuántos días antes te aviso.',
      'Cuando pagues, toca **“Ya lo pagué”** y se anota solo.',
    ],
    steps: [{ text: 'Agregar un recordatorio', to: '/pagos' }],
    tryIt: { label: 'Ver mis pagos', to: '/pagos' },
  },
  {
    id: 'automatico',
    emoji: 'i:repeat',
    title: 'Que tus gastos se anoten solos',
    minutes: 2,
    track: 'app',
    level: 'organized',
    body: [
      '**Android:** en Ajustes activa “Notificaciones del banco” y elige tus bancos. Cada compra con tarjeta se anota sola (solo leo los avisos de esos bancos).',
      '**Estado de cuenta:** súbelo en Más → Importar (CSV, Excel u OFX). No se duplica lo que ya anotaste.',
      'Revisa de vez en cuando los movimientos **“Por revisar”** para confirmar su categoría.',
    ],
    steps: [
      { text: 'Activar notificaciones del banco', to: '/ajustes' },
      { text: 'Importar un estado de cuenta', to: '/importar' },
    ],
    tryIt: { label: 'Ir a Ajustes', to: '/ajustes' },
  },
  {
    id: 'metas-guia',
    emoji: 'i:target',
    title: 'Ahorra para una meta',
    minutes: 1,
    track: 'app',
    level: 'organized',
    body: [
      'En **Más → Metas** crea tu meta (empieza por un **fondo de emergencia**) y te digo cuánto apartar por quincena.',
      'Cuando ahorres, toca **“+ Aportar”** o escribe “ahorré 500 para el viaje”.',
    ],
    steps: [{ text: 'Crear una meta', to: '/metas' }],
    tryIt: { label: 'Ir a Metas', to: '/metas' },
  },
  {
    id: 'reglas-guia',
    emoji: 'i:list',
    title: 'Reglas, categorías y etiquetas',
    minutes: 2,
    track: 'app',
    level: 'expert',
    body: [
      'En **Más → Reglas automáticas** define cosas como “si dice oxxo → Tiendita” o “si es cfe → Servicios, cuenta BBVA”.',
      'Crea **categorías propias** en Más → Categorías y usa **etiquetas** (#negocio, #boda) para agrupar gastos de varias categorías.',
    ],
    steps: [
      { text: 'Crear una regla', to: '/reglas' },
      { text: 'Editar categorías', to: '/categorias' },
    ],
    tryIt: { label: 'Ir a Reglas', to: '/reglas' },
  },
  {
    id: 'patrimonio-guia',
    emoji: 'i:chartLine',
    title: 'Inversiones, patrimonio y proyección',
    minutes: 2,
    track: 'app',
    level: 'expert',
    body: [
      'Registra tus **CETES, Afore, fondos o cripto** en Más → Inversiones y actualiza su valor cuando quieras.',
      '**Patrimonio** suma lo que tienes y resta lo que debes. **Proyección** te muestra cómo se verá tu saldo en los próximos meses con tus pagos y quincenas.',
    ],
    steps: [
      { text: 'Registrar una inversión', to: '/inversiones' },
      { text: 'Ver mi patrimonio', to: '/patrimonio' },
      { text: 'Ver la proyección', to: '/proyeccion' },
    ],
    tryIt: { label: 'Ir a Inversiones', to: '/inversiones' },
  },
];

export type LearnPath = 'zero' | 'organized' | 'expert';

/** Rutas: qué guías ver y en qué orden, según qué tanto sabes. */
export const PATHS: Record<LearnPath, { label: string; tagline: string; lessons: string[] }> = {
  zero: {
    label: 'Desde cero',
    tagline: 'Nunca he llevado mis finanzas. Quiero empezar fácil.',
    lessons: [
      'primeros-pasos',
      'captura',
      'ver-gastos',
      'corregir',
      'preguntale',
      'hormiga',
      'whatsapp-guia',
      'proteger',
    ],
  },
  organized: {
    label: 'Ya me organizo',
    tagline: 'Quiero cuentas, tarjetas, presupuesto y que no se me pase nada.',
    lessons: [
      'cuentas-guia',
      'presupuesto-guia',
      'pagos-guia',
      'automatico',
      'metas-guia',
      'tarjetas',
      'viajes',
      'pareja',
    ],
  },
  expert: {
    label: 'Experto',
    tagline: 'Quiero control total y automatizar todo.',
    lessons: ['reglas-guia', 'importar', 'basecero', 'deudas', 'patrimonio-guia', 'sat'],
  },
};

export function pathForLevel(level: Level): LearnPath {
  return level === 'expert' ? 'expert' : level === 'organized' ? 'organized' : 'zero';
}

const PATH_KEY = 'fina:learn-path';

export function savedPath(level: Level): LearnPath {
  try {
    const v = localStorage.getItem(PATH_KEY);
    if (v === 'zero' || v === 'organized' || v === 'expert') return v;
  } catch {
    /* sin almacenamiento */
  }
  return pathForLevel(level);
}

export function savePath(p: LearnPath) {
  try {
    localStorage.setItem(PATH_KEY, p);
  } catch {
    /* sin almacenamiento */
  }
}
