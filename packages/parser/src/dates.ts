import { addDays, makeISODate, splitISO, weekday, type ISODate } from '@fina/core';

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

export function monthFromWord(w: string): number | undefined {
  return MONTHS[w];
}

export interface DateMatch {
  date: ISODate;
  /** Índices de tokens consumidos. */
  consumed: number[];
}

/** Ajusta una fecha sin año: si quedaría en el futuro lejano, es del año pasado. */
function resolveYear(today: ISODate, month: number, day: number): ISODate {
  const { year } = splitISO(today);
  const candidate = makeISODate(year, month, day);
  return candidate > addDays(today, 1) ? makeISODate(year - 1, month, day) : candidate;
}

/**
 * Busca expresiones de fecha en tokens normalizados: hoy, ayer, antier, el lunes,
 * el 15, 15 de nov, 15/11, hace 3 días, la semana pasada…
 */
export function findDate(tokens: string[], today: ISODate): DateMatch | null {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1];
    const prev = tokens[i - 1];
    if (t === 'hoy') return { date: today, consumed: [i] };
    if (t === 'ayer') return { date: addDays(today, -1), consumed: [i] };
    if (t === 'antier' || t === 'anteayer') return { date: addDays(today, -2), consumed: [i] };
    if (t === 'antes' && next === 'de' && tokens[i + 2] === 'ayer') return { date: addDays(today, -2), consumed: [i, i + 1, i + 2] };
    if (t === 'manana' && !(prev === 'la' || prev === 'esta')) return { date: addDays(today, 1), consumed: [i] };
    if (t === 'hace' && next) {
      const n = next === 'un' || next === 'una' ? 1 : Number(next);
      const unit = tokens[i + 2];
      if (Number.isInteger(n) && n > 0 && unit) {
        if (/^dias?$/.test(unit)) return { date: addDays(today, -n), consumed: [i, i + 1, i + 2] };
        if (/^semanas?$/.test(unit)) return { date: addDays(today, -7 * n), consumed: [i, i + 1, i + 2] };
      }
    }
    if ((t === 'semana' && next === 'pasada') || (t === 'la' && next === 'semana' && tokens[i + 2] === 'pasada')) {
      const consumed = t === 'la' ? [i, i + 1, i + 2] : [i, i + 1];
      return { date: addDays(today, -7), consumed };
    }
    if (t in WEEKDAYS) {
      const target = WEEKDAYS[t]!;
      let diff = (weekday(today) - target + 7) % 7;
      const consumed = [i];
      if (prev === 'el') consumed.unshift(i - 1);
      if (next === 'pasado') {
        if (diff === 0) diff = 7;
        consumed.push(i + 1);
      }
      return { date: addDays(today, -diff), consumed };
    }
    // 15/11, 15-11, 15/11/2025, 2025-11-15
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return { date: makeISODate(Number(m[1]), Number(m[2]), Number(m[3])), consumed: [i] };
    m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        if (m[3]) {
          const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
          return { date: makeISODate(y, month, day), consumed: [i] };
        }
        return { date: resolveYear(today, month, day), consumed: [i] };
      }
    }
    // "15 de noviembre", "15 nov"
    if (/^\d{1,2}$/.test(t)) {
      const day = Number(t);
      const monthWord = next === 'de' ? tokens[i + 2] : next;
      const month = monthWord ? MONTHS[monthWord] : undefined;
      if (month && day >= 1 && day <= 31) {
        const consumed = next === 'de' ? [i, i + 1, i + 2] : [i, i + 1];
        if (prev === 'el') consumed.unshift(i - 1);
        return { date: resolveYear(today, month, day), consumed };
      }
    }
    // "el 15" (día de este mes, o del anterior si aún no llega)
    if (t === 'el' && next && /^\d{1,2}$/.test(next)) {
      const day = Number(next);
      const after = tokens[i + 2];
      if (day >= 1 && day <= 31 && !(after && /^(msi|meses|mensualidades)$/.test(after))) {
        const { year, month } = splitISO(today);
        let date = makeISODate(year, month, day);
        if (date > today) {
          const prevMonth = month === 1 ? 12 : month - 1;
          date = makeISODate(month === 1 ? year - 1 : year, prevMonth, day);
        }
        return { date, consumed: [i, i + 1] };
      }
    }
  }
  return null;
}
