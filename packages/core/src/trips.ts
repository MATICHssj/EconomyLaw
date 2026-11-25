import { spendingAmount } from './balances';
import { normalizeText } from './ids';
import {
  addDays,
  addMonths,
  daysBetween,
  monthEnd,
  nextPayday,
  type ISODate,
  type PaydaySchedule,
} from './dates';
import type { UpcomingItem } from './recurring';
import {
  TRIP_BUCKETS,
  type Account,
  type Transaction,
  type Trip,
  type TripBucket,
  type TripItemType,
} from './schemas';

/**
 * Viajes: presupuesto por rubro, plan para pagarlo (ahorrando antes o con
 * tarjeta/MSI después), itinerario y detección de los gastos del viaje.
 */

export const TRIP_BUCKET_INFO: Record<TripBucket, { label: string; icon: string; hint: string }> = {
  flights: {
    label: 'Vuelos y autobuses',
    icon: 'i:plane',
    hint: 'Lo que cuesta llegar y regresar',
  },
  lodging: { label: 'Hospedaje', icon: 'i:bed', hint: 'Hotel, Airbnb, hostal…' },
  food: { label: 'Comida', icon: 'i:utensils', hint: 'Desayunos, comidas, cenas y antojos' },
  local_transport: {
    label: 'Transporte allá',
    icon: 'i:car',
    hint: 'Uber, taxi, renta de auto, gasolina',
  },
  activities: { label: 'Actividades y tours', icon: 'i:ticket', hint: 'Tours, entradas, parques' },
  shopping: { label: 'Compras y recuerdos', icon: 'i:bag', hint: 'Recuerdos, regalos, ropa' },
  other: { label: 'Otros', icon: 'i:package', hint: 'Seguro de viaje, imprevistos' },
};

export const TRIP_ITEM_INFO: Record<
  TripItemType,
  { label: string; icon: string; bucket: TripBucket | null }
> = {
  flight: { label: 'Vuelo o traslado', icon: 'i:plane', bucket: 'flights' },
  lodging: { label: 'Hospedaje', icon: 'i:bed', bucket: 'lodging' },
  activity: { label: 'Actividad', icon: 'i:ticket', bucket: 'activities' },
  food: { label: 'Comida', icon: 'i:utensils', bucket: 'food' },
  transport: { label: 'Transporte', icon: 'i:car', bucket: 'local_transport' },
  note: { label: 'Nota', icon: 'i:note', bucket: null },
};

/** Rubros que se gastan ya estando allá (para el "puedes gastar por día"). */
export const ON_SITE_BUCKETS: TripBucket[] = [
  'food',
  'local_transport',
  'activities',
  'shopping',
  'other',
];

/** Categorías que nunca son del viaje aunque caigan en esas fechas (renta, servicios…). */
const NEVER_TRIP = new Set([
  'housing',
  'utilities',
  'subscriptions',
  'debt_costs',
  'taxes',
  'savings',
  'investments',
  'debt_extra',
  'education',
  'adjustment',
]);

export type TripStatus = 'planning' | 'active' | 'done';

export function tripStatus(trip: Pick<Trip, 'startDate' | 'endDate'>, today: ISODate): TripStatus {
  if (today < trip.startDate) return 'planning';
  if (today > trip.endDate) return 'done';
  return 'active';
}

export function tripDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number {
  return Math.max(1, daysBetween(trip.startDate, trip.endDate) + 1);
}

const TEXT_RULES: Array<[RegExp, TripBucket]> = [
  [
    /\b(vuelo|avion|aerolinea|aeromexico|volaris|viva ?aerobus|aeropuerto|tua|autobus|ado|etn|primera plus|boleto de avion)\b/,
    'flights',
  ],
  [
    /\b(hotel|hostal|hospedaje|airbnb|booking|expedia|trivago|posada|cabana|resort|motel)\b/,
    'lodging',
  ],
  [
    /\b(uber|didi|taxi|cabify|renta de auto|rent a car|hertz|avis|europcar|gasolina|caseta|casetas|metro|ferry|tren|estacionamiento)\b/,
    'local_transport',
  ],
  [
    /\b(tour|museo|entrada|entradas|parque|excursion|snorkel|buceo|xcaret|xel.?ha|zoologico|show|concierto|lancha)\b/,
    'activities',
  ],
  [/\b(recuerdo|recuerdos|souvenir|artesania|artesanias|duty free)\b/, 'shopping'],
];

