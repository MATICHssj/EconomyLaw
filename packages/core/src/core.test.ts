import { describe, expect, it } from 'vitest';
import {
  addMonths,
  allocateCents,
  antExpenses,
  balancesByPerson,
  budgetProgress,
  cardStatement,
  cfdiDeductibility,
  compareStrategies,
  computeBalances,
  coupleBalance,
  detectSubscriptions,
  dueDateForCutoff,
  fiftyThirtyTwenty,
  financialHealth,
  formatMoney,
  generateDemoData,
  goalProgress,
  installmentSchedule,
  isDemoDoc,
  lastCutoff,
  nextOccurrence,
  nextPayday,
  netWorth,
  parseCfdiXml,
  parseCsv,
  planStatus,
  projectCashFlow,
  spendingItems,
  splitCents,
  summarizePeriod,
  tandaStatus,
  toCsv,
  AccountSchema,
  TransactionSchema,
  buildDefaultCategories,
  type Account,
  type InstallmentPlan,
  type Transaction,
} from './index';

const now = '2025-11-15T12:00:00.000Z';
let n = 0;
function tx(p: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>): Transaction {
  return {
    id: `t${n++}`,
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
const account = (p: Partial<Account> & Pick<Account, 'id' | 'type'>): Account => ({
  name: p.id,
  currency: 'MXN',
  openingBalanceCents: 0,
  color: '#000',
  icon: '💳',
  archived: false,
  aliases: [],
  createdAt: now,
  ...p,
});

describe('dinero', () => {
  it('formatea pesos mexicanos', () => {
    expect(formatMoney(3000)).toBe('$30');
    expect(formatMoney(4550)).toBe('$45.50');
    expect(formatMoney(125050)).toBe('$1,250.50');
    expect(formatMoney(-3000)).toBe('−$30');
    expect(formatMoney(150000000)).toBe('$1,500,000');
  });
  it('divide sin perder centavos', () => {
    expect(splitCents(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitCents(100, 3).reduce((a, b) => a + b)).toBe(100);
    expect(allocateCents(1000, [60, 40])).toEqual([600, 400]);
    expect(allocateCents(1001, [1, 1]).reduce((a, b) => a + b)).toBe(1001);
  });
});

describe('fechas', () => {
  it('suma meses respetando fin de mes', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-11-15', 3)).toBe('2026-02-15');
  });
  it('calcula la próxima quincena', () => {
    const q = { type: 'biweekly' as const, days: [15, 30] };
    expect(nextPayday('2025-11-10', q)).toBe('2025-11-15');
    expect(nextPayday('2025-11-16', q)).toBe('2025-11-30');
    expect(nextPayday('2025-02-16', q)).toBe('2025-02-28');
    expect(nextPayday('2025-12-31', q)).toBe('2025-12-31');
  });
  it('quincenal alterna 15 y fin de mes', () => {
    expect(nextOccurrence('2025-11-15', 'biweekly')).toBe('2025-11-30');
    expect(nextOccurrence('2025-11-30', 'biweekly')).toBe('2025-12-15');
    expect(nextOccurrence('2025-02-28', 'biweekly')).toBe('2025-03-15');
  });
});

describe('saldos', () => {
  it('aplica gastos, ingresos, transferencias y pagos de tarjeta', () => {
    const accounts = [account({ id: 'cash', type: 'cash', openingBalanceCents: 10000 }), account({ id: 'card', type: 'credit' })];
    const txs = [
      tx({ kind: 'expense', amountCents: 3000, date: '2025-11-01' }),
      tx({ kind: 'income', amountCents: 50000, date: '2025-11-02' }),
      tx({ kind: 'expense', amountCents: 20000, date: '2025-11-03', accountId: 'card' }),
      tx({ kind: 'debt_payment', amountCents: 15000, date: '2025-11-04', accountId: 'cash', toAccountId: 'card' }),
    ];
    expect(computeBalances(accounts, txs)).toEqual({ cash: 42000, card: -5000 });
  });
  it('reparte compras a MSI por mes y cuenta solo tu parte en compartidos', () => {
    const plan: InstallmentPlan = { id: 'p1', description: 'TV', totalCents: 1200000, months: 12, paidMonths: 0, accountId: 'card', startDate: '2025-10-10', annualRate: 0, createdAt: now };
    const txs = [
      tx({ kind: 'expense', amountCents: 1200000, date: '2025-10-10', installmentPlanId: 'p1', categoryId: 'home' }),
      tx({ kind: 'expense', amountCents: 90000, myShareCents: 30000, date: '2025-11-05' }),
    ];
    const nov = summarizePeriod(txs, [plan], '2025-11-01', '2025-11-30');
    expect(nov.spentCents).toBe(100000 + 30000);
    expect(spendingItems(txs, [plan]).filter((i) => i.installment).length).toBe(12);
  });
});

describe('tarjetas de crédito', () => {
  it('calcula corte y fecha límite', () => {
    expect(lastCutoff('2025-11-10', 5)).toBe('2025-11-05');
    expect(lastCutoff('2025-11-03', 5)).toBe('2025-10-05');
    expect(dueDateForCutoff('2025-11-05', 25)).toBe('2025-11-25');
    expect(dueDateForCutoff('2025-11-20', 10)).toBe('2025-12-10');
  });
  it('pago para no generar intereses incluye MSI del corte', () => {
    const card = account({ id: 'nu', type: 'credit', credit: { limitCents: 3000000, cutoffDay: 5, dueDay: 25, annualRate: 0.6, minPaymentRate: 0.05 } });
    const plan: InstallmentPlan = { id: 'p', description: 'TV', totalCents: 1200000, months: 12, paidMonths: 0, accountId: 'nu', startDate: '2025-10-20', annualRate: 0, createdAt: now };
    const txs = [
      tx({ kind: 'expense', amountCents: 50000, date: '2025-10-15', accountId: 'nu' }),
      tx({ kind: 'expense', amountCents: 1200000, date: '2025-10-20', accountId: 'nu', installmentPlanId: 'p' }),
      tx({ kind: 'expense', amountCents: 7000, date: '2025-11-08', accountId: 'nu' }),
    ];
    const bal = computeBalances([card], txs).nu!;
    const st = cardStatement(card, txs, [plan], bal, '2025-11-10')!;
    expect(st.cutoffDate).toBe('2025-11-05');
    expect(st.dueDate).toBe('2025-11-25');
    expect(st.noInterestPaymentCents).toBe(50000 + 100000);
    expect(st.currentPeriodChargesCents).toBe(7000);
    expect(st.totalOwedCents).toBe(1257000);
  });
});

describe('MSI', () => {
  it('genera 12 mensualidades de $1,000', () => {
    const plan: InstallmentPlan = { id: 'p', description: 'TV', totalCents: 1200000, months: 12, paidMonths: 0, accountId: 'nu', startDate: '2025-01-10', annualRate: 0, createdAt: now };
    const s = installmentSchedule(plan);
    expect(s).toHaveLength(12);
    expect(s.every((c) => c.amountCents === 100000)).toBe(true);
    const st = planStatus(plan, '2025-03-15');
    expect(st.paidCount).toBe(3);
    expect(st.remainingCents).toBe(900000);
    expect(st.nextCharge?.date).toBe('2025-04-10');
  });
});

describe('deudas', () => {
  it('avalancha paga menos intereses que bola de nieve', () => {
    const debts = [
      { id: 'a', name: 'Tarjeta', balanceCents: 3000000, annualRate: 0.6, minPaymentCents: 150000 },
      { id: 'b', name: 'Préstamo', balanceCents: 500000, annualRate: 0.15, minPaymentCents: 50000 },
    ];
    const r = compareStrategies(debts, 500000, '2025-11-01');
    expect(r.snowball.feasible).toBe(true);
    expect(r.avalanche.feasible).toBe(true);
    expect(r.snowball.order[0]!.id).toBe('b');
    expect(r.avalanche.order[0]!.id).toBe('a');
    expect(r.interestSavedWithAvalancheCents).toBeGreaterThan(0);
  });
  it('detecta cuando el pago no alcanza', () => {
    const r = compareStrategies([{ id: 'a', name: 'X', balanceCents: 1000000, annualRate: 0.9, minPaymentCents: 100000 }], 50000, '2025-11-01');
    expect(r.snowball.feasible).toBe(false);
  });
});

describe('detectores', () => {
  it('encuentra suscripciones mensuales', () => {
    const txs = ['2025-08-08', '2025-09-08', '2025-10-08'].map((d) => tx({ kind: 'expense', amountCents: 29900, date: d, merchant: 'Netflix', description: 'Netflix', categoryId: 'subscriptions' }));
    txs.push(tx({ kind: 'expense', amountCents: 12000, date: '2025-10-01', description: 'tacos' }));
    const subs = detectSubscriptions(txs, [], '2025-10-20');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.frequency).toBe('monthly');
    expect(subs[0]!.nextDate).toBe('2025-11-07');
  });
  it('suma gastos hormiga con equivalencia', () => {
    const txs = Array.from({ length: 20 }, (_, i) => tx({ kind: 'expense', amountCents: 5500, date: `2025-11-${String(i + 1).padStart(2, '0')}`, categoryId: 'coffee', description: 'café' }));
    const ant = antExpenses(txs, '2025-11-01', '2025-11-30');
    expect(ant.totalCents).toBe(110000);
    expect(ant.equivalence).toEqual({ qty: 20, label: 'cafés', emoji: '☕' });
  });
});

describe('presupuestos', () => {
  it('marca alerta al 80 % y excedido al 100 %', () => {
    const lines = budgetProgress(
      { id: '2025-11', method: 'category', lines: { food: { assignedCents: 10000, rollover: false }, gas: { assignedCents: 10000, rollover: false } } },
      { food: 8500, gas: 12000 },
    );
    expect(lines.find((l) => l.categoryId === 'food')!.status).toBe('warn');
    expect(lines.find((l) => l.categoryId === 'gas')!.status).toBe('over');
  });
  it('50/30/20 por grupos', () => {
    const r = fiftyThirtyTwenty(3000000, { housing: 1500000, food: 600000 }, buildDefaultCategories(), 600000);
    expect(r.groups.map((g) => g.actualPct)).toEqual([50, 20, 20]);
  });
});

describe('personas y pareja', () => {
  it('saldos por persona', () => {
    const r = balancesByPerson(
      [{ id: 'l', person: 'Juan', direction: 'lent', amountCents: 50000, paidCents: 20000, createdAt: now, closed: false }],
      [{ id: 's', description: 'Cena', totalCents: 90000, date: '2025-11-01', createdAt: now, participants: [{ name: 'Yo', shareCents: 30000, paid: true, isMe: true }, { name: 'juan', shareCents: 30000, paid: false, isMe: false }] }],
    );
    expect(r[0]).toMatchObject({ person: 'Juan', netCents: 60000 });
  });
  it('cuentas claras en pareja (proporcional al ingreso)', () => {
    const hh = { id: 'h', name: 'Casa', members: ['a', 'b'], memberNames: { a: 'Ana', b: 'Beto' }, splitMode: 'income' as const, weights: { a: 60, b: 40 }, createdBy: 'a', createdAt: now };
    const r = coupleBalance(hh, [
      tx({ kind: 'expense', amountCents: 100000, date: '2025-11-01', createdBy: 'a' }),
      tx({ kind: 'expense', amountCents: 100000, date: '2025-11-02', createdBy: 'a' }),
    ]);
    expect(r.members.find((m) => m.uid === 'b')!.fairShareCents).toBe(80000);
    expect(r.settlement).toEqual({ fromUid: 'b', toUid: 'a', amountCents: 80000 });
  });
});

describe('tandas', () => {
  it('sabe cuándo te toca', () => {
    const t = { id: 't', name: 'Oficina', contributionCents: 50000, participants: 10, myTurn: 3, frequency: 'biweekly' as const, startDate: '2025-11-01', received: false, createdAt: now, archived: false };
    const s = tandaStatus(t, '2025-11-20');
    expect(s.myPayoutDate).toBe('2025-11-29');
    expect(s.potCents).toBe(500000);
    expect(s.paidRounds).toBe(2);
    expect(s.position).toBe('saving');
  });
});

describe('patrimonio y metas', () => {
  it('activos menos pasivos', () => {
    const accounts = [account({ id: 'cash', type: 'cash' }), account({ id: 'nu', type: 'credit' })];
    const r = netWorth({ accounts, balances: { cash: 100000, nu: -30000 }, investments: [], debts: [], loans: [], splits: [] });
    expect(r.netWorthCents).toBe(70000);
  });
  it('aporte sugerido por quincena', () => {
    const g = goalProgress({ id: 'g', name: 'Viaje', emoji: '✈️', targetCents: 1200000, savedCents: 0, targetDate: '2026-02-28', type: 'normal', createdAt: now, archived: false }, '2025-11-20', { type: 'biweekly', days: [15, 30] });
    expect(g.paychecksLeft).toBe(7);
    expect(g.perPaycheckCents).toBe(171429);
  });
});

describe('CFDI', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Fecha="2025-03-10T10:00:00" SubTotal="862.07" Total="1000.00" Moneda="MXN" TipoDeComprobante="I" FormaPago="04" MetodoPago="PUE">
  <cfdi:Emisor Rfc="CLI010101AAA" Nombre="Clínica Dental Sonrisas" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="Juan" UsoCFDI="D01"/>
  <cfdi:Conceptos><cfdi:Concepto Descripcion="Limpieza dental" Importe="862.07"/></cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="ab12cd34-0000-1111-2222-333344445555"/></cfdi:Complemento>
</cfdi:Comprobante>`;
  it('lee los datos principales', () => {
    const c = parseCfdiXml(xml)!;
    expect(c.totalCents).toBe(100000);
    expect(c.nombreEmisor).toBe('Clínica Dental Sonrisas');
    expect(c.uuid).toBe('AB12CD34-0000-1111-2222-333344445555');
    expect(c.conceptos).toEqual(['Limpieza dental']);
    expect(cfdiDeductibility(c)).toMatchObject({ deductible: true, categoryId: 'medical' });
    expect(cfdiDeductibility({ ...c, formaPago: '01' }).deductible).toBe(false);
  });
});

describe('CSV', () => {
  it('ida y vuelta con comillas y comas', () => {
    const rows = [['fecha', 'concepto', 'monto'], ['2025-11-01', 'Tacos "El Güero", centro', '120.50']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('salud financiera', () => {
  it('califica de 0 a 100', () => {
    const h = financialHealth({ monthlyIncomeCents: 3000000, monthlySpendingCents: 2400000, monthlyEssentialCents: 1500000, emergencySavingsCents: 4500000, monthlyDebtPaymentsCents: 300000, creditUtilizationPct: 20, budgetAdherencePct: 90, activeDaysLast30: 25 });
    expect(h.score).toBeGreaterThanOrEqual(90);
    expect(h.label).toBe('Excelente');
  });
});

describe('datos de ejemplo', () => {
  it('son válidos según los esquemas y se pueden identificar para borrarse', () => {
    const d = generateDemoData('2025-11-20', now);
    expect(d.transactions!.length).toBeGreaterThan(100);
    for (const t of d.transactions!) expect(() => TransactionSchema.parse(t)).not.toThrow();
    for (const a of d.accounts!) expect(() => AccountSchema.parse(a)).not.toThrow();
    expect(d.transactions!.every(isDemoDoc)).toBe(true);
    expect(d.budgets!.every(isDemoDoc)).toBe(true);
    const balances = computeBalances(d.accounts!, d.transactions!);
    const proj = projectCashFlow({ today: '2025-11-20', days: 30, startBalanceCents: (balances.demo_bbva ?? 0) + (balances.demo_cash ?? 0), accounts: d.accounts!, balances, transactions: d.transactions!, recurring: d.recurring!, plans: d.installmentPlans!, tandas: d.tandas!, payday: { type: 'biweekly', days: [15, 30] } });
    expect(proj.days).toHaveLength(31);
    expect(proj.dailyBurnCents).toBeGreaterThan(0);
  });
});
