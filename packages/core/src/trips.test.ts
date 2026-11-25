import { describe, expect, it } from 'vitest';
import {
  advanceRecurring,
  cardExpiryAlerts,
  cardPayoff,
  overdueRecurring,
  tripBucketFor,
  tripCandidates,
  tripDays,
  tripForNewExpense,
  tripFundingPlan,
  tripStatus,
  tripSummary,
  tripUpcoming,
  NEVER,
  RecurringSchema,
  TripSchema,
  type Account,
  type Transaction,
  type Trip,
} from './index';

const now = '2026-01-01T12:00:00.000Z';
let n = 0;
function tx(p: Partial<Transaction> & Pick<Transaction, 'amountCents' | 'date'>): Transaction {
  return {
    id: `t${n++}`,
    kind: 'expense',
    currency: 'MXN',
    amountMxnCents: p.amountCents,
    accountId: 'cash',
    categoryId: 'food',
    tags: [],
    description: 'x',
    createdAt: now,
    updatedAt: now,
    source: 'app',
    status: 'cleared',
    reconciled: false,
    attachments: [],
    ...p,
  };
}

function trip(p: Partial<Trip> = {}): Trip {
  return TripSchema.parse({
    id: 'trip1',
    name: 'Cancún',
    destination: 'Cancún',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    createdAt: now,
    ...p,
  });
}

describe('viajes: básicos', () => {
  it('estado y días', () => {
    const t = trip();
    expect(tripDays(t)).toBe(5);
    expect(tripStatus(t, '2026-03-31')).toBe('planning');
    expect(tripStatus(t, '2026-04-01')).toBe('active');
    expect(tripStatus(t, '2026-04-05')).toBe('active');
    expect(tripStatus(t, '2026-04-06')).toBe('done');
  });

  it('rubro por texto y categoría', () => {
    expect(tripBucketFor({ categoryId: 'travel', description: 'Vuelo', merchant: 'Volaris' })).toBe('flights');
    expect(tripBucketFor({ categoryId: 'travel', description: 'Hotel Riu' })).toBe('lodging');
    expect(tripBucketFor({ categoryId: 'transport', description: 'Uber al centro' })).toBe('local_transport');
    expect(tripBucketFor({ categoryId: 'food', description: 'tacos' })).toBe('food');
    expect(tripBucketFor({ categoryId: 'entertainment', description: 'Xcaret' })).toBe('activities');
    expect(tripBucketFor({ categoryId: 'other', description: 'algo' })).toBe('other');
  });
});

describe('viajes: resumen', () => {
  it('suma presupuesto y gastos ligados, y calcula cuánto gastar por día', () => {
    const t = trip({ budget: { flights: 500000, lodging: 600000, food: 250000, activities: 150000 } });
    const txs = [
      tx({ amountCents: 480000, date: '2026-02-10', tripId: 'trip1', categoryId: 'travel', description: 'Volaris' }),
      tx({ amountCents: 60000, date: '2026-04-01', tripId: 'trip1', categoryId: 'food', description: 'comida' }),
      tx({ amountCents: 99999, date: '2026-04-01', categoryId: 'food' }), // no ligado
    ];
    const s = tripSummary(t, txs, '2026-04-02');
    expect(s.budgetCents).toBe(1500000);
    expect(s.spentCents).toBe(540000);
    expect(s.spentByBucket.flights).toBe(480000);
    expect(s.spentByBucket.food).toBe(60000);
    expect(s.status).toBe('active');
    expect(s.dayNumber).toBe(2);
    // Allá: comida 2,500 + actividades 1,500 = 4,000; ya gastó 600 antes de hoy; quedan 4 días.
    expect(s.canSpendPerDayCents).toBe(Math.floor((400000 - 60000) / 4));
    expect(s.dailyBudgetCents).toBe(80000);
  });

  it('sin presupuesto usa el itinerario', () => {
    const t = trip({
      items: [
        { id: 'a', date: '2026-04-01', type: 'lodging', title: 'Hotel', costCents: 300000, paid: false },
        { id: 'b', date: '2026-04-02', type: 'activity', title: 'Tour', costCents: 100000, paid: false },
      ],
    });
    const s = tripSummary(t, [], '2026-03-01');
    expect(s.plannedCents).toBe(400000);
    expect(s.budgetCents).toBe(400000);
    expect(s.budgetByBucket.lodging).toBe(300000);
  });
});