const CATEGORY_BUCKET: Record<string, TripBucket> = {
  food: 'food',
  coffee: 'food',
  snacks: 'food',
  delivery: 'food',
  alcohol: 'food',
  groceries: 'food',
  transport: 'local_transport',
  gas: 'local_transport',
  car: 'local_transport',
  entertainment: 'activities',
  sports: 'activities',
  shopping: 'shopping',
  clothing: 'shopping',
  gifts: 'shopping',
  personal_care: 'shopping',
};

/** Rubro del viaje al que pertenece un gasto (por texto y categoría). */
export function tripBucketFor(
  tx: Pick<Transaction, 'categoryId' | 'description' | 'merchant'>,
): TripBucket {
  const text = normalizeText(`${tx.merchant ?? ''} ${tx.description ?? ''}`);
  for (const [re, bucket] of TEXT_RULES) if (re.test(text)) return bucket;
  return CATEGORY_BUCKET[tx.categoryId ?? ''] ?? 'other';
}

function emptyBuckets(): Record<TripBucket, number> {
  return Object.fromEntries(TRIP_BUCKETS.map((b) => [b, 0])) as Record<TripBucket, number>;
}

export interface TripSummary {
  status: TripStatus;
  days: number;
  /** Día del viaje (1..days) si está en curso. */
  dayNumber: number | null;
  daysUntil: number;
  budgetCents: number;
  budgetByBucket: Record<TripBucket, number>;
  plannedCents: number;
  plannedByBucket: Record<TripBucket, number>;
  spentCents: number;
  spentByBucket: Record<TripBucket, number>;
  remainingCents: number;
  perPersonCents: number;
  /** Presupuesto diario para gastar allá (comida, transporte, actividades…). */
  dailyBudgetCents: number;
  /** En curso: lo que puedes gastar por día lo que queda del viaje. */
  canSpendPerDayCents: number | null;
  todaySpentCents: number;
  transactions: Transaction[];
}

