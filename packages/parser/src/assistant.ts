import {
  addDays,
  addMonthsKey,
  availableMoney,
  balancesByPerson,
  budgetProgress,
  computeBalances,
  creditOwed,
  formatMoney,
  formatMonthKey,
  monthEnd,
  monthKey,
  monthStart,
  nextPayday,
  percent,
  spendingItems,
  startOfWeek,
  topEntries,
  antExpenses,
  type Account,
  type Budget,
  type Category,
  type Debt,
  type InstallmentPlan,
  type ISODate,
  type Loan,
  type PaydaySchedule,
  type Split,
  type Transaction,
} from '@fina/core';
import { monthFromWord } from './dates';
import { findMerchant, guessCategory, normalizeWord, parse } from './parse';

/**
 * "Pregúntale a Fina": responde preguntas con consultas REALES sobre los datos
 * del usuario. Nunca inventa números: si no entiende, lo dice y da ejemplos.
 */

export interface AssistantData {
  today: ISODate;
  transactions: Transaction[];
  categories: Pick<Category, 'id' | 'name' | 'emoji' | 'type'>[];
  accounts: Account[];
  budgets?: Budget[];
  plans?: InstallmentPlan[];
  loans?: Loan[];
  splits?: Split[];
  debts?: Debt[];
  payday?: PaydaySchedule;
}

export interface AssistantAnswer {
  intent: 'spent' | 'income' | 'afford' | 'balance' | 'top' | 'debt' | 'owed' | 'budget' | 'ant' | 'help' | 'unknown';
  text: string;
}

interface Period {
  from: ISODate;
  to: ISODate;
  label: string;
}

function findPeriod(q: string, today: ISODate): Period {
  const mk = monthKey(today);
  if (/\bhoy\b/.test(q)) return { from: today, to: today, label: 'hoy' };
  if (/\bayer\b/.test(q)) return { from: addDays(today, -1), to: addDays(today, -1), label: 'ayer' };
  if (/semana pasada/.test(q)) {
    const s = addDays(startOfWeek(today), -7);
    return { from: s, to: addDays(s, 6), label: 'la semana pasada' };
  }
  if (/(esta|la) semana/.test(q)) return { from: startOfWeek(today), to: today, label: 'esta semana' };
  if (/mes pasado/.test(q)) {
    const k = addMonthsKey(mk, -1);
    return { from: monthStart(k), to: monthEnd(k), label: `en ${formatMonthKey(k, false).toLowerCase()}` };
  }
  if (/(este|el) ano|en el ano/.test(q)) return { from: `${today.slice(0, 4)}-01-01`, to: today, label: 'este año' };
  for (const w of q.split(' ')) {
    const m = monthFromWord(w);
    if (m && w.length >= 4) {
      const year = Number(today.slice(0, 4));
      let k = `${year}-${String(m).padStart(2, '0')}`;
      if (k > mk) k = `${year - 1}-${String(m).padStart(2, '0')}`;
      return { from: monthStart(k), to: monthEnd(k), label: `en ${formatMonthKey(k, false).toLowerCase()}` };
    }
  }
  return { from: monthStart(mk), to: today, label: 'este mes' };
}

const QUESTION_WORDS = /\b(cuanto|cuantos|que|en|el|la|los|las|este|esta|mes|semana|ano|hoy|ayer|gaste|gastado|llevo|he|me|mi|mis|de|del|pasado|pasada|gastamos|lleve|por|para|con|todo|total|dinero|año)\b/g;

const MONTH_WORDS = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/g;

