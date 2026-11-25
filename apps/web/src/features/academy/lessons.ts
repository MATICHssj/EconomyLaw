import type { Level } from '@fina/core';

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  minutes: number;
  track: 'app' | 'money';
  level: Level;
  body: string[];
  tryIt?: { label: string; to: string };
  quiz?: { q: string; options: string[]; answer: number; why: string };
}

/**
 * Lecciones de 2 minutos: cómo usar la app y educación financiera práctica
 * para México. Texto plano; **negritas** se muestran resaltadas.
 */
export const LESSONS: Lesson[] = [
  {
    id: 'captura',
    emoji: '✍️',
    title: 'Anota en 3 segundos',
    minutes: 2,
    track: 'app',
    level: 'basic',
    body: [
      'La regla es simple: **qué + cuánto**. Escribe “galleta 30”, “uber 85” o “súper 1,250.50”. Yo adivino la categoría, la cuenta y la fecha.',
      'Puedes agregar detalles en cualquier orden: la fecha (“ayer tacos 120”, “el lunes gasolina 500”), la cuenta (“con nu”, “en efectivo”), una etiqueta (“#viaje”) o dólares (“hotel 200 dls”).',
      'También entiendo cosas más avanzadas: **“cena 900 entre 3”** (solo cuenta tu parte), **“tv 12000 a 12 msi con nu”** (crea las 12 mensualidades), **“netflix 299 cada mes”** (lo vuelve recurrente) y **“le presté 200 a Juan”** (y luego “Juan me pagó 200”).',
      'Varios de una vez: “tacos 120, refresco 25, uber 60”. Si me equivoco de categoría, corrígela una vez y aprendo para siempre.',
    ],
    tryIt: { label: 'Anotar algo ahora', to: '/?capture=1' },
    quiz: {
      q: '¿Qué escribirías para una pizza de $350 que dividiste entre 2?',
      options: ['pizza 350', 'pizza 350 entre 2', 'pizza 175 x 2'],
      answer: 1,
      why: 'Con “entre 2” guardo el total y cuento como gasto solo tu parte ($175). El resto queda “por cobrar”.',
    },
  },
  {
    id: 'hormiga',
    emoji: '🐜',
    title: 'Gastos hormiga: lo pequeño también suma',
    minutes: 2,
    track: 'money',
    level: 'basic',
    body: [
      'Son compras pequeñas y frecuentes: el café, el refresco, los chicles, el pan, el antojo de la tiendita, la comisión del cajero. Cada una es poca cosa, pero juntas suman bastante.',
      'Ejemplo real: un café de $55 cinco días a la semana son **$1,100 al mes y más de $13,000 al año**. Eso es un viaje.',
      'No se trata de dejarlos todos, sino de **verlos**. En Inicio te muestro tus gastos hormiga del mes y a cuántos cafés equivalen.',
      'Tres trucos: 1) ponles un presupuesto (p. ej. $600 al mes en “Tiendita y antojos”); 2) lleva agua y botana de casa; 3) celebra tus rachas de días sin gastos hormiga.',
    ],
    tryIt: { label: 'Ver mi Inicio', to: '/' },
    quiz: {
      q: '$40 diarios en antojos, ¿cuánto es al año?',
      options: ['≈ $4,800', '≈ $14,600', '≈ $1,200'],
      answer: 1,
      why: '$40 × 365 = $14,600. ¡Los gastos chicos suman mucho!',
    },
  },
  {
    id: '503020',
    emoji: '🥧',
    title: 'La regla 50/30/20',
    minutes: 2,
    track: 'money',
    level: 'organized',
    body: [
      'Es la forma más sencilla de presupuestar: divide tu ingreso en tres partes.',
      '**50 % necesidades**: renta, súper, servicios, transporte, deudas mínimas. **30 % gustos**: salidas, ropa, streaming, antojos. **20 % ahorro**: fondo de emergencia, metas, inversiones o pagar deudas antes.',
      'Si ganas $20,000 al mes: $10,000 para necesidades, $6,000 para gustos y $4,000 para ahorrar.',
      'Si tus necesidades pasan del 50 % (pasa mucho con la renta en ciudades grandes), no te frustres: ajusta a 60/20/20 y ve mejorando. En Presupuesto → 50/30/20 te muestro cómo vas.',
    ],
    tryIt: { label: 'Ver mi 50/30/20', to: '/presupuesto' },
    quiz: {
      q: 'Con un ingreso de $16,000, ¿cuánto deberías ahorrar según 50/30/20?',
      options: ['$1,600', '$3,200', '$8,000'],
      answer: 1,
      why: 'El 20 % de $16,000 es $3,200.',
    },
  },
  {
    id: 'emergencia',
    emoji: '🛟',
    title: 'Fondo de emergencia',
    minutes: 2,
    track: 'money',
    level: 'basic',
    body: [
      'Es dinero apartado **solo** para imprevistos: una enfermedad, quedarte sin trabajo, una reparación del coche. Sin él, cualquier susto termina en la tarjeta de crédito.',
      '¿Cuánto? Empieza con un mes de tus gastos básicos y crece a **3 o 6 meses**. Si eres freelance o tus ingresos varían, apunta a 6.',
      '¿Dónde? En un lugar seguro, con rendimiento y que puedas sacar rápido: una cuenta de ahorro con rendimiento diario o CETES de corto plazo. No en efectivo debajo del colchón ni en inversiones de riesgo.',
      'En Metas crea tu “Fondo de emergencia”: calculo cuánto necesitas con tus gastos reales y cuánto apartar por quincena.',
    ],
    tryIt: { label: 'Crear mi fondo', to: '/metas' },
  },
  {
    id: 'tarjetas',
    emoji: '💳',
    title: 'Tarjeta de crédito sin intereses',
    minutes: 3,
    track: 'money',
    level: 'organized',
    body: [
      '**Fecha de corte**: el día que el banco cierra tu periodo y suma lo que compraste. **Fecha límite de pago**: unos 20 días después; hasta ese día puedes pagar sin intereses.',
      'El número mágico es el **“pago para no generar intereses”**. Si pagas eso completo cada mes, la tarjeta te sale gratis (y hasta te da puntos o meses sin intereses).',
      'El **pago mínimo sale caro**: con tasas de 40 a 80 % anual, pagar solo el mínimo hace que una deuda de $10,000 tarde años en liquidarse y cueste el doble.',
      'Truco: compra justo después de tu fecha de corte y tendrás hasta ~50 días para pagar. Configura tu tarjeta en Fina y te aviso antes de la fecha límite.',
      'Usa menos del 30 % de tu línea de crédito: mejora tu historial en Buró de Crédito.',
    ],
    tryIt: { label: 'Configurar mi tarjeta', to: '/tarjetas' },
    quiz: {
      q: 'Para no pagar intereses debes cubrir…',
      options: [
        'El pago mínimo',
        'El pago para no generar intereses',
        'Lo que quieras antes del corte',
      ],
      answer: 1,
      why: 'El pago mínimo evita la mora, pero genera intereses sobre el resto.',
    },
  },
  {
    id: 'msi',
    emoji: '🗓️',
    title: 'Meses sin intereses: cuándo sí y cuándo no',
    minutes: 2,
    track: 'money',
    level: 'organized',
    body: [
      'Los MSI son buenos para compras **planeadas y necesarias** (un refri, una laptop para trabajar) porque reparten el pago sin costo extra.',
      'Algo a cuidar: se acumulan. Tres compras “pequeñas” a MSI pueden sumar **$3,000 de tu sueldo cada mes durante un año**.',
      'Reglas de oro: 1) nunca compres a MSI algo que no comprarías de contado; 2) que la suma de tus MSI no pase del 10–15 % de tu ingreso; 3) si no pagas el total de tu tarjeta, los MSI pierden su ventaja.',
      'En Tarjetas y MSI te muestro cuánto llevas comprometido cada mes de aquí en adelante.',
    ],
    tryIt: { label: 'Ver mis MSI', to: '/tarjetas' },
  },
  {
    id: 'deudas',
    emoji: '⛓️',
    title: 'Bola de nieve vs. avalancha',
    minutes: 3,
    track: 'money',
    level: 'expert',
    body: [
      'Dos estrategias para salir de varias deudas. En ambas pagas el **mínimo de todas** y todo el dinero extra va a una sola.',
      '**Bola de nieve**: primero la deuda más chica. Liquidarla rápido da motivación y libera su pago mínimo para la siguiente.',
      '**Avalancha**: primero la de mayor tasa de interés. Matemáticamente pagas menos intereses en total.',
      '¿Cuál elegir? Si te cuesta mantener la disciplina, bola de nieve. Si eres constante, avalancha. En Deudas comparo ambas con tus números y te digo en qué fecha terminas de pagar.',
    ],
    tryIt: { label: 'Simular mis deudas', to: '/deudas' },
  },
  {
    id: 'cetes',
    emoji: '🇲🇽',
    title: 'CETES para principiantes',
    minutes: 2,
    track: 'money',
    level: 'organized',
    body: [
      'Los CETES son instrumentos de deuda del Gobierno de México: le prestas dinero y te lo regresa con intereses. Es de lo más seguro que hay en pesos.',
      'Se compran en **cetesdirecto.com** desde $100, sin comisiones. Hay plazos de 28, 91, 182 y 364 días; mientras más largo, normalmente mejor tasa.',
      'Activa la reinversión automática y haz aportaciones cada quincena. Son ideales para tu fondo de emergencia y metas de corto plazo.',
      'Registra tus CETES en Fina (“cetes 5000”) para ver tu patrimonio completo.',
    ],
    tryIt: { label: 'Registrar inversión', to: '/inversiones' },
  },
  {
    id: 'afore',
    emoji: '👵',
    title: 'Tu Afore y tu retiro',
    minutes: 2,
    track: 'money',
    level: 'expert',
    body: [
      'Si tienes o tuviste trabajo formal, tienes una Afore donde se acumula tu ahorro para el retiro. Revisa en cuál estás y cuánto tienes en **AforeMóvil**.',
      'Las **aportaciones voluntarias** se pueden hacer desde $50 en tiendas o en la app, y algunas son **deducibles de impuestos**.',
      'Compara rendimientos netos entre Afores (la CONSAR los publica) y cámbiate si la tuya está entre las últimas.',
      'Pon el saldo de tu Afore en Inversiones para ver tu patrimonio real.',
    ],
  },
  {
    id: 'tandas',
    emoji: '🫙',
    title: 'Tandas: pros y riesgos',
    minutes: 2,
    track: 'money',
    level: 'organized',
    body: [
      'En una tanda, cada participante aporta lo mismo cada periodo y en cada ronda uno se lleva todo. Es ahorro forzoso y sin intereses.',
      'Si te toca de los **primeros números**, en la práctica es un préstamo sin intereses; si te toca **al final**, es un ahorro que no genera rendimiento.',
      'El riesgo: depende de la confianza. Si alguien deja de pagar después de cobrar, se pierde dinero. Participa solo con gente conocida y con reglas claras.',
      'En Tandas te digo cuándo pagas y cuándo cobras.',
    ],
    tryIt: { label: 'Registrar una tanda', to: '/tandas' },
  },
  {
    id: 'basecero',
    emoji: '🎯',
    title: 'Presupuesto base cero (sobres)',
    minutes: 2,
    track: 'money',
    level: 'expert',
    body: [
      'La idea: **dale un trabajo a cada peso** antes de gastarlo. Ingreso − todo lo asignado = $0.',
      'Es como el método de sobres de las abuelas: un sobre para renta, otro para súper, otro para salidas… Si un sobre se acaba, mueves dinero de otro, de forma consciente.',
      'Con “pasar sobrante”, lo que no gastes se acumula para el siguiente mes (ideal para gastos anuales como el seguro o los regalos de diciembre).',
    ],
    tryIt: { label: 'Probar base cero', to: '/presupuesto' },
  },
  {
    id: 'sat',
    emoji: '🧾',
    title: 'Deducciones personales (SAT)',
    minutes: 3,
    track: 'money',
    level: 'expert',
    body: [
      'Si presentas declaración anual (abril), algunos gastos te pueden regresar dinero: **médicos, dentistas, psicólogos, hospitales, lentes, seguros de gastos médicos, colegiaturas, intereses hipotecarios, donativos y aportaciones voluntarias al retiro**.',
      'Requisitos clave: factura (CFDI) a tu nombre con el **uso de CFDI correcto** (D01 para médicos, D10 para colegiaturas…) y pagada con **tarjeta o transferencia**, no en efectivo.',
      'Hay un tope general: el menor entre 15 % de tus ingresos anuales o 5 UMA anuales (colegiaturas y aportaciones al retiro tienen sus propios topes).',
      'Sube tus XML en SAT y deducibles: los clasifico solo y te muestro el total del año. Esto es una guía; confirma con tu contador.',
    ],
    tryIt: { label: 'Subir mis facturas', to: '/sat' },
  },
  {
    id: 'pareja',
    emoji: '💑',
    title: 'Dinero en pareja',
    minutes: 2,
    track: 'app',
    level: 'basic',
    body: [
      'Para llevar el dinero en pareja lo que más ayuda es la **transparencia y tener reglas claras**.',
      'Un modelo que funciona: cada quien conserva su cuenta personal y juntos tienen un fondo común para lo compartido (renta, súper, servicios, metas).',
      '¿50/50 o proporcional? Si ganan distinto, repartir según el ingreso (p. ej. 60/40) suele ser más justo.',
      'En Fina creen un **hogar**: lo compartido se ve en un solo lugar y “Cuentas claras” les dice quién ha pagado más y cuánto transferir para quedar a mano. Lo personal sigue siendo privado.',
    ],
    tryIt: { label: 'Crear nuestro hogar', to: '/hogar' },
  },
  {
    id: 'importar',
    emoji: '📥',
    title: 'Trae tus movimientos del banco',
    minutes: 2,
    track: 'app',
    level: 'organized',
    body: [
      'Fina **nunca te pide la contraseña de tu banco**. Hay tres formas seguras de traer tus movimientos:',
      '1) **Importar** el estado de cuenta en CSV, Excel u OFX (no se duplican los que ya anotaste). 2) **Reenviar** a Fina los correos de “compra aprobada” de tu banco con un filtro de Gmail. 3) En Android, permitir que Fina lea **solo** las notificaciones de las apps de tu banco.',
      'Combínalas con la captura manual o por WhatsApp para el efectivo.',
    ],
    tryIt: { label: 'Importar un archivo', to: '/importar' },
  },
  {
    id: 'buro',
    emoji: '📊',
    title: 'Cómo funciona el Buró de Crédito',
    minutes: 2,
    track: 'money',
    level: 'organized',
    body: [
      'El Buró de Crédito es tu historial de créditos. Lo que importa es **cómo** pagas.',
      'Para un buen score: paga a tiempo (aunque sea el mínimo, pero mejor el total), usa menos del 30 % de tu línea, no abras muchos créditos a la vez y conserva tus tarjetas más antiguas.',
      'Puedes pedir tu reporte gratis una vez al año en burodecredito.com.mx.',
    ],
  },
  {
    id: 'viajes',
    emoji: 'i:luggage',
    title: 'Viajar sin endeudarte',
    minutes: 2,
    track: 'money',
    level: 'basic',
    body: [
      'Un viaje cuesta más que el vuelo y el hotel: suma **comida, transporte allá, actividades, recuerdos e imprevistos**. En Viajes armas el presupuesto por rubro (o le das a “Estimar”).',
      'Decide **cómo lo vas a pagar** antes de reservar: ahorrando por quincena, con tarjeta a meses sin intereses o parte y parte. Fina te dice cuánto apartar o en qué mes terminas de pagarlo.',
      'Regla de oro: lo que no tenga **meses sin intereses**, págalo de contado o completo en tu fecha límite. Pagar un viaje a crédito con intereses puede salir 30–50 % más caro.',
      'Durante el viaje, lo que anotes se guarda solo en ese viaje y ves cuánto puedes gastar por día sin pasarte.',
    ],
    tryIt: { label: 'Planear un viaje', to: '/viajes' },
    quiz: {
      q: 'Un viaje de $12,000 a 6 MSI, ¿cuánto pagas al mes?',
      options: ['$1,200', '$2,000', '$2,400'],
      answer: 1,
      why: '$12,000 ÷ 6 = $2,000 al mes, sin intereses (si pagas completo tu tarjeta cada mes).',
    },
  },
  {
    id: 'aguinaldo',
    emoji: '🎄',
    title: 'Cómo repartir tu aguinaldo',
    minutes: 2,
    track: 'money',
    level: 'basic',
    body: [
      'El aguinaldo (mínimo 15 días de salario, antes del 20 de diciembre) es la mejor oportunidad del año para avanzar.',
      'Una fórmula sencilla: **40 % deudas** (empieza por las de interés más alto), **30 % ahorro** (fondo de emergencia o CETES), **30 % disfrutar** (regalos, posada, algún gusto).',
      'Antes de enero, separa lo de los gastos de inicio de año (cuesta de enero): predial, tenencia, inscripciones.',
    ],
  },
];

export function completedLessons(): Set<string> {
  try {
    return new Set((localStorage.getItem('fina:lessons') ?? '').split(',').filter(Boolean));
  } catch {
    return new Set();
  }
}

export function completeLesson(id: string) {
  try {
    const s = completedLessons();
    s.add(id);
    localStorage.setItem('fina:lessons', [...s].join(','));
  } catch {
    /* sin almacenamiento */
  }
}