export function tripSummary(trip: Trip, transactions: Transaction[], today: ISODate): TripSummary {
  const status = tripStatus(trip, today);
  const days = tripDays(trip);
  const budgetByBucket = emptyBuckets();
  for (const b of TRIP_BUCKETS) budgetByBucket[b] = Math.max(0, trip.budget[b] ?? 0);
  const plannedByBucket = emptyBuckets();
  for (const it of trip.items) {
    const bucket = TRIP_ITEM_INFO[it.type].bucket ?? 'other';
    plannedByBucket[bucket] += it.costCents;
  }
  const plannedCents = Object.values(plannedByBucket).reduce((s, v) => s + v, 0);
  let budgetCents = Object.values(budgetByBucket).reduce((s, v) => s + v, 0);
  if (budgetCents === 0 && plannedCents > 0) {
    // Sin presupuesto: se usa lo que llevas en el itinerario como referencia.
    for (const b of TRIP_BUCKETS) budgetByBucket[b] = plannedByBucket[b];
    budgetCents = plannedCents;
  }

  const txs = transactions
    .filter((t) => t.tripId === trip.id && t.kind === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const spentByBucket = emptyBuckets();
  let todaySpentCents = 0;
  for (const t of txs) {
    const amt = spendingAmount(t);
    spentByBucket[tripBucketFor(t)] += amt;
    if (t.date === today) todaySpentCents += amt;
  }
  const spentCents = Object.values(spentByBucket).reduce((s, v) => s + v, 0);

  const onSiteBudget = ON_SITE_BUCKETS.reduce((s, b) => s + budgetByBucket[b], 0);
  const dailyBudgetCents = Math.round(onSiteBudget / days);
  let canSpendPerDayCents: number | null = null;
  let dayNumber: number | null = null;
  if (status === 'active') {
    dayNumber = daysBetween(trip.startDate, today) + 1;
    const daysLeft = Math.max(1, daysBetween(today, trip.endDate) + 1);
    const onSiteSpentBeforeToday = txs
      .filter((t) => t.date < today && ON_SITE_BUCKETS.includes(tripBucketFor(t)))
      .reduce((s, t) => s + spendingAmount(t), 0);
    canSpendPerDayCents = Math.max(
      0,
      Math.floor((onSiteBudget - onSiteSpentBeforeToday) / daysLeft),
    );
  }

  return {
    status,
    days,
    dayNumber,
    daysUntil: daysBetween(today, trip.startDate),
    budgetCents,
    budgetByBucket,
    plannedCents,
    plannedByBucket,
    spentCents,
    spentByBucket,
    remainingCents: budgetCents - spentCents,
    perPersonCents: Math.round(budgetCents / Math.max(1, trip.travelers)),
    dailyBudgetCents,
    canSpendPerDayCents,
    todaySpentCents,
    transactions: txs,
  };
}

// ——————————————————— Cómo pagarlo ———————————————————

const DEFAULT_BIWEEKLY: PaydaySchedule = { type: 'biweekly', days: [15, 30] };

function scheduleFor(period: 'biweekly' | 'monthly', payday?: PaydaySchedule): PaydaySchedule {
  if (period === 'monthly') {
    const day = payday?.type === 'monthly' && payday.days[0] ? payday.days[0] : 30;
    return { type: 'monthly', days: [day] };
  }
  return payday?.type === 'biweekly' && payday.days.length ? payday : DEFAULT_BIWEEKLY;
}

/** Días de pago (quincenas o meses) desde hoy (incluido) y antes de `before`. */
export function paydaysUntil(
  today: ISODate,
  before: ISODate,
  schedule: PaydaySchedule,
  max = 240,
): ISODate[] {
  const out: ISODate[] = [];
  let d = nextPayday(today, schedule);
  while (d && d < before && out.length < max) {
    out.push(d);
    d = nextPayday(addDays(d, 1), schedule);
  }
  return out;
}

/** El n-ésimo día de pago a partir de hoy (n >= 1). */
function nthPayday(today: ISODate, n: number, schedule: PaydaySchedule): ISODate | null {
  let d = nextPayday(today, schedule);
  for (let i = 1; i < n && d; i++) d = nextPayday(addDays(d, 1), schedule);
  return d;
}

export interface TripCardPlan {
  amountCents: number;
  msi: boolean;
  months: number;
  monthlyCents: number;
  interestCents: number;
  finishDate: ISODate | null;
  /** false = con ese abono la deuda no baja (solo cubre intereses). */
  feasible: boolean;
}

export interface TripFundingPlan {
  totalCents: number;
  cashPartCents: number;
  cardPartCents: number;
  savedCents: number;
  toSaveCents: number;
  period: 'biweekly' | 'monthly';
  periodsLeft: number;
  neededPerPeriodCents: number;
  perPeriodCents: number;
  readyDate: ISODate | null;
  onTrack: boolean;
  shortfallCents: number;
  card: TripCardPlan | null;
  nextContribution: { date: ISODate; amountCents: number } | null;
}

/** Simula pagar `amount` con abonos fijos a una tasa anual. */
export function cardPayoff(
  amountCents: number,
  annualRate: number,
  paymentCents: number,
  start: ISODate,
): TripCardPlan {
  if (amountCents <= 0)
    return {
      amountCents: 0,
      msi: false,
      months: 0,
      monthlyCents: 0,
      interestCents: 0,
      finishDate: start,
      feasible: true,
    };
  // Pagar el total antes de la fecha límite no genera intereses.
  if (paymentCents >= amountCents)
    return {
      amountCents,
      msi: false,
      months: 1,
      monthlyCents: amountCents,
      interestCents: 0,
      finishDate: addMonths(start, 1),
      feasible: true,
    };
  const r = annualRate / 12;
  let balance = amountCents;
  let interest = 0;
  let months = 0;
  while (balance > 0 && months < 600) {
    const i = Math.round(balance * r);
    if (paymentCents <= i) {
      return {
        amountCents,
        msi: false,
        months: Infinity,
        monthlyCents: paymentCents,
        interestCents: Infinity,
        finishDate: null,
        feasible: false,
      };
    }
    interest += i;
    balance = balance + i - paymentCents;
    months++;
  }
  return {
    amountCents,
    msi: false,
    months,
    monthlyCents: paymentCents,
    interestCents: interest,
    finishDate: addMonths(start, months),
    feasible: true,
  };
}

export function tripFundingPlan(
  trip: Trip,
  totalCents: number,
  opts: { today: ISODate; payday?: PaydaySchedule; cardAnnualRate?: number },
): TripFundingPlan {
  const f = trip.funding;
  const total = Math.max(0, totalCents);
  const saved = Math.min(f.savedCents, total);
  let cardPart = 0;
  if (f.mode === 'card') cardPart = total - saved;
  else if (f.mode === 'mixed')
    cardPart = Math.min(total - saved, Math.round((total * f.cardSharePct) / 100));
  const cashPart = total - cardPart;
  const toSave = Math.max(0, cashPart - saved);

  const schedule = scheduleFor(f.period, opts.payday);
  const status = tripStatus(trip, opts.today);
  const periods = status === 'planning' ? paydaysUntil(opts.today, trip.startDate, schedule) : [];
  const periodsLeft = periods.length;
  const neededPerPeriodCents =
    toSave === 0 ? 0 : periodsLeft > 0 ? ceilPesos(toSave / periodsLeft) : toSave;
  const per = f.perPeriodCents;

  let readyDate: ISODate | null = null;
  if (toSave === 0) readyDate = opts.today;
  else if (per > 0) readyDate = nthPayday(opts.today, Math.ceil(toSave / per), schedule);
  const onTrack = toSave === 0 || (per > 0 && readyDate !== null && readyDate < trip.startDate);
  const shortfallCents = per > 0 ? Math.max(0, toSave - per * periodsLeft) : toSave;

  let card: TripCardPlan | null = null;
  if (cardPart > 0) {
    if (f.msiMonths > 0) {
      card = {
        amountCents: cardPart,
        msi: true,
        months: f.msiMonths,
        monthlyCents: ceilPesos(cardPart / f.msiMonths),
        interestCents: 0,
        finishDate: addMonths(trip.startDate, f.msiMonths),
        feasible: true,
      };
    } else if (f.payPerMonthCents > 0) {
      card = cardPayoff(cardPart, opts.cardAnnualRate ?? 0.6, f.payPerMonthCents, trip.startDate);
    } else {
      card = {
        amountCents: cardPart,
        msi: false,
        months: 0,
        monthlyCents: 0,
        interestCents: 0,
        finishDate: null,
        feasible: true,
      };
    }
  }

  const nextContribution =
    status === 'planning' && toSave > 0 && periods[0]
      ? { date: periods[0], amountCents: per > 0 ? Math.min(per, toSave) : neededPerPeriodCents }
      : null;

  return {
    totalCents: total,
    cashPartCents: cashPart,
    cardPartCents: cardPart,
    savedCents: saved,
    toSaveCents: toSave,
    period: f.period,
    periodsLeft,
    neededPerPeriodCents,
    perPeriodCents: per,
    readyDate,
    onTrack,
    shortfallCents,
    card,
    nextContribution,
  };
}

// ——————————————————— Detectar gastos del viaje ———————————————————

export interface TripCandidate {
  tx: Transaction;
  reason: string;
  /** true = casi seguro es del viaje (durante las fechas o en la moneda del destino). */
  strong: boolean;
}

/** Palabras demasiado comunes para decir que un gasto "coincide" con el viaje. */
const GENERIC_WORDS = new Set([
  'cena',
  'comida',
  'desayuno',
  'almuerzo',
  'vuelo',
  'vuelos',
  'hotel',
  'tour',
  'tours',
  'viaje',
  'regreso',
  'salida',
  'playa',
  'centro',
  'para',
  'como',
  'este',
  'esta',
  'pago',
  'compra',
  'renta',
  'boleto',
  'boletos',
  'entrada',
  'entradas',
  'taxi',
  'uber',
  'transporte',
  'traslado',
  'noche',
  'dia',
  'dias',
  'anticipo',
  'reserva',
  'reservacion',
  'despedida',
  'fiesta',
  'casa',
  'ciudad',
]);

function words(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
}

/** Redondea hacia arriba a pesos completos. */
const ceilPesos = (cents: number) => Math.ceil(cents / 100) * 100;

/** ¿El viaje toma este gasto en automático? (está en curso, autoAssign, y no es renta/servicios…). */
export function isTripExpense(
  trip: Trip,
  tx: Pick<Transaction, 'kind' | 'date' | 'categoryId' | 'recurringId'>,
): boolean {
  return (
    !trip.archived &&
    trip.autoAssign &&
    tx.kind === 'expense' &&
    tx.date >= trip.startDate &&
    tx.date <= trip.endDate &&
    !tx.recurringId &&
    !NEVER_TRIP.has(tx.categoryId ?? '')
  );
}

/** Viaje al que se debe asignar un gasto nuevo (el primero en curso que lo cubra). */
export function tripForNewExpense(
  trips: Trip[],
  tx: Pick<Transaction, 'kind' | 'date' | 'categoryId' | 'recurringId'>,
): Trip | null {
  return trips.find((t) => isTripExpense(t, tx)) ?? null;
}

/** Gastos que parecen del viaje pero aún no están ligados. */
export function tripCandidates(
  trip: Trip,
  transactions: Transaction[],
  linkedElsewhere?: Set<string>,
): TripCandidate[] {
  const ignored = new Set(trip.ignoredTxIds);
  const destWords = new Set(words(`${trip.destination} ${trip.name}`));
  const itemWords = new Set(trip.items.flatMap((i) => words(`${i.title} ${i.place ?? ''}`)));
  const bookingFrom = addDays(trip.startDate, -365);
  const fxFrom = addDays(trip.startDate, -7);
  const fxTo = addDays(trip.endDate, 7);
  const out: TripCandidate[] = [];
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || tx.tripId || ignored.has(tx.id) || linkedElsewhere?.has(tx.id))
      continue;
    if (tx.recurringId || NEVER_TRIP.has(tx.categoryId ?? '')) continue;
    const text = `${tx.merchant ?? ''} ${tx.description}`;
    if (tx.date >= trip.startDate && tx.date <= trip.endDate) {
      out.push({ tx, reason: 'Lo gastaste durante el viaje', strong: true });
      continue;
    }
    if (
      trip.currency !== 'MXN' &&
      tx.currency === trip.currency &&
      tx.date >= fxFrom &&
      tx.date <= fxTo
    ) {
      out.push({ tx, reason: `Pagado en ${trip.currency}`, strong: true });
      continue;
    }
    if (tx.date < bookingFrom || tx.date > trip.endDate) continue;
    const w = words(text);
    if (w.some((x) => itemWords.has(x))) {
      out.push({ tx, reason: 'Coincide con tu itinerario', strong: false });
      continue;
    }
    if (w.some((x) => destWords.has(x))) {
      out.push({ tx, reason: `Menciona ${trip.destination || trip.name}`, strong: false });
      continue;
    }
    if (tx.date < trip.startDate) {
      const bucket = tripBucketFor(tx);
      if (tx.categoryId === 'travel' || bucket === 'flights' || bucket === 'lodging') {
        out.push({ tx, reason: 'Parece una reserva de viaje', strong: false });
      }
    }
  }
  return out.sort(
    (a, b) => Number(b.strong) - Number(a.strong) || b.tx.date.localeCompare(a.tx.date),
  );
}

