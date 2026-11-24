/** Lectura de números escritos en español: "mil doscientos" → 1200, "quince mil" → 15000. */

const UNITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};

export function isNumberWord(w: string): boolean {
  return w in UNITS || w === 'mil' || w === 'millon' || w === 'millones';
}

/**
 * Convierte una secuencia de palabras numéricas a número. Devuelve null si
 * la secuencia no es válida. Acepta "y" entre decenas y unidades.
 */
export function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === 'y') {
      if (!seen || i === words.length - 1) return null;
      continue;
    }
    if (w in UNITS) {
      current += UNITS[w]!;
      seen = true;
    } else if (w === 'mil') {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      seen = true;
    } else if (w === 'millon' || w === 'millones') {
      current = (current || 1) * 1_000_000;
      total += current;
      current = 0;
      seen = true;
    } else return null;
  }
  return seen ? total + current : null;
}

/**
 * Lee un número escrito con dígitos: "1,250.50", "$45.50", "1.5k", "15mil", "45,50".
 * Devuelve el valor en pesos (float) o null.
 */
export function parseNumericToken(token: string): { value: number; hasCurrencySymbol: boolean; multiplier: boolean; sign: 1 | -1 | 0 } | null {
  let t = token.trim();
  let sign: 1 | -1 | 0 = 0;
  if (/^[+]/.test(t)) {
    sign = 1;
    t = t.slice(1);
  } else if (/^[-−]/.test(t)) {
    sign = -1;
    t = t.slice(1);
  }
  let hasCurrencySymbol = false;
  if (t.startsWith('$')) {
    hasCurrencySymbol = true;
    t = t.slice(1);
  }
  if (t.endsWith('$')) {
    hasCurrencySymbol = true;
    t = t.slice(0, -1);
  }
  let mult = 1;
  let multiplier = false;
  const suffix = t.match(/(k|mil|m)$/i);
  if (suffix && /\d/.test(t.slice(0, -suffix[0].length))) {
    const s = suffix[0].toLowerCase();
    mult = s === 'm' ? 1_000_000 : 1000;
    multiplier = true;
    t = t.slice(0, -suffix[0].length);
  }
  let value: number;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) value = Number(t.replace(/,/g, ''));
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) && !multiplier) value = Number(t.replace(/\./g, '').replace(',', '.')); // 1.250,50 (formato europeo)
  else if (/^\d+,\d{1,2}$/.test(t)) value = Number(t.replace(',', '.')); // 45,50
  else if (/^\d+(\.\d+)?$/.test(t)) value = Number(t);
  else if (/^\.\d+$/.test(t)) value = Number(t);
  else return null;
  if (!Number.isFinite(value)) return null;
  return { value: value * mult, hasCurrencySymbol, multiplier, sign };
}
