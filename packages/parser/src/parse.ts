import {
  INSTITUTIONS,
  convertToMxn,
  todayISO,
  toCents,
  type AccountType,
  type ISODate,
  type TxKind,
} from '@fina/core';
import { findDate } from './dates';
import { ACRONYMS, EMOJI_CATEGORIES, GENERIC_KEYWORDS, INCOME_CATEGORIES, KEYWORDS, MERCHANTS, STOPWORDS } from './dictionary';
import { allowedDistance, editDistance } from './fuzzy';
import { isNumberWord, parseNumericToken, wordsToNumber } from './numbers';

// ——————————————————— Tipos públicos ———————————————————

export type Recurrence = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface ParsedEntry {
  kind: TxKind;
  /** Siempre positivo, en la moneda indicada. */
  amountCents: number;
  currency: string;
  /** Convertido a MXN con el tipo de cambio del contexto (o de respaldo). */
  amountMxnCents: number;
  fxRate: number;
  description: string;
  merchant?: string;
  categoryId?: string;
  categorySource?: 'rule' | 'merchant' | 'keyword' | 'emoji' | 'fuzzy' | 'kind' | 'ai';
  /** Institución o nombre de cuenta mencionada ("bbva", "nu", "cash"). */
  accountHint?: string;
  toAccountHint?: string;
  /** Resueltos contra las cuentas del usuario (si se pasaron en el contexto). */
  accountId?: string;
  toAccountId?: string;
  /** "tarjeta", "débito"… cuando no se nombró el banco. */
  accountTypeHint?: AccountType;
  date: ISODate;
  person?: string;
  splitCount?: number;
  installments?: number;
  recurrence?: Recurrence;
  tags: string[];
  /** Para aportaciones: a qué se destina ("tanda", "investment", "goal"). */
  target?: 'tanda' | 'investment' | 'goal';
  targetName?: string;
  confidence: number;
  rawText: string;
}

export type ParseResult =
  | { ok: true; entry: ParsedEntry }
  | { ok: false; error: 'empty' | 'no_amount'; message: string; partial: Partial<ParsedEntry> };

export interface ParseContextAccount {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  aliases?: string[];
  archived?: boolean;
}

export interface LearnedRule {
  /** Texto normalizado a buscar (palabra o frase). */
  pattern: string;
  categoryId?: string;
  accountId?: string;
  tags?: string[];
}

export interface ParseContext {
  today?: ISODate;
  accounts?: ParseContextAccount[];
  rules?: LearnedRule[];
  /** Personas con préstamos abiertos: { nombre: 'lent' | 'borrowed' } */
  people?: Record<string, 'lent' | 'borrowed'>;
  fxRates?: Record<string, number>;
  defaultCurrency?: string;
}

// ——————————————————— Normalización ———————————————————

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9$.,+\-−/&'#:]/g, '')
    .replace(/^[.,:'/]+|[.,:'!?/]+$/g, (m, offset: number, str: string) => (/\d/.test(str) && m === '.' && offset === 0 ? m : ''));
}

interface Token {
  raw: string;
  norm: string;
  used: boolean;
}