/** Recordatorio de "aparta para tu viaje" en el próximo día de pago. */
export function tripUpcoming(
  trips: Trip[],
  totals: Map<string, number>,
  today: ISODate,
  payday?: PaydaySchedule,
  horizonDays = 30,
): UpcomingItem[] {
  const horizon = addDays(today, horizonDays);
  const out: UpcomingItem[] = [];
  for (const trip of trips) {
    if (trip.archived || tripStatus(trip, today) !== 'planning') continue;
    if (trip.funding.mode === 'card') continue;
    const plan = tripFundingPlan(trip, totals.get(trip.id) ?? 0, { today, payday });
    const next = plan.nextContribution;
    if (!next || next.date > horizon || next.amountCents <= 0) continue;
    out.push({
      id: `trip_${trip.id}_${next.date}`,
      type: 'trip',
      title: `Apartar para ${trip.name}`,
      emoji: '✈️',
      date: next.date,
      daysUntil: daysBetween(today, next.date),
      amountCents: next.amountCents,
      direction: 'out',
      refId: trip.id,
      remindDaysBefore: 0,
    });
  }
  return out;
}

// ——————————————————— Tarjetas: vencimiento ———————————————————

export interface CardExpiryAlert {
  accountId: string;
  name: string;
  last4?: string;
  expiry: string;
  daysLeft: number;
}

/** Tarjetas que vencen pronto (o ya vencieron) según su fecha 'YYYY-MM'. */
export function cardExpiryAlerts(
  accounts: Account[],
  today: ISODate,
  withinDays = 60,
): CardExpiryAlert[] {
  return accounts
    .filter((a) => !a.archived && a.card?.expiry)
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      last4: a.card!.last4,
      expiry: a.card!.expiry!,
      daysLeft: daysBetween(today, monthEnd(a.card!.expiry!)),
    }))
    .filter((x) => x.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
