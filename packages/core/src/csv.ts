/** CSV mínimo y correcto (RFC 4180): comillas, comas y saltos de línea dentro de campos. */

export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>, separator = ','): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r;]/.test(s) || s.includes(separator) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(separator)).join('\r\n');
}

/** Lee CSV detectando el separador (coma, punto y coma o tabulador). */
export function parseCsv(text: string, separator?: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const sep = separator ?? detectSeparator(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function detectSeparator(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const counts = [',', ';', '\t', '|'].map((s) => ({ s, n: sample.split(s).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0]!.s;
}