const EMOJI_RE = /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*/gu;
const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const piece of text.split(/\s+/)) {
    if (!piece) continue;
    // "12msi" → "12" "msi", "200dls" → "200" "dls"
    const m = piece.match(/^([+\-−]?\$?\d[\d,.]*)(msi|dls|dlls|usd|mxn|pesos|euros|eur|meses|x)$/i);
    if (m) {
      out.push(mk(m[1]!), mk(m[2]!));
      continue;
    }
    // "$" suelto pegado al número siguiente se resuelve después
    out.push(mk(piece));
  }
  return out.filter((t) => t.norm !== '' || t.raw === '$');

  function mk(raw: string): Token {
    const cleanRaw = raw.replace(/^[¿¡("']+|[)"'!?¡¿:;]+$/g, '').replace(/,$/, '');
    return { raw: cleanRaw, norm: normalizeWord(cleanRaw), used: false };
  }
}

// ——————————————————— Utilidades ———————————————————

const CURRENCY_WORDS: Record<string, string> = {
  pesos: 'MXN', peso: 'MXN', mxn: 'MXN', varos: 'MXN', baros: 'MXN', mx: 'MXN',
  dls: 'USD', dlls: 'USD', dll: 'USD', dolares: 'USD', dolar: 'USD', usd: 'USD', 'us$': 'USD', dlrs: 'USD',
  euros: 'EUR', euro: 'EUR', eur: 'EUR',
};

const NUMBER_WORDS_SMALL: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleName(s: string): string {
  return s
    .split(' ')
    .map((w) => capitalize(w.toLowerCase()))
    .join(' ');
}

const PERSON_BLOCKLIST = new Set([
  'ya', 'hoy', 'ayer', 'jefe', 'jefa', 'mi', 'el', 'la', 'cliente', 'empresa', 'trabajo', 'banco', 'nomina', 'patron',
  'se', 'me', 'te', 'que', 'quien', 'alguien', 'todos', 'gobierno', 'imss', 'sat', 'tanda', 'lo', 'le', 'y', 'tambien',
]);

/** Prefijos que no forman parte de la descripción. */
const LEADING_VERBS = new Set(['gaste', 'pague', 'compre', 'fui', 'me', 'nos', 'gastamos', 'pagamos', 'compramos', 'puse', 'di', 'deje']);

// ——————————————————— Parser principal ———————————————————

export function parse(text: string, ctx: ParseContext = {}): ParseResult {
  const today = ctx.today ?? todayISO();
  const rawText = text.trim();
  if (!rawText) return { ok: false, error: 'empty', message: 'Escribe algo como: galleta 30', partial: {} };

  // 1) Etiquetas y emojis
  const tags: string[] = [];
  let body = rawText.replace(TAG_RE, (_, tag: string) => {
    tags.push(normalizeWord(tag).replace(/[^a-z0-9_-]/g, ''));
    return ' ';
  });
  let emojiCategory: string | undefined;
  body = body.replace(EMOJI_RE, (e) => {
    const base = e.replace(/️/g, '');
    emojiCategory ??= EMOJI_CATEGORIES[e] ?? EMOJI_CATEGORIES[base];
    return ' ';
  });

  const tokens = tokenize(body);
  const norms = () => tokens.map((t) => t.norm);
  const use = (...idx: number[]) => idx.forEach((i) => tokens[i] && (tokens[i]!.used = true));
  const free = (i: number) => !!tokens[i] && !tokens[i]!.used;

  // 2) Signo explícito al inicio (+ ingreso, − gasto)
  let forcedSign: 1 | -1 | 0 = 0;
  const first = tokens[0];
  if (first && /^[+]/.test(first.norm)) forcedSign = 1;
  else if (first && /^[-−]/.test(first.norm)) forcedSign = -1;
  if (first && (first.norm === '+' || first.norm === '-')) use(0);

  // 3) Fecha
  let date = today;
  const dm = findDate(norms(), today);
  if (dm) {
    date = dm.date;
    use(...dm.consumed);
  }

  const N = norms();
  // 4) Meses sin intereses: "a 12 msi", "12 meses sin intereses", "a 6 meses"
  let installments: number | undefined;
  for (let i = 0; i < N.length; i++) {
    const n = Number(N[i]) || NUMBER_WORDS_SMALL[N[i]!];
    const nx = N[i + 1];
    if (n && Number.isInteger(n) && n >= 2 && n <= 60 && (nx === 'msi' || nx === 'mensualidades' || (nx === 'meses' && (N[i - 1] === 'a' || N[i + 2] === 'sin')))) {
      installments = n;
      use(i, i + 1);
      if (N[i - 1] === 'a') use(i - 1);
      if (N[i + 2] === 'sin' && /^intereses?$/.test(N[i + 3] ?? '')) use(i + 2, i + 3);
      break;
    }
  }
  const msiIdx = N.indexOf('msi');
  if (msiIdx >= 0 && free(msiIdx)) use(msiIdx);

  // 5) Gastos compartidos: "entre 3", "a medias"
  let splitCount: number | undefined;
  for (let i = 0; i < N.length; i++) {
    if (N[i] === 'entre' && N[i + 1]) {
      const n = Number(N[i + 1]) || NUMBER_WORDS_SMALL[N[i + 1]!];
      if (n && n >= 2 && n <= 50) {
        splitCount = n;
        use(i, i + 1);
        if (/^(personas|amigos|nosotros|todos)$/.test(N[i + 2] ?? '')) use(i + 2);
        break;
      }
    }
    if (N[i] === 'a' && N[i + 1] === 'medias') {
      splitCount = 2;
      use(i, i + 1);
    }
    if (N[i] === 'mitad' && N[i + 1] === 'y' && N[i + 2] === 'mitad') {
      splitCount = 2;
      use(i, i + 1, i + 2);
    }
  }

  // 6) Recurrencia
  let recurrence: Recurrence | undefined;
  for (let i = 0; i < N.length; i++) {
    const w = N[i]!;
    const nx = N[i + 1];
    if (w === 'cada' && nx) {
      const map: Record<string, Recurrence> = { mes: 'monthly', semana: 'weekly', quincena: 'biweekly', ano: 'yearly', year: 'yearly' };
      if (map[nx]) {
        recurrence = map[nx];
        use(i, i + 1);
        break;
      }
      if (nx === '15' && N[i + 2] === 'dias') {
        recurrence = 'biweekly';
        use(i, i + 1, i + 2);
        break;
      }
    }
    if (/^(mensual|mensuales|mensualmente)$/.test(w)) recurrence = 'monthly';
    else if (/^(semanal|semanales|semanalmente)$/.test(w)) recurrence = 'weekly';
    else if (/^(quincenal|quincenales)$/.test(w)) recurrence = 'biweekly';
    else if (/^(anual|anuales|anualmente)$/.test(w)) recurrence = 'yearly';
    if (recurrence) {
      use(i);
      break;
    }
    if ((w === 'al' || w === 'por') && nx === 'mes' && !installments) {
      recurrence = 'monthly';
      use(i, i + 1);
      break;
    }
  }

  // 7) Comercios conocidos (frases de hasta 3 palabras, la más larga gana)
  let merchant: string | undefined;
  let merchantCategory: string | undefined;
  const merchantIdx: number[] = [];
  outer: for (let len = 3; len >= 1; len--) {
    for (let i = 0; i + len <= N.length; i++) {
      const idx = Array.from({ length: len }, (_, k) => i + k);
      if (!idx.every(free)) continue;
      const phrase = idx.map((k) => N[k]).join(' ');
      const info = MERCHANTS[phrase];
      if (info) {
        merchant = info.name;
        merchantCategory = info.categoryId;
        merchantIdx.push(...idx);
        break outer;
      }
    }
  }

  // 8) Menciones de cuentas: "con bbva", "de la tarjeta nu", "a efectivo", "por mercado pago"
  interface Mention {
    hint: string;
    accountId?: string;
    prep?: string;
    cardWord: boolean;
    idx: number[];
    instType?: AccountType;
  }
  const mentions: Mention[] = [];
  let accountTypeHint: AccountType | undefined;
  const aliasTable: Array<{ words: string[]; hint: string; accountId?: string; retail: boolean; instType?: AccountType }> = [];
  for (const acc of ctx.accounts ?? []) {
    if (acc.archived) continue;
    const names = [acc.name, ...(acc.aliases ?? [])].map((n) => n.split(/\s+/).map(normalizeWord).filter(Boolean));
    for (const words of names) if (words.length) aliasTable.push({ words, hint: acc.institution ?? normalizeWord(acc.name), accountId: acc.id, retail: false, instType: acc.type });
  }
  for (const inst of INSTITUTIONS) {
    for (const alias of inst.aliases) aliasTable.push({ words: alias.split(' '), hint: inst.id, retail: inst.kind === 'retail', instType: inst.defaultType });
  }
  aliasTable.sort((a, b) => b.words.length - a.words.length);
  const PREPS = new Set(['con', 'de', 'desde', 'a', 'al', 'en', 'por', 'hacia', 'para']);
  const FILLERS = new Set(['la', 'el', 'mi', 'tarjeta', 'cuenta', 'tdc', 'credito', 'debito', 'mis']);
  for (let i = 0; i < N.length; i++) {
    if (!free(i)) continue;
    const hit = aliasTable.find((a) => a.words.every((w, k) => N[i + k] === w && free(i + k)));
    if (!hit) continue;
    const idx = hit.words.map((_, k) => i + k);
    let j = i - 1;
    let cardWord = false;
    while (j >= 0 && free(j) && FILLERS.has(N[j]!)) {
      if (/^(tarjeta|tdc|credito)$/.test(N[j]!)) cardWord = true;
      idx.unshift(j);
      j--;
    }
    let prep: string | undefined;
    if (j >= 0 && free(j) && PREPS.has(N[j]!)) {
      prep = N[j];
      idx.unshift(j);
    }
    // Las tiendas departamentales solo cuentan como cuenta si dice "con"/"tarjeta".
    if (hit.retail && !cardWord && prep !== 'con') continue;
    // Si la palabra también es un comercio (y no dice "con"), es comercio.
    if (merchantIdx.includes(i) && prep !== 'con' && !cardWord) continue;
    // "en efectivo" consume "en"; "a efectivo" en transferencias también.
    mentions.push({ hint: hit.hint, accountId: hit.accountId, prep, cardWord, idx, instType: hit.instType });
    use(...idx);
    i = idx[idx.length - 1]!;
  }
  // "con tarjeta", "con débito", "con crédito", "tdc"
  for (let i = 0; i < N.length; i++) {
    if (!free(i)) continue;
    if ((N[i] === 'con' || N[i] === 'en') && /^(tarjeta|tdc|credito|debito)$/.test(N[i + 1] ?? '') && free(i + 1)) {
      accountTypeHint = N[i + 1] === 'debito' ? 'debit' : 'credit';
      use(i, i + 1);
      if (/^(de)$/.test(N[i + 2] ?? '') && /^(credito|debito)$/.test(N[i + 3] ?? '')) {
        accountTypeHint = N[i + 3] === 'debito' ? 'debit' : 'credit';
        use(i + 2, i + 3);
      }
    }
    if ((N[i] === 'por' || N[i] === 'con') && /^(spei|transferencia)$/.test(N[i + 1] ?? '')) use(i, i + 1);
  }
  merchantIdx.forEach((i) => use(i));

  // 9) Moneda
  let currency = ctx.defaultCurrency ?? 'MXN';
  const currencyIdx = new Set<number>();
  for (let i = 0; i < N.length; i++) {
    const c = CURRENCY_WORDS[N[i]!];
    if (c && free(i)) {
      currency = c;
      currencyIdx.add(i);
      use(i);
    }
  }
  if (tokens.some((t) => t.raw.includes('€'))) currency = 'EUR';
  if (tokens.some((t) => /us\$/i.test(t.raw))) currency = 'USD';

  // 10) Monto
  interface Cand {
    idx: number[];
    value: number;
    marked: boolean;
    sign: 1 | -1 | 0;
    words: boolean;
  }
  const cands: Cand[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) continue;
    let norm = N[i]!;
    const idx = [i];
    let markedBySymbol = false;
    if (norm === '$' && tokens[i + 1] && free(i + 1)) {
      norm = N[i + 1]!;
      idx.push(i + 1);
      markedBySymbol = true;
    }
    const p = parseNumericToken(norm);
    if (!p) continue;
    let value = p.value;
    const last = idx[idx.length - 1]!;
    const after = N[last + 1];
    if ((after === 'mil' || after === 'k') && free(last + 1)) {
      value *= 1000;
      idx.push(last + 1);
    } else if ((after === 'millones' || after === 'millon') && free(last + 1)) {
      value *= 1_000_000;
      idx.push(last + 1);
    }
    const marked = markedBySymbol || p.hasCurrencySymbol || p.multiplier || idx.length > 1 || currencyIdx.has(last + 1) || currencyIdx.has(i - 1);
    cands.push({ idx, value, marked, sign: p.sign, words: false });
    i = idx[idx.length - 1]!;
  }
  if (cands.length === 0) {
    // Números escritos con letra ("mil doscientos", "quince mil")
    for (let i = 0; i < tokens.length; i++) {
      if (!free(i) || !isNumberWord(N[i]!)) continue;
      const idx: number[] = [];
      let j = i;
      while (j < tokens.length && free(j) && (isNumberWord(N[j]!) || (N[j] === 'y' && isNumberWord(N[j + 1] ?? '')))) idx.push(j++);
      const words = idx.map((k) => N[k]!);
      const value = wordsToNumber(words);
      const strong = words.some((w) => w === 'mil' || w.startsWith('cien') || w.endsWith('cientos') || w.endsWith('cientas') || w.startsWith('millon'));
      const marked = currencyIdx.has(j);
      if (value !== null && (value >= 20 || strong || marked)) cands.push({ idx, value, marked, sign: 0, words: true });
      i = j;
    }
  }

  let amountCand: Cand | undefined;
  const markedC = cands.filter((c) => c.marked);
  if (markedC.length) amountCand = markedC[0];
  else if (cands.length === 1) amountCand = cands[0];
  else if (cands.length > 1) {
    const lastC = cands[cands.length - 1]!;
    amountCand = lastC.value <= 10 && Number.isInteger(lastC.value) ? cands.reduce((a, b) => (b.value > a.value ? b : a)) : lastC;
  }
  if (amountCand) use(...amountCand.idx);
  if (amountCand?.sign && !forcedSign) forcedSign = amountCand.sign;

  // 11) Tipo de movimiento
  const nt = ` ${N.join(' ')} `;
  const has = (re: RegExp) => re.test(nt);
  let kind: TxKind = 'expense';
  let person: string | undefined;
  let target: ParsedEntry['target'];
  let targetName: string | undefined;
  let categoryFromKind: string | undefined;
  let descriptionOverride: string | undefined;

  const findPersonAfter = (startIdx: number): string | undefined => {
    for (let i = startIdx; i < tokens.length; i++) {
      if (!free(i)) continue;
      const w = N[i]!;
      if (STOPWORDS.has(w) || PERSON_BLOCKLIST.has(w) || /\d/.test(w)) continue;
      const parts = [i];
      if (free(i + 1) && /^[A-ZÁÉÍÓÚÑ]/.test(tokens[i + 1]!.raw) && !STOPWORDS.has(N[i + 1]!)) parts.push(i + 1);
      use(...parts);
      return titleName(parts.map((k) => tokens[k]!.raw).join(' '));
    }
    return undefined;
  };
  const wordIndex = (w: string, from = 0) => N.findIndex((x, i) => i >= from && x === w);

  const peopleLower = Object.fromEntries(Object.entries(ctx.people ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const looksLikeName = (i: number): boolean => {
    const t = tokens[i];
    if (!t || PERSON_BLOCKLIST.has(t.norm) || STOPWORDS.has(t.norm) || /\d/.test(t.norm)) return false;
    if (peopleLower[t.norm]) return true;
    if (/^[A-ZÁÉÍÓÚÑ]/.test(t.raw)) return true;
    return !Object.values(KEYWORDS).some((ws) => ws.includes(t.norm)) && !MERCHANTS[t.norm] && t.norm.length >= 3;
  };

  if (forcedSign === 1) {
    kind = 'income';
  } else if (has(/ (preste|prestee|prestamos a|di prestado|prestamo a) /)) {
    kind = 'loan_given';
    const vi = N.findIndex((w) => /^(preste|prestee|prestado|prestamo)$/.test(w));
    const ai = wordIndex('a', vi);
    person = findPersonAfter(ai >= 0 ? ai + 1 : vi + 1);
    N.forEach((w, i) => /^(le|preste|prestee|di|prestado|prestamo|a)$/.test(w) && use(i));
  } else if (has(/ (me presto|me prestaron|me prestaste|pedi prestado|prestamo de) /)) {
    kind = 'loan_received';
    const mi = N.findIndex((w, i) => (w === 'me' && /^prest/.test(N[i + 1] ?? '')) || w === 'pedi' || (w === 'prestamo' && N[i + 1] === 'de'));
    if (mi > 0 && looksLikeName(mi - 1)) {
      person = titleName(tokens[mi - 1]!.raw);
      use(mi - 1);
    } else person = findPersonAfter(mi + 1);
    N.forEach((w, i) => /^(me|presto|prestaron|prestaste|pedi|prestado|prestamo|de|a)$/.test(w) && use(i));
  } else if (has(/ me (pago|devolvio|regreso|abono) /)) {
    const mi = N.findIndex((w, i) => w === 'me' && /^(pago|devolvio|regreso|abono)$/.test(N[i + 1] ?? ''));
    let p: string | undefined;
    if (mi > 0 && looksLikeName(mi - 1)) {
      p = titleName(tokens[mi - 1]!.raw);
      use(mi - 1);
    } else {
      const after = tokens.findIndex((_, i) => i > mi + 1 && free(i) && looksLikeName(i));
      if (after > 0) {
        p = titleName(tokens[after]!.raw);
        use(after);
      }
    }
    if (p) {
      kind = 'loan_collected';
      person = p;
      use(mi, mi + 1);
    } else {
      kind = 'income';
    }
  } else if (has(/ le (pague|devolvi|regrese|abone) /) && Object.keys(peopleLower).length) {
    const vi = N.findIndex((w) => /^(pague|devolvi|regrese|abone)$/.test(w));
    const ai = wordIndex('a', vi);
    const cand = ai >= 0 ? tokens[ai + 1]?.norm : undefined;
    if (cand && peopleLower[cand] === 'borrowed') {
      kind = 'loan_repaid';
      person = titleName(tokens[ai + 1]!.raw);
      use(vi - 1, vi, ai, ai + 1);
    }
  }

  const debtVerb = / (pague|pago|abone|abono|liquide|liquidar) /;
  const cardMentioned = has(/ (tarjeta|tdc|credito) /) && !has(/ (con|en) (la |mi )?(tarjeta|tdc|credito) /);
  const creditMention = mentions.find((m) => m.cardWord || m.instType === 'credit');
  if (kind === 'expense' && !forcedSign && has(debtVerb) && (cardMentioned || (creditMention && (creditMention.prep === 'a' || creditMention.prep === 'de') && !merchant))) {
    kind = 'debt_payment';
  }

  const transferVerb = / (pase|transferi|transfiero|movi|mande|traspase|traspaso|deposite|transferencia|transferi) /;
  const withdrawVerb = / (retire|retiro|saque|sacar|retirar) /;
  const saveVerb = / (ahorre|aparte|guarde|ahorrar) /;
  if (kind === 'expense' && !forcedSign) {
    if (has(withdrawVerb) && !merchant) {
      kind = 'transfer';
      descriptionOverride = 'Retiro de efectivo';
      if (!mentions.some((m) => m.hint === 'cash')) mentions.push({ hint: 'cash', prep: 'a', cardWord: false, idx: [] });
      N.forEach((w, i) => /^(retire|retiro|saque|sacar|retirar|cajero|del|de|en|el|atm)$/.test(w) && free(i) && use(i));
    } else if (has(saveVerb)) {
      kind = 'transfer';
      target = 'goal';
      descriptionOverride = 'Ahorro';
      const pi = N.findIndex((w) => w === 'para');
      if (pi >= 0) {
        const rest = tokens.slice(pi + 1).filter((t, k) => free(pi + 1 + k) && !STOPWORDS.has(t.norm)).map((t) => t.raw);
        if (rest.length) {
          targetName = rest.join(' ');
          descriptionOverride = `Ahorro para ${targetName}`;
        }
      }
      tokens.forEach((t, i) => i > (pi >= 0 ? pi - 1 : -1) && free(i) && use(i));
      N.forEach((w, i) => /^(ahorre|aparte|guarde|ahorrar)$/.test(w) && use(i));
      if (!mentions.some((m) => m.prep === 'a' || m.prep === 'al' || m.prep === 'en')) mentions.push({ hint: 'savings', prep: 'a', cardWord: false, idx: [] });
    } else if (has(transferVerb) && mentions.length > 0) {
      kind = 'transfer';
      N.forEach((w, i) => /^(pase|transferi|transfiero|movi|mande|traspase|traspaso|deposite|transferencia)$/.test(w) && use(i));
    }
  }

  if (kind === 'expense' && !forcedSign && has(/ tanda /)) {
    if (has(/ (me toco|cobre|me dieron|recibi|me entregaron) /)) {
      kind = 'income';
      categoryFromKind = 'tanda_payout';
      descriptionOverride = 'Tanda cobrada';
    } else {
      kind = 'tanda';
      target = 'tanda';
      descriptionOverride = 'Aportación a la tanda';
    }
    N.forEach((w, i) => /^(tanda|la|de|a|me|toco|cobre|dieron|recibi|entregaron|aporte|pague)$/.test(w) && use(i));
  }

  const investRe = / (cetes|afore|gbm|ppr|fondo de inversion|inverti|invertir|inversion|acciones|bitcoin|btc|cripto|criptomonedas|etf|pagare|bonddia|udibonos) /;
  if (kind === 'expense' && !forcedSign && has(investRe)) {
    if (has(/ (rendimiento|rendimientos|gane|intereses|dividendos) /)) {
      kind = 'income';
      categoryFromKind = 'returns';
    } else {
      kind = 'investment';
      target = 'investment';
      const m = nt.match(investRe)![1]!;
      const names: Record<string, string> = { cetes: 'CETES', afore: 'Afore', gbm: 'GBM', ppr: 'PPR', bitcoin: 'Bitcoin', btc: 'Bitcoin', cripto: 'Cripto', criptomonedas: 'Cripto', acciones: 'Acciones', etf: 'ETF', pagare: 'Pagaré', bonddia: 'BONDDIA', udibonos: 'UDIBONOS' };
      targetName = names[m] ?? 'Inversión';
      descriptionOverride = `Aportación a ${targetName}`;
      categoryFromKind = 'investments';
      N.forEach((w, i) => /^(cetes|afore|gbm|ppr|inverti|invertir|inversion|en|a|acciones|bitcoin|btc|cripto|criptomonedas|etf|pagare|bonddia|udibonos|fondo|de)$/.test(w) && use(i));
    }
  }

  const incomeRe =
    / (me pagaron|me depositaron|me cayo|me cayeron|cobre|recibi|ingreso|quincena|sueldo|nomina|salario|aguinaldo|bono|ptu|utilidades|me transfirieron|vendi|venta|gane|me regalaron|reembolso|me devolvieron|me regresaron|cashback|honorarios|freelance|rendimiento|rendimientos|dividendos|prima vacacional|me llego|me mandaron) /;
  if (kind === 'expense' && !forcedSign && has(incomeRe)) kind = 'income';

  // 12) Cuentas según el tipo
  let accountHint: string | undefined;
  let toAccountHint: string | undefined;
  let accountId: string | undefined;
  let toAccountId: string | undefined;
  const setFrom = (m: Mention) => {
    accountHint = m.hint;
    accountId = m.accountId;
    if (m.cardWord) accountTypeHint = 'credit';
  };
  const setTo = (m: Mention) => {
    toAccountHint = m.hint;
    toAccountId = m.accountId;
  };
  if (kind === 'transfer') {
    const fromM = mentions.find((m) => m.prep === 'de' || m.prep === 'desde');
    const toM = mentions.find((m) => m !== fromM && (m.prep === 'a' || m.prep === 'al' || m.prep === 'hacia' || m.prep === 'para' || m.prep === 'en'));
    const rest = mentions.filter((m) => m !== fromM && m !== toM);
    if (fromM) setFrom(fromM);
    if (toM) setTo(toM);
    if (!fromM && rest[0]) setFrom(rest.shift()!);
    if (!toM && rest[0]) setTo(rest.shift()!);
  } else if (kind === 'debt_payment') {
    const toM = mentions.find((m) => m.cardWord || m.instType === 'credit' || m.prep === 'a' || m.prep === 'de') ?? mentions[0];
    if (toM) setTo(toM);
    const fromM = mentions.find((m) => m !== toM);
    if (fromM) setFrom(fromM);
  } else if (mentions[0]) {
    setFrom(mentions[0]);
  }

  // 13) Categoría
  const learned = matchRule(nt, ctx.rules);
  let categoryId: string | undefined;
  let categorySource: ParsedEntry['categorySource'];
  let catConfidence = 0.4;
  if (learned) {
    if (learned.categoryId) {
      categoryId = learned.categoryId;
      categorySource = 'rule';
      catConfidence = 0.95;
    }
    if (learned.accountId && !accountId) accountId = learned.accountId;
    for (const t of learned.tags ?? []) if (!tags.includes(t)) tags.push(t);
  }
  if (!categoryId && categoryFromKind) {
    categoryId = categoryFromKind;
    categorySource = 'kind';
    catConfidence = 0.9;
  }
  if (!categoryId && (kind === 'expense' || kind === 'income')) {
    const guess = guessCategoryFromTokens(N, kind === 'income' ? 'income' : 'expense', merchantCategory, emojiCategory);
    if (guess) {
      categoryId = guess.categoryId;
      categorySource = guess.source;
      catConfidence = guess.confidence;
    } else if (kind === 'income') {
      categoryId = has(/ me pagaron | me depositaron /) ? 'salary' : 'other_income';
      categorySource = 'kind';
      catConfidence = 0.7;
    }
  }
  if (kind === 'income' && categoryId && !INCOME_CATEGORIES.has(categoryId)) {
    categoryId = 'other_income';
    categorySource = 'kind';
    catConfidence = 0.6;
  }
  if (tags.includes('negocio') && kind === 'expense' && categorySource !== 'rule' && !categoryId) categoryId = 'business';

  // 14) Descripción
  let description = descriptionOverride ?? buildDescription(tokens, merchantIdx, kind);
  if (!descriptionOverride) {
    if (kind === 'loan_given') description = `Préstamo a ${person ?? 'alguien'}`;
    else if (kind === 'loan_received') description = `Préstamo de ${person ?? 'alguien'}`;
    else if (kind === 'loan_collected') description = `${person} me pagó`;
    else if (kind === 'loan_repaid') description = `Le pagué a ${person}`;
    else if (kind === 'debt_payment') description = `Pago de tarjeta${toAccountHint ? ` ${prettyHint(toAccountHint, ctx)}` : ''}`;
    else if (kind === 'transfer' && !description) description = 'Transferencia';
  }
  if (merchant && normalizeWord(description.replace(/\s+/g, '')) === normalizeWord(merchant.replace(/[\s'.-]+/g, '')).replace(/[^a-z0-9&+]/g, '')) description = merchant;
  if (!description) description = merchant ?? (kind === 'income' ? defaultIncomeLabel(categoryId) : 'Gasto');
  description = capitalize(description).slice(0, 120);

  const partial: Partial<ParsedEntry> = { kind, description, merchant, categoryId, date, tags, rawText };
  if (!amountCand) {
    return {
      ok: false,
      error: 'no_amount',
      message: `¿Cuánto fue? Escribe el monto, por ejemplo: ${description.toLowerCase()} 30`,
      partial,
    };
  }

  const amountCents = Math.abs(toCents(amountCand.value));
  const { amountMxnCents, rate } = convertToMxn(amountCents, currency, ctx.fxRates);

  // 15) Confianza
  let confidence: number;
  if (kind === 'expense') confidence = catConfidence;
  else if (kind === 'income') confidence = Math.max(0.7, catConfidence);
  else confidence = 0.9;
  if (amountCand.words) confidence -= 0.05;
  if (cands.length > 1 && !amountCand.marked) confidence -= 0.1;
  confidence = Math.max(0.05, Math.min(1, Math.round(confidence * 100) / 100));

  return {
    ok: true,
    entry: {
      kind,
      amountCents,
      currency,
      amountMxnCents,
      fxRate: rate,
      description,
      merchant,
      categoryId,
      categorySource,
      accountHint,
      toAccountHint,
      accountId: accountId ?? resolveAccount(accountHint, ctx.accounts, kind === 'debt_payment' ? 'debit' : accountTypeHint),
      toAccountId: toAccountId ?? resolveAccount(toAccountHint, ctx.accounts, kind === 'debt_payment' ? 'credit' : undefined),
      accountTypeHint,
      date,
      person,
      splitCount,
      installments,
      recurrence,
      tags,
      target,
      targetName,
      confidence,
      rawText,
    },
  };
}

function prettyHint(hint: string, ctx: ParseContext): string {
  const acc = ctx.accounts?.find((a) => a.institution === hint || a.id === hint);
  if (acc) return acc.name;
  return INSTITUTIONS.find((i) => i.id === hint)?.name ?? hint;
}

function defaultIncomeLabel(categoryId?: string): string {
  const labels: Record<string, string> = {
    salary: 'Sueldo',
    bonus: 'Bono',
    freelance: 'Freelance',
    sales: 'Venta',
    returns: 'Rendimientos',
    refunds: 'Reembolso',
    gifts_received: 'Regalo',
    tanda_payout: 'Tanda cobrada',
  };
  return labels[categoryId ?? ''] ?? 'Ingreso';
}

function buildDescription(tokens: Token[], merchantIdx: number[], kind: TxKind): string {
  const keep = tokens.map((t, i) => ({ ...t, i })).filter((t) => !t.used || merchantIdx.includes(t.i));
  // Si hay comercio y además otras palabras, el comercio sale de la descripción.
  const nonMerchant = keep.filter((t) => !merchantIdx.includes(t.i) && !STOPWORDS.has(t.norm) && !LEADING_VERBS.has(t.norm));
  let words = nonMerchant.length > 0 ? keep.filter((t) => !merchantIdx.includes(t.i)) : keep;
  // Quita palabras vacías y verbos al inicio y al final.
  while (words.length && (STOPWORDS.has(words[0]!.norm) || LEADING_VERBS.has(words[0]!.norm) || /^[$+\-−]$/.test(words[0]!.norm))) words = words.slice(1);
  while (words.length && (STOPWORDS.has(words[words.length - 1]!.norm) || /^[$+\-−]$/.test(words[words.length - 1]!.norm))) words = words.slice(0, -1);
  if (kind === 'income') {
    words = words.filter((w) => !/^(me|pagaron|depositaron|cayo|cayeron|cobre|recibi|llego|mandaron|transfirieron)$/.test(w.norm));
  }
  return words
    .map((w) => (ACRONYMS.has(w.norm) ? w.raw.toUpperCase() : w.raw))
    .join(' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

// ——————————————————— Categorías ———————————————————

/** Índice invertido palabra/frase → categoría (se construye una sola vez). */
const KEYWORD_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [cat, words] of Object.entries(KEYWORDS)) for (const w of words) if (!m.has(w)) m.set(w, cat);
  return m;
})();
const SINGLE_KEYWORDS = [...KEYWORD_INDEX.keys()].filter((k) => !k.includes(' '));

export interface CategoryGuess {
  categoryId: string;
  source: 'merchant' | 'keyword' | 'emoji' | 'fuzzy';
  confidence: number;
}

function guessCategoryFromTokens(
  N: string[],
  type: 'expense' | 'income',
  merchantCategory?: string,
  emojiCategory?: string,
): CategoryGuess | null {
  const isAllowed = (cat: string) => (type === 'income' ? INCOME_CATEGORIES.has(cat) : !INCOME_CATEGORIES.has(cat));
  const scores = new Map<string, { score: number; first: number; source: CategoryGuess['source'] }>();
  const add = (cat: string, score: number, pos: number, source: CategoryGuess['source']) => {
    if (!isAllowed(cat)) return;
    const prev = scores.get(cat);
    if (!prev) scores.set(cat, { score, first: pos, source });
    else {
      prev.score += score;
      if (score > 1.5 && source === 'merchant') prev.source = 'merchant';
    }
  };
  if (merchantCategory) add(merchantCategory, 3, -1, 'merchant');
  if (emojiCategory) add(emojiCategory, 1.5, -1, 'emoji');
  const seen = new Set<number>();
  for (let len = 3; len >= 2; len--) {
    for (let i = 0; i + len <= N.length; i++) {
      const phrase = N.slice(i, i + len).join(' ');
      const cat = KEYWORD_INDEX.get(phrase);
      if (cat) {
        add(cat, 2.2, i, 'keyword');
        for (let k = i; k < i + len; k++) seen.add(k);
      }
    }
  }
  for (let i = 0; i < N.length; i++) {
    if (seen.has(i)) continue;
    const w = N[i]!;
    if (w.length < 2 || /\d/.test(w) || STOPWORDS.has(w)) continue;
    const singular = w.endsWith('es') && KEYWORD_INDEX.has(w.slice(0, -2)) ? w.slice(0, -2) : w.endsWith('s') && KEYWORD_INDEX.has(w.slice(0, -1)) ? w.slice(0, -1) : w;
    const cat = KEYWORD_INDEX.get(w) ?? KEYWORD_INDEX.get(singular);
    if (cat) {
      add(cat, GENERIC_KEYWORDS.has(w) || GENERIC_KEYWORDS.has(singular) ? 0.5 : 1, i, 'keyword');
      continue;
    }
    const maxD = allowedDistance(w);
    if (maxD === 0) continue;
    let best: { kw: string; d: number } | null = null;
    for (const kw of SINGLE_KEYWORDS) {
      if (Math.abs(kw.length - w.length) > maxD || kw[0] !== w[0]) continue;
      const d = editDistance(w, kw, maxD);
      if (d <= maxD && (!best || d < best.d)) best = { kw, d };
    }
    if (best) add(KEYWORD_INDEX.get(best.kw)!, 0.8, i, 'fuzzy');
  }
  if (!scores.size) return null;
  const [cat, info] = [...scores.entries()].sort((a, b) => b[1].score - a[1].score || a[1].first - b[1].first)[0]!;
  const confidence =
    info.source === 'merchant' ? 0.9 : info.source === 'emoji' ? 0.8 : info.source === 'fuzzy' ? 0.7 : info.score >= 2 ? 0.9 : info.score >= 1 ? 0.85 : 0.65;
  return { categoryId: cat, source: info.source, confidence };
}

/** Adivina la categoría de un texto libre (para importaciones y correos bancarios). */
export function guessCategory(text: string, type: 'expense' | 'income' = 'expense'): CategoryGuess | null {
  const N = text.split(/\s+/).map(normalizeWord).filter(Boolean);
  let merchantCategory: string | undefined;
  for (let len = 3; len >= 1 && !merchantCategory; len--) {
    for (let i = 0; i + len <= N.length; i++) {
      const info = MERCHANTS[N.slice(i, i + len).join(' ')];
      if (info) {
        merchantCategory = info.categoryId;
        break;
      }
    }
  }
  return guessCategoryFromTokens(N, type, merchantCategory);
}

/** Encuentra un comercio conocido en un texto libre ("COMPRA OXXO SUC 123" → OXXO). */
export function findMerchant(text: string): { name: string; categoryId: string } | null {
  const N = text.split(/[\s*/_-]+/).map(normalizeWord).filter(Boolean);
  for (let len = 3; len >= 1; len--) {
    for (let i = 0; i + len <= N.length; i++) {
      const info = MERCHANTS[N.slice(i, i + len).join(' ')];
      if (info) return info;
    }
  }
  return null;
}

function matchRule(nt: string, rules?: LearnedRule[]): LearnedRule | undefined {
  if (!rules?.length) return undefined;
  return rules.find((r) => {
    const p = r.pattern.trim();
    return p && nt.includes(` ${p} `);
  });
}

/**
 * Crea la regla personal a partir de una corrección del usuario
 * ("galleta" → Tiendita): usa el comercio o la primera palabra significativa.
 */
export function ruleFromCorrection(entry: Pick<ParsedEntry, 'merchant' | 'description' | 'rawText'>): string | null {
  if (entry.merchant) return normalizeWord(entry.merchant.split(' ')[0]!);
  const words = (entry.description || entry.rawText)
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !LEADING_VERBS.has(w) && !/\d/.test(w));
  return words[0] ?? null;
}

// ——————————————————— Cuentas ———————————————————

export function resolveAccount(hint: string | undefined, accounts: ParseContextAccount[] | undefined, preferType?: AccountType): string | undefined {
  if (!hint || !accounts?.length) return undefined;
  const active = accounts.filter((a) => !a.archived);
  const matches = active.filter(
    (a) =>
      a.institution === hint ||
      a.id === hint ||
      a.type === hint ||
      (a.aliases ?? []).some((al) => normalizeWord(al) === hint) ||
      normalizeWord(a.name).includes(hint),
  );
  if (hint === 'cash' && !matches.length) return active.find((a) => a.type === 'cash')?.id;
  if (hint === 'savings' && !matches.length) return active.find((a) => a.type === 'savings')?.id;
  if (!matches.length) return undefined;
  if (preferType) {
    const pref = matches.find((a) => a.type === preferType);
    if (pref) return pref.id;
  }
  return matches[0]!.id;
}

// ——————————————————— Varios movimientos en un mensaje ———————————————————

/**
 * "tacos 120, refresco 25, uber 60" → 3 movimientos.
 * Separa por saltos de línea, punto y coma, comas (que no sean de miles) y " y "
 * cuando ambos lados tienen monto. Si el primero dice "ayer", los demás lo heredan.
 */
export function splitEntries(text: string): string[] {
  const hasAmount = (s: string) => /\d/.test(s) || /\b(mil|cien|ciento|cientos|veinte|treinta|cuarenta|cincuenta)\b/i.test(s);
  const pieces = text
    .split(/\n|;|,(?=\s|[^\d\s])/)
    .flatMap((p) => {
      const parts = p.split(/\s+y\s+/i);
      if (parts.length > 1 && parts.every(hasAmount)) return parts;
      return [p];
    })
    .map((p) => p.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const p of pieces) {
    if (!hasAmount(p) && merged.length) merged[merged.length - 1] += ` ${p}`;
    else merged.push(p);
  }
  // Pedazos sin monto al inicio se unen con el siguiente
  if (merged.length > 1 && !hasAmount(merged[0]!)) {
    const [a, b, ...rest] = merged;
    return [`${a} ${b}`, ...rest];
  }
  return merged;
}

export function parseMany(text: string, ctx: ParseContext = {}): ParseResult[] {
  const pieces = splitEntries(text);
  if (pieces.length <= 1) return [parse(text, ctx)];
  const results = pieces.map((p) => parse(p, ctx));
  // Herencia de fecha explícita del primer pedazo
  const first = results[0];
  const today = ctx.today ?? todayISO();
  if (first?.ok && first.entry.date !== today) {
    for (const r of results.slice(1)) if (r.ok && r.entry.date === today) r.entry.date = first.entry.date;
  }
  return results;
}
