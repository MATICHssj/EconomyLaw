import { addDays, addMonths, daysInMonth, makeISODate, splitISO, type ISODate } from './dates';
import type {
  Account,
  Budget,
  CollectionMap,
  Debt,
  Goal,
  InstallmentPlan,
  Investment,
  Loan,
  Recurring,
  Split,
  Tanda,
  Transaction,
} from './schemas';

/** Todos los documentos de ejemplo empiezan con este prefijo: así se borran con un toque. */
export const DEMO_PREFIX = 'demo_';

/** ¿Es un documento de ejemplo? (Los presupuestos usan el id del mes y se marcan con demo: true.) */
export function isDemoDoc(doc: { id: string; demo?: boolean }): boolean {
  return doc.id.startsWith(DEMO_PREFIX) || doc.demo === true;
}

/** Generador pseudoaleatorio con semilla (mismos datos siempre). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DemoData = { [K in keyof CollectionMap]?: CollectionMap[K][] };

/** 3 meses ficticios de una persona que cobra por quincena en CDMX. */
export function generateDemoData(today: ISODate, now = new Date().toISOString()): DemoData {
  const rand = rng(20251115);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) / 5) * 5;
  let counter = 0;
  const id = (p: string) => `${DEMO_PREFIX}${p}_${(counter++).toString(36)}`;

  const acc = (a: Omit<Account, 'archived' | 'aliases' | 'currency' | 'createdAt'> & Partial<Account>): Account => ({
    archived: false,
    aliases: [],
    currency: 'MXN',
    createdAt: now,
    ...a,
  });
  const accounts: Account[] = [
    acc({ id: `${DEMO_PREFIX}cash`, name: 'Efectivo', type: 'cash', institution: 'cash', openingBalanceCents: 120000, color: '#16a34a', icon: '💵' }),
    acc({ id: `${DEMO_PREFIX}bbva`, name: 'BBVA Débito', type: 'debit', institution: 'bbva', openingBalanceCents: 850000, color: '#072146', icon: '💳', aliases: ['bbva'] }),
    acc({
      id: `${DEMO_PREFIX}nu`,
      name: 'Nu Crédito',
      type: 'credit',
      institution: 'nu',
      openingBalanceCents: 0,
      color: '#820ad1',
      icon: '💜',
      aliases: ['nu'],
      credit: { limitCents: 3500000, cutoffDay: 5, dueDay: 25, annualRate: 0.6, minPaymentRate: 0.05 },
    }),
    acc({ id: `${DEMO_PREFIX}mp`, name: 'Mercado Pago', type: 'wallet', institution: 'mercadopago', openingBalanceCents: 45000, color: '#00b1ea', icon: '📱', aliases: ['mp', 'mercado pago'] }),
    acc({ id: `${DEMO_PREFIX}savings`, name: 'Ahorro Nu (cajitas)', type: 'savings', institution: 'nu', openingBalanceCents: 1800000, color: '#059669', icon: '🐷' }),
  ];

  const txs: Transaction[] = [];
  const tx = (t: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date' | 'description'>): Transaction => {
    const full: Transaction = {
      id: id('tx'),
      currency: 'MXN',
      amountMxnCents: t.amountCents,
      accountId: `${DEMO_PREFIX}bbva`,
      categoryId: null,
      tags: [],
      createdAt: `${t.date}T${String(9 + Math.floor(rand() * 12)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00.000Z`,
      updatedAt: now,
      source: 'demo',
      status: 'cleared',
      reconciled: false,
      attachments: [],
      ...t,
    };
    txs.push(full);
    return full;
  };

  const start = addMonths(makeISODate(splitISO(today).year, splitISO(today).month, 1), -2);
  const quincena = 1450000;

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const { year, month, day } = splitISO(d);
    const last = daysInMonth(year, month);
    if (day === 15 || day === last) {
      tx({ kind: 'income', amountCents: quincena, date: d, description: 'Quincena', categoryId: 'salary', merchant: 'Nómina' });
      tx({ kind: 'transfer', amountCents: 150000, date: d, description: 'Ahorro de quincena', accountId: `${DEMO_PREFIX}bbva`, toAccountId: `${DEMO_PREFIX}savings` });
      tx({ kind: 'transfer', amountCents: 200000, date: d, description: 'Retiro cajero', accountId: `${DEMO_PREFIX}bbva`, toAccountId: `${DEMO_PREFIX}cash` });
    }
    if (day === 1) tx({ kind: 'expense', amountCents: 750000, date: d, description: 'Renta', categoryId: 'housing', recurringId: `${DEMO_PREFIX}rec_rent` });
    if (day === 3) tx({ kind: 'expense', amountCents: 58900, date: d, description: 'Internet', merchant: 'Totalplay', categoryId: 'utilities', recurringId: `${DEMO_PREFIX}rec_net` });
    if (day === 8) tx({ kind: 'expense', amountCents: 29900, date: d, description: 'Netflix', merchant: 'Netflix', categoryId: 'subscriptions', accountId: `${DEMO_PREFIX}nu` });
    if (day === 12) tx({ kind: 'expense', amountCents: 12900, date: d, description: 'Spotify', merchant: 'Spotify', categoryId: 'subscriptions', accountId: `${DEMO_PREFIX}nu` });
    if (day === 20) tx({ kind: 'expense', amountCents: 29900, date: d, description: 'Plan Telcel', merchant: 'Telcel', categoryId: 'utilities', accountId: `${DEMO_PREFIX}bbva` });
    if (day === 18 && month % 2 === 0) tx({ kind: 'expense', amountCents: between(42000, 61000), date: d, description: 'Luz CFE', merchant: 'CFE', categoryId: 'utilities' });
    if (day === 26) {
      // Pago de la tarjeta Nu
      tx({ kind: 'debt_payment', amountCents: between(250000, 380000), date: d, description: 'Pago tarjeta Nu', accountId: `${DEMO_PREFIX}bbva`, toAccountId: `${DEMO_PREFIX}nu` });
    }
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd === 6) tx({ kind: 'expense', amountCents: between(85000, 145000), date: d, description: 'Súper de la semana', merchant: pick(['Walmart', 'Soriana', 'Chedraui', 'La Comer']), categoryId: 'groceries', accountId: `${DEMO_PREFIX}nu` });
    if (wd === 2 || wd === 5) tx({ kind: 'expense', amountCents: between(60000, 75000), date: d, description: 'Gasolina', merchant: 'Pemex', categoryId: 'gas', accountId: `${DEMO_PREFIX}nu` });
    if (rand() < 0.55) tx({ kind: 'expense', amountCents: between(3500, 6500), date: d, description: pick(['Café', 'Americano', 'Latte']), merchant: pick(['Starbucks', 'Café local', 'Oxxo']), categoryId: 'coffee', accountId: `${DEMO_PREFIX}cash` });
    if (rand() < 0.45) tx({ kind: 'expense', amountCents: between(1500, 4500), date: d, description: pick(['Galletas', 'Refresco', 'Papas', 'Chicles', 'Agua']), merchant: 'OXXO', categoryId: 'snacks', accountId: `${DEMO_PREFIX}cash` });
    if (rand() < 0.35) tx({ kind: 'expense', amountCents: between(9000, 22000), date: d, description: pick(['Tacos', 'Comida corrida', 'Tortas', 'Sushi', 'Pozole']), categoryId: 'food', accountId: pick([`${DEMO_PREFIX}cash`, `${DEMO_PREFIX}bbva`]) });
    if (rand() < 0.3) tx({ kind: 'expense', amountCents: between(6500, 18000), date: d, description: 'Viaje', merchant: pick(['Uber', 'DiDi']), categoryId: 'transport', accountId: `${DEMO_PREFIX}mp` });
    if (rand() < 0.12) tx({ kind: 'expense', amountCents: between(18000, 42000), date: d, description: 'Pedido', merchant: pick(['Rappi', 'Uber Eats', 'DiDi Food']), categoryId: 'delivery', accountId: `${DEMO_PREFIX}nu` });
    if (rand() < 0.06) tx({ kind: 'expense', amountCents: between(35000, 120000), date: d, description: pick(['Tenis', 'Playera', 'Pantalón']), merchant: pick(['Liverpool', 'Zara', 'Amazon']), categoryId: 'clothing', accountId: `${DEMO_PREFIX}nu` });
    if (rand() < 0.07) tx({ kind: 'expense', amountCents: between(15000, 45000), date: d, description: pick(['Cine', 'Concierto', 'Boliche']), merchant: pick(['Cinépolis', 'Cinemex', 'Ticketmaster']), categoryId: 'entertainment', accountId: `${DEMO_PREFIX}bbva` });
    if (rand() < 0.04) tx({ kind: 'expense', amountCents: between(25000, 90000), date: d, description: pick(['Farmacia', 'Consulta médica', 'Dentista']), merchant: pick(['Farmacias Guadalajara', 'Farmacia del Ahorro', 'Dr. Simi']), categoryId: 'health', accountId: `${DEMO_PREFIX}bbva` });
  }

  // Compra a MSI: TV 12,000 a 12 meses en Nu
  const msiDate = addDays(start, 9);
  const plan: InstallmentPlan = {
    id: `${DEMO_PREFIX}msi_tv`,
    description: 'Pantalla 55"',
    totalCents: 1200000,
    months: 12,
    paidMonths: 0,
    accountId: `${DEMO_PREFIX}nu`,
    startDate: msiDate,
    categoryId: 'home',
    annualRate: 0,
    createdAt: now,
  };
  const tvTx = tx({ kind: 'expense', amountCents: 1200000, date: msiDate, description: 'Pantalla 55" a 12 MSI', merchant: 'Liverpool', categoryId: 'home', accountId: `${DEMO_PREFIX}nu`, installmentPlanId: plan.id });
  plan.transactionId = tvTx.id;

  // Préstamo a Juan
  const loanDate = addDays(today, -20);
  const loan: Loan = { id: `${DEMO_PREFIX}loan_juan`, person: 'Juan', direction: 'lent', amountCents: 50000, paidCents: 20000, dueDate: addDays(today, 10), note: 'Para la gasolina', createdAt: now, closed: false };
  tx({ kind: 'loan_given', amountCents: 50000, date: loanDate, description: 'Préstamo a Juan', person: 'Juan', loanId: loan.id, accountId: `${DEMO_PREFIX}cash` });
  tx({ kind: 'loan_collected', amountCents: 20000, date: addDays(loanDate, 7), description: 'Juan me pagó', person: 'Juan', loanId: loan.id, accountId: `${DEMO_PREFIX}cash` });

  // Cena compartida entre 3
  const splitDate = addDays(today, -6);
  const split: Split = {
    id: `${DEMO_PREFIX}split_cena`,
    description: 'Cena de cumpleaños',
    totalCents: 90000,
    date: splitDate,
    participants: [
      { name: 'Yo', shareCents: 30000, paid: true, isMe: true },
      { name: 'Ana', shareCents: 30000, paid: true, isMe: false },
      { name: 'Luis', shareCents: 30000, paid: false, isMe: false },
    ],
    createdAt: now,
  };
  const splitTx = tx({ kind: 'expense', amountCents: 90000, myShareCents: 30000, date: splitDate, description: 'Cena de cumpleaños entre 3', categoryId: 'food', splitId: split.id, accountId: `${DEMO_PREFIX}bbva` });
  split.transactionId = splitTx.id;

  // Tanda y CETES
  const tanda: Tanda = { id: `${DEMO_PREFIX}tanda`, name: 'Tanda de la oficina', contributionCents: 50000, participants: 10, myTurn: 6, frequency: 'biweekly', startDate: addDays(start, 14), organizer: 'Doña Mary', received: false, createdAt: now, archived: false };
  const cetes: Investment = {
    id: `${DEMO_PREFIX}cetes`,
    name: 'CETES 28 días',
    type: 'cetes',
    contributions: [
      { date: start, amountCents: 1000000 },
      { date: addMonths(start, 1), amountCents: 500000 },
    ],
    currentValueCents: 1528000,
    expectedAnnualRate: 0.075,
    updatedAt: now,
    createdAt: now,
    archived: false,
  };
  const afore: Investment = { id: `${DEMO_PREFIX}afore`, name: 'Afore', type: 'afore', contributions: [], currentValueCents: 18450000, expectedAnnualRate: 0.06, updatedAt: now, createdAt: now, archived: false };

  const goals: Goal[] = [
    { id: `${DEMO_PREFIX}goal_emergency`, name: 'Fondo de emergencia', emoji: 'i:lifebuoy', targetCents: 6000000, savedCents: 1800000, targetDate: addMonths(today, 10), accountId: `${DEMO_PREFIX}savings`, type: 'emergency', monthsTarget: 3, createdAt: now, archived: false },
    { id: `${DEMO_PREFIX}goal_oaxaca`, name: 'Viaje a Oaxaca', emoji: 'i:palmtree', targetCents: 1500000, savedCents: 420000, targetDate: addMonths(today, 4), accountId: null, type: 'normal', createdAt: now, archived: false },
  ];

  const debts: Debt[] = [
    { id: `${DEMO_PREFIX}debt_car`, name: 'Crédito del auto', kind: 'car', balanceCents: 8500000, annualRate: 0.14, minPaymentCents: 420000, accountId: null, createdAt: now, archived: false },
    { id: `${DEMO_PREFIX}debt_coppel`, name: 'Crédito Coppel', kind: 'personal', balanceCents: 640000, annualRate: 0.85, minPaymentCents: 90000, accountId: null, createdAt: now, archived: false },
  ];

  const rec = (r: Omit<Recurring, 'createdAt' | 'active' | 'remindDaysBefore' | 'autoCreate' | 'isSubscription'> & Partial<Recurring>): Recurring => ({
    createdAt: now,
    active: true,
    remindDaysBefore: 2,
    autoCreate: false,
    isSubscription: false,
    ...r,
  });
  const nextOn = (day: number) => {
    const { year, month } = splitISO(today);
    const thisMonth = makeISODate(year, month, day);
    return thisMonth > today ? thisMonth : addMonths(thisMonth, 1);
  };
  const recurring: Recurring[] = [
    rec({ id: `${DEMO_PREFIX}rec_rent`, name: 'Renta', template: { kind: 'expense', amountCents: 750000, currency: 'MXN', accountId: `${DEMO_PREFIX}bbva`, categoryId: 'housing', description: 'Renta', tags: [] }, frequency: 'monthly', nextDate: nextOn(1), remindDaysBefore: 3 }),
    rec({ id: `${DEMO_PREFIX}rec_net`, name: 'Internet Totalplay', template: { kind: 'expense', amountCents: 58900, currency: 'MXN', accountId: `${DEMO_PREFIX}bbva`, categoryId: 'utilities', description: 'Internet', merchant: 'Totalplay', tags: [] }, frequency: 'monthly', nextDate: nextOn(3) }),
    rec({ id: `${DEMO_PREFIX}rec_salary`, name: 'Quincena', template: { kind: 'income', amountCents: quincena, currency: 'MXN', accountId: `${DEMO_PREFIX}bbva`, categoryId: 'salary', description: 'Quincena', tags: [] }, frequency: 'biweekly', nextDate: splitISO(today).day < 15 ? makeISODate(splitISO(today).year, splitISO(today).month, 15) : makeISODate(splitISO(today).year, splitISO(today).month, 31) }),
  ];

  const mk = splitISO(today);
  const monthKeys = [0, -1, -2].map((i) => addMonths(makeISODate(mk.year, mk.month, 1), i).slice(0, 7));
  const budgets: Budget[] = monthKeys.map((k) => ({
    id: `${k}`,
    method: 'category',
    demo: true,
    lines: {
      groceries: { assignedCents: 500000, rollover: false },
      food: { assignedCents: 300000, rollover: false },
      coffee: { assignedCents: 60000, rollover: false },
      snacks: { assignedCents: 40000, rollover: false },
      transport: { assignedCents: 200000, rollover: false },
      gas: { assignedCents: 450000, rollover: false },
      entertainment: { assignedCents: 120000, rollover: true },
      delivery: { assignedCents: 80000, rollover: false },
      subscriptions: { assignedCents: 45000, rollover: false },
    },
  }));

  return {
    accounts,
    transactions: txs,
    installmentPlans: [plan],
    loans: [loan],
    splits: [split],
    tandas: [tanda],
    investments: [cetes, afore],
    goals,
    debts,
    recurring,
    budgets,
  };
}