describe('viajes: cómo pagarlo', () => {
  it('ahorrando por quincena: cuánto apartar y si llegas a tiempo', () => {
    const t = trip({ funding: { mode: 'save', perPeriodCents: 150000, period: 'biweekly' } as Trip['funding'] });
    const p = tripFundingPlan(t, 1200000, { today: '2026-01-01' });
    // Quincenas antes del 1 de abril: 15 y 31 ene, 15 y 28 feb, 15 y 31 mar.
    expect(p.periodsLeft).toBe(6);
    expect(p.neededPerPeriodCents).toBe(200000);
    expect(p.onTrack).toBe(false);
    expect(p.shortfallCents).toBe(1200000 - 150000 * 6);
    expect(p.readyDate).toBe('2026-04-30');
    expect(p.nextContribution).toEqual({ date: '2026-01-15', amountCents: 150000 });
  });

  it('lo ya ahorrado reduce lo que falta', () => {
    const t = trip({ funding: { mode: 'save', savedCents: 600000, perPeriodCents: 100000 } as Trip['funding'] });
    const p = tripFundingPlan(t, 1200000, { today: '2026-01-01' });
    expect(p.toSaveCents).toBe(600000);
    expect(p.onTrack).toBe(true);
    expect(p.readyDate).toBe('2026-03-31');
  });

  it('con tarjeta a meses sin intereses', () => {
    const t = trip({ funding: { mode: 'card', msiMonths: 6 } as Trip['funding'] });
    const p = tripFundingPlan(t, 1200000, { today: '2026-01-01' });
    expect(p.cardPartCents).toBe(1200000);
    expect(p.toSaveCents).toBe(0);
    expect(p.card).toMatchObject({ msi: true, months: 6, monthlyCents: 200000, interestCents: 0, finishDate: '2026-10-01' });
  });

  it('mixto: parte ahorrada y parte con tarjeta', () => {
    const t = trip({ funding: { mode: 'mixed', cardSharePct: 25, msiMonths: 3 } as Trip['funding'] });
    const p = tripFundingPlan(t, 1200000, { today: '2026-01-01' });
    expect(p.cardPartCents).toBe(300000);
    expect(p.cashPartCents).toBe(900000);
    expect(p.card?.monthlyCents).toBe(100000);
  });

  it('tarjeta sin MSI: meses e intereses, o imposible si el abono no cubre intereses', () => {
    const ok = cardPayoff(1000000, 0.6, 100000, '2026-04-01');
    expect(ok.feasible).toBe(true);
    expect(ok.months).toBeGreaterThan(10);
    expect(ok.interestCents).toBeGreaterThan(0);
    expect(cardPayoff(1000000, 0.6, 1000000, '2026-04-01')).toMatchObject({ months: 1, interestCents: 0 });
    expect(cardPayoff(1000000, 0.6, 40000, '2026-04-01').feasible).toBe(false);
  });

  it('recordatorio de apartar en la próxima quincena', () => {
    const t = trip({ funding: { mode: 'save', perPeriodCents: 150000 } as Trip['funding'] });
    const up = tripUpcoming([t], new Map([['trip1', 1200000]]), '2026-01-01');
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ type: 'trip', date: '2026-01-15', amountCents: 150000, direction: 'out' });
  });
});