export function askAssistant(question: string, data: AssistantData): AssistantAnswer {
  const q = ` ${question.split(/\s+/).map(normalizeWord).join(' ')} `.replace(/[¿?¡!]/g, '');
  const { today } = data;
  const plans = data.plans ?? [];
  const catName = (id: string) => {
    const c = data.categories.find((x) => x.id === id);
    return c ? `${c.emoji} ${c.name}` : id;
  };

  if (/^\s*(ayuda|que puedes hacer|hola|help)\s*$/.test(q)) return help();

  // ¿Me alcanza para…?
  if (/me alcanza|puedo comprar|puedo gastar|alcanzaria|lo puedo pagar/.test(q)) {
    const parsed = parse(question.replace(/me alcanza( para)?|puedo (comprar|gastar)/gi, ''), { today });
    if (!parsed.ok) return { intent: 'afford', text: 'Dime el precio, por ejemplo: "¿me alcanza para unos tenis de 1800?"' };
    const price = parsed.entry.amountCents;
    const balances = computeBalances(data.accounts, data.transactions);
    const available = availableMoney(data.accounts, balances);
    const np = data.payday ? nextPayday(addDays(today, 1), data.payday) : null;
    const days = np ? Math.max(1, Math.round((Date.parse(np) - Date.parse(today)) / 86_400_000)) : 15;
    const recent = spendingItems(data.transactions, plans, { from: addDays(today, -30), to: today });
    const dailyBurn = Math.round(recent.reduce((s, i) => s + i.amountCents, 0) / 30);
    const needed = dailyBurn * days;
    const left = available - price - needed;
    const what = parsed.entry.description && parsed.entry.description !== 'Gasto' ? parsed.entry.description.toLowerCase() : 'eso';
    if (available <= 0) return { intent: 'afford', text: `Ahorita no veo dinero disponible en tus cuentas. Antes de comprar ${what}, registra tus saldos o tu ingreso.` };
    if (left >= 0) {
      return {
        intent: 'afford',
        text: `✅ Sí te alcanza para ${what} (${formatMoney(price)}). Tienes ${formatMoney(available)} disponibles y, a tu ritmo de ${formatMoney(dailyBurn)} al día, te quedarían unos ${formatMoney(left)}${np ? ` antes de tu pago del ${np.slice(8)}` : ''}.`,
      };
    }
    return {
      intent: 'afford',
      text: `⚠️ Justo no. Tienes ${formatMoney(available)} y a tu ritmo necesitas ~${formatMoney(needed)} para llegar ${np ? `a tu pago del ${np.slice(8)}` : 'a fin de quincena'}. Si compras ${what} (${formatMoney(price)}) te faltarían ${formatMoney(-left)}. ${np ? 'Mejor espera a tu siguiente pago 😉' : ''}`.trim(),
    };
  }

  if (/cuanto (me deben|nos deben)|quien me debe|me deben/.test(q)) {
    const people = balancesByPerson(data.loans ?? [], data.splits ?? []).filter((p) => p.netCents > 0);
    if (!people.length) return { intent: 'owed', text: 'Nadie te debe nada. 🙌' };
    const total = people.reduce((s, p) => s + p.netCents, 0);
    return { intent: 'owed', text: `Te deben ${formatMoney(total)}:\n${people.map((p) => `• ${p.person}: ${formatMoney(p.netCents)}`).join('\n')}` };
  }

  if (/cuanto debo|mis deudas|que debo|cuanto le debo/.test(q)) {
    const balances = computeBalances(data.accounts, data.transactions);
    const cards = creditOwed(data.accounts, balances);
    const debts = (data.debts ?? []).filter((d) => !d.archived).reduce((s, d) => s + d.balanceCents, 0);
    const people = balancesByPerson(data.loans ?? [], data.splits ?? []).filter((p) => p.netCents < 0).reduce((s, p) => s - p.netCents, 0);
    const total = cards + debts + people;
    if (!total) return { intent: 'debt', text: '¡No tienes deudas registradas! 🎉' };
    const parts = [cards && `tarjetas ${formatMoney(cards)}`, debts && `créditos ${formatMoney(debts)}`, people && `personas ${formatMoney(people)}`].filter(Boolean);
    return { intent: 'debt', text: `Debes ${formatMoney(total)} en total (${parts.join(', ')}).` };
  }

  if (/saldo|cuanto tengo|dinero disponible|cuanto me queda/.test(q) && !/presupuesto/.test(q)) {
    const balances = computeBalances(data.accounts, data.transactions);
    const active = data.accounts.filter((a) => !a.archived);
    const available = availableMoney(data.accounts, balances);
    const lines = active.map((a) => `• ${a.icon} ${a.name}: ${formatMoney(balances[a.id] ?? 0)}`);
    return { intent: 'balance', text: `Tienes ${formatMoney(available)} disponibles.\n${lines.join('\n')}` };
  }

  if (/presupuesto/.test(q)) {
    const mk = monthKey(today);
    const budget = data.budgets?.find((b) => b.id === mk);
    if (!budget || !Object.keys(budget.lines).length) return { intent: 'budget', text: 'Aún no tienes presupuesto este mes. Créalo en la pestaña Presupuesto.' };
    const items = spendingItems(data.transactions, plans, { from: monthStart(mk), to: today });
    const spent: Record<string, number> = {};
    for (const i of items) spent[i.categoryId] = (spent[i.categoryId] ?? 0) + i.amountCents;
    const lines = budgetProgress(budget, spent);
    const rest = q.replace(/presupuesto|de|del|mi|como|voy|en|el|la/g, ' ').trim();
    const cat = rest ? guessCategory(rest)?.categoryId : undefined;
    const filtered = cat ? lines.filter((l) => l.categoryId === cat) : lines;
    if (!filtered.length) return { intent: 'budget', text: `No tienes presupuesto para ${cat ? catName(cat) : 'esa categoría'} este mes.` };
    return {
      intent: 'budget',
      text: filtered
        .slice(0, 6)
        .map((l) => `${l.status === 'over' ? '🔴' : l.status === 'warn' ? '🟡' : '🟢'} ${catName(l.categoryId)}: ${formatMoney(l.spentCents)} de ${formatMoney(l.assignedCents + l.carriedCents)} (${l.pct} %)`)
        .join('\n'),
    };
  }

  if (/hormiga/.test(q)) {
    const p = findPeriod(q, today);
    const ant = antExpenses(data.transactions, p.from, p.to);
    if (!ant.count) return { intent: 'ant', text: `Sin gastos hormiga ${p.label}. ¡Bien! 🐜❌` };
    return { intent: 'ant', text: `Tus gastos hormiga ${p.label}: ${formatMoney(ant.totalCents)} en ${ant.count} compras = ${ant.equivalence.qty} ${ant.equivalence.label} ${ant.equivalence.emoji}` };
  }

  if (/en que (gasto|gaste|se me va|gastamos) mas|mayor gasto|donde se me va|en que se me va/.test(q)) {
    const p = findPeriod(q, today);
    const items = spendingItems(data.transactions, plans, p);
    const by: Record<string, number> = {};
    for (const i of items) by[i.categoryId] = (by[i.categoryId] ?? 0) + i.amountCents;
    const total = items.reduce((s, i) => s + i.amountCents, 0);
    const top = topEntries(by, 5);
    if (!top.length) return { intent: 'top', text: `No hay gastos registrados ${p.label}.` };
    return { intent: 'top', text: `${capitalizeFirst(p.label)} gastaste ${formatMoney(total)}. Lo que más pesa:\n${top.map(([c, v], i) => `${i + 1}. ${catName(c)}: ${formatMoney(v)} (${percent(v, total)} %)`).join('\n')}` };
  }

  if (/cuanto (gane|me pagaron|ingrese|me entro|cobre)|mis ingresos/.test(q)) {
    const p = findPeriod(q, today);
    const total = data.transactions.filter((t) => t.kind === 'income' && t.date >= p.from && t.date <= p.to).reduce((s, t) => s + t.amountMxnCents, 0);
    return { intent: 'income', text: `${capitalizeFirst(p.label)} te entraron ${formatMoney(total)}.` };
  }

  if (/cuanto|gaste|gastado|llevo/.test(q)) {
    const p = findPeriod(q, today);
    const rest = q.replace(QUESTION_WORDS, ' ').replace(MONTH_WORDS, ' ').replace(/\s+/g, ' ').trim();
    let items = spendingItems(data.transactions, plans, p);
    let label = '';
    if (rest) {
      const merchant = findMerchant(rest);
      const cat = guessCategory(rest)?.categoryId ?? data.categories.find((c) => normalizeWord(c.name).includes(rest))?.id;
      if (merchant) {
        const key = (s: string) => s.split(/\s+/).map(normalizeWord).join(' ');
        const target = key(merchant.name);
        items = items.filter((i) => (i.tx.merchant ? key(i.tx.merchant) === target : findMerchant(i.tx.description)?.name === merchant.name));
        label = ` en ${merchant.name}`;
      } else if (cat) {
        items = items.filter((i) => i.categoryId === cat);
        label = ` en ${catName(cat)}`;
      } else {
        items = items.filter((i) => normalizeWord(`${i.tx.description} ${i.tx.merchant ?? ''}`).includes(rest));
        label = ` en "${rest}"`;
      }
    }
    const total = items.reduce((s, i) => s + i.amountCents, 0);
    if (!items.length) return { intent: 'spent', text: `No encontré gastos${label} ${p.label}.` };
    return { intent: 'spent', text: `${capitalizeFirst(p.label)} llevas ${formatMoney(total)}${label} (${items.length} ${items.length === 1 ? 'movimiento' : 'movimientos'}).` };
  }

  return { intent: 'unknown', text: `No entendí la pregunta. ${help().text}` };
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function help(): AssistantAnswer {
  return {
    intent: 'help',
    text: 'Puedes preguntarme cosas como:\n• ¿Cuánto gasté en Uber en octubre?\n• ¿En qué se me va el dinero este mes?\n• ¿Me alcanza para unos tenis de 1,800?\n• ¿Cómo voy con mi presupuesto de comida?\n• ¿Cuánto debo? / ¿Quién me debe?\n• Mis gastos hormiga',
  };
}
