import { toCents } from './money';

// ——————————————————— Tipo de cambio ———————————————————

/** Tipos de cambio de respaldo (MXN por unidad) si no hay internet. Se actualizan desde la API gratuita. */
export const FALLBACK_FX_RATES: Record<string, number> = {
  MXN: 1,
  USD: 18.5,
  EUR: 21.5,
  CAD: 13.3,
  GBP: 24.5,
  JPY: 0.12,
  COP: 0.0046,
  ARS: 0.018,
};

export function convertToMxn(amountCents: number, currency: string, rates: Record<string, number> = FALLBACK_FX_RATES): { amountMxnCents: number; rate: number } {
  if (currency === 'MXN') return { amountMxnCents: amountCents, rate: 1 };
  const rate = rates[currency] ?? FALLBACK_FX_RATES[currency] ?? 1;
  return { amountMxnCents: Math.round(amountCents * rate), rate };
}

// ——————————————————— CFDI (facturas del SAT) ———————————————————

export interface ParsedCfdi {
  uuid: string;
  rfcEmisor: string;
  nombreEmisor: string;
  rfcReceptor: string;
  totalCents: number;
  subtotalCents: number;
  fecha: string; // YYYY-MM-DD
  usoCfdi: string;
  formaPago?: string;
  metodoPago?: string;
  tipoComprobante?: string;
  moneda: string;
  conceptos: string[];
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) {
    const key = m[1]!.includes(':') ? m[1]!.split(':').pop()! : m[1]!;
    out[key] = decodeXml(m[2]!);
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function findTag(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w]+:)?${localName}\\b[^>]*>`, 'i');
  return xml.match(re)?.[0] ?? null;
}

/** Lee un CFDI 3.3/4.0 (XML) sin dependencias. Devuelve null si no es un CFDI válido. */
export function parseCfdiXml(xml: string): ParsedCfdi | null {
  const comp = findTag(xml, 'Comprobante');
  if (!comp) return null;
  const c = attrs(comp);
  const e = attrs(findTag(xml, 'Emisor') ?? '');
  const r = attrs(findTag(xml, 'Receptor') ?? '');
  const t = attrs(findTag(xml, 'TimbreFiscalDigital') ?? '');
  const conceptos = [...xml.matchAll(/<(?:\w+:)?Concepto\b[^>]*>/gi)].map((m) => attrs(m[0]).Descripcion ?? '').filter(Boolean);
  const total = Number(c.Total ?? c.total);
  if (!Number.isFinite(total)) return null;
  return {
    uuid: (t.UUID ?? '').toUpperCase() || `SIN-UUID-${c.Folio ?? ''}${c.Fecha ?? ''}`,
    rfcEmisor: e.Rfc ?? '',
    nombreEmisor: e.Nombre ?? e.Rfc ?? 'Emisor',
    rfcReceptor: r.Rfc ?? '',
    totalCents: toCents(total),
    subtotalCents: toCents(Number(c.SubTotal ?? total)),
    fecha: (c.Fecha ?? '').slice(0, 10),
    usoCfdi: r.UsoCFDI ?? '',
    formaPago: c.FormaPago,
    metodoPago: c.MetodoPago,
    tipoComprobante: c.TipoDeComprobante,
    moneda: c.Moneda ?? 'MXN',
    conceptos,
  };
}

/** Catálogo de Uso de CFDI (deducciones personales empiezan con D). */
export const USO_CFDI: Record<string, string> = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I02: 'Mobiliario y equipo de oficina',
  I04: 'Equipo de cómputo',
  D01: 'Honorarios médicos, dentales y hospitalarios',
  D02: 'Gastos médicos por incapacidad o discapacidad',
  D03: 'Gastos funerales',
  D04: 'Donativos',
  D05: 'Intereses reales de créditos hipotecarios',
  D06: 'Aportaciones voluntarias al SAR',
  D07: 'Primas de seguros de gastos médicos',
  D08: 'Transportación escolar obligatoria',
  D09: 'Depósitos en cuentas para el ahorro / planes de pensiones',
  D10: 'Colegiaturas (servicios educativos)',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
  CN01: 'Nómina',
};

export const FORMA_PAGO: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '99': 'Por definir',
};

export interface DeductibleCategory {
  id: string;
  name: string;
  emoji: string;
  usoCfdi: string[];
  help: string;
  /** Debe pagarse con medios electrónicos (no efectivo). */
  electronicPaymentRequired: boolean;
  /** Excluida del tope general (5 UMA / 15 %). */
  outsideGeneralLimit?: boolean;
}

export const DEDUCTIBLE_CATEGORIES: DeductibleCategory[] = [
  { id: 'medical', name: 'Médicos, dentales y hospital', emoji: '🩺', usoCfdi: ['D01', 'D02'], help: 'Consultas, dentista, psicólogo, nutriólogo, análisis, hospital y lentes ópticos (con receta).', electronicPaymentRequired: true },
  { id: 'insurance', name: 'Seguro de gastos médicos', emoji: '🛡️', usoCfdi: ['D07'], help: 'Primas de seguros de gastos médicos mayores o menores.', electronicPaymentRequired: true },
  { id: 'funeral', name: 'Gastos funerarios', emoji: '🕊️', usoCfdi: ['D03'], help: 'Hasta 1 UMA anual.', electronicPaymentRequired: true },
  { id: 'donations', name: 'Donativos', emoji: '🤝', usoCfdi: ['D04'], help: 'A donatarias autorizadas, hasta el 7 % de tus ingresos del año anterior.', electronicPaymentRequired: true },
  { id: 'mortgage', name: 'Intereses hipotecarios', emoji: '🏠', usoCfdi: ['D05'], help: 'Intereses reales de tu crédito hipotecario (constancia del banco).', electronicPaymentRequired: false },
  { id: 'retirement', name: 'Aportaciones voluntarias (Afore/PPR)', emoji: '👵', usoCfdi: ['D06', 'D09'], help: 'Hasta 10 % de tus ingresos o 5 UMA anuales.', electronicPaymentRequired: false, outsideGeneralLimit: true },
  { id: 'school_transport', name: 'Transporte escolar', emoji: '🚌', usoCfdi: ['D08'], help: 'Solo si es obligatorio en la escuela.', electronicPaymentRequired: true },
  { id: 'tuition', name: 'Colegiaturas', emoji: '🎓', usoCfdi: ['D10'], help: 'Preescolar a bachillerato, con tope por nivel.', electronicPaymentRequired: true, outsideGeneralLimit: true },
];

/**
 * Valor diario de la UMA (2025: $113.14). ⚠️ El INEGI la actualiza cada enero: revisar y ajustar aquí.
 */
export const UMA_DAILY_MXN = 113.14;

/** Tope general de deducciones personales: el menor entre 5 UMA anuales o 15 % del ingreso anual. */
export function generalDeductionLimitCents(annualIncomeCents: number, umaDaily = UMA_DAILY_MXN): number {
  const fiveUma = toCents(umaDaily * 365 * 5);
  return Math.min(fiveUma, Math.round(annualIncomeCents * 0.15));
}

export function deductibleFromUso(usoCfdi: string): DeductibleCategory | undefined {
  return DEDUCTIBLE_CATEGORIES.find((d) => d.usoCfdi.includes(usoCfdi));
}

/** ¿El CFDI sirve como deducción personal? Revisa uso y forma de pago. */
export function cfdiDeductibility(cfdi: Pick<ParsedCfdi, 'usoCfdi' | 'formaPago'>): { deductible: boolean; categoryId: string | null; reason: string } {
  const cat = deductibleFromUso(cfdi.usoCfdi);
  if (!cat) return { deductible: false, categoryId: null, reason: `Uso ${cfdi.usoCfdi || 'desconocido'}: no es deducción personal.` };
  if (cat.electronicPaymentRequired && cfdi.formaPago === '01') {
    return { deductible: false, categoryId: cat.id, reason: 'Se pagó en efectivo: el SAT no lo acepta como deducible.' };
  }
  return { deductible: true, categoryId: cat.id, reason: cat.name };
}