describe('viajes: detectar gastos', () => {
  it('sugiere los del viaje y deja fuera renta, ligados e ignorados', () => {
    const t = trip({
      items: [{ id: 'h', date: '2026-04-01', type: 'lodging', title: 'Hotel Riu Palace', costCents: 0, paid: false }],
      ignoredTxIds: ['ign'],
    });
    const during = tx({ amountCents: 30000, date: '2026-04-02', description: 'tacos' });
    const rent = tx({ amountCents: 750000, date: '2026-04-01', categoryId: 'housing', description: 'Renta' });
    const flight = tx({ amountCents: 450000, date: '2026-02-01', categoryId: 'travel', description: 'Vuelo', merchant: 'Volaris' });
    const hotel = tx({ amountCents: 500000, date: '2026-01-20', categoryId: 'other', description: 'RIU PALACE' });
    const linked = tx({ amountCents: 1000, date: '2026-04-03', tripId: 'otro' });
    const ignored = tx({ id: 'ign', amountCents: 1000, date: '2026-04-03' });
    const unrelated = tx({ amountCents: 5000, date: '2026-02-03', description: 'super' });
    // "Cena" sola es demasiado común: no debe coincidir con "Cena en Riu" del itinerario por esa palabra.
    const dinner = tx({ amountCents: 90000, date: '2026-02-10', description: 'Cena de cumpleaños' });
    const c = tripCandidates({ ...t, items: [...t.items, { id: 'c', date: null, type: 'food', title: 'Cena de despedida', costCents: 0, paid: false }] }, [during, rent, flight, hotel, linked, ignored, unrelated, dinner]);
    expect(c.map((x) => x.tx.id)).toEqual([during.id, flight.id, hotel.id]);
    expect(c[0]!.strong).toBe(true);
    expect(c.find((x) => x.tx.id === hotel.id)!.reason).toBe('Coincide con tu itinerario');
  });

  it('asigna en automático los gastos durante el viaje', () => {
    const t = trip();
    expect(tripForNewExpense([t], { kind: 'expense', date: '2026-04-02', categoryId: 'food' })?.id).toBe('trip1');
    expect(tripForNewExpense([t], { kind: 'expense', date: '2026-04-02', categoryId: 'housing' })).toBeNull();
    expect(tripForNewExpense([t], { kind: 'expense', date: '2026-04-08', categoryId: 'food' })).toBeNull();
    expect(tripForNewExpense([{ ...t, autoAssign: false }], { kind: 'expense', date: '2026-04-02', categoryId: 'food' })).toBeNull();
  });
});

describe('recordatorios y tarjetas', () => {
  it('pago de una sola vez se apaga al pagarse', () => {
    const r = RecurringSchema.parse({
      id: 'r1',
      name: 'Predial',
      template: { kind: 'expense', amountCents: 230000, accountId: null, categoryId: 'taxes', description: 'Predial' },
      frequency: 'once',
      nextDate: '2026-01-31',
      createdAt: now,
    });
    expect(advanceRecurring(r)).toEqual({ nextDate: NEVER, active: false });
    expect(overdueRecurring([r], '2026-02-05').map((x) => x.title)).toEqual(['Predial']);
    expect(overdueRecurring([{ ...r, active: false }], '2026-02-05')).toEqual([]);
  });

  it('avisa de tarjetas por vencer', () => {
    const acc = (id: string, expiry?: string): Account =>
      ({ id, name: id, type: 'debit', currency: 'MXN', openingBalanceCents: 0, color: '#000', icon: 'x', archived: false, aliases: [], createdAt: now, card: expiry ? { brand: 'visa', last4: '1234', expiry, nfc: false } : undefined }) as Account;
    const alerts = cardExpiryAlerts([acc('a', '2026-02'), acc('b', '2027-01'), acc('c')], '2026-01-10');
    expect(alerts.map((a) => a.accountId)).toEqual(['a']);
    expect(alerts[0]!.daysLeft).toBe(49);
  });
});
