import { useMemo, useState } from 'react';
import { parseMany, type ParsedEntry, type ParseResult } from '@fina/parser';
import { hasWorker } from '@/config';
import { aiCategorize } from '@/lib/api';
import { commitEntries, parseContext, saveTransaction, type CommitOptions } from '@/lib/actions';
import { getDocs, useData } from '@/stores/data';

/** Lógica compartida de captura: interpreta mientras escribes y guarda con Enter. */
export function useCapture() {
  const [text, setText] = useState('');
  const rules = useData((s) => s.data.rules);
  const accounts = useData((s) => s.data.accounts);
  const loans = useData((s) => s.data.loans);
  const results: ParseResult[] = useMemo(() => {
    if (!text.trim()) return [];
    return parseMany(text, parseContext());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, rules, accounts, loans]);
  const entries = results.filter((r): r is { ok: true; entry: ParsedEntry } => r.ok).map((r) => r.entry);
  const problems = results.filter((r) => !r.ok);

  async function submit(opts: CommitOptions = {}): Promise<boolean> {
    if (!entries.length) return false;
    const txs = await commitEntries(entries, opts);
    setText('');
    // Respaldo con IA para frases ambiguas (solo si hay Worker configurado).
    if (hasWorker()) {
      for (const tx of txs) {
        if (tx.status !== 'review') continue;
        void aiCategorize(tx.rawText ?? tx.description)
          .then(({ categoryId }) => {
            const current = getDocs('transactions').find((t) => t.id === tx.id);
            if (categoryId && current && current.status === 'review') void saveTransaction({ ...current, categoryId, status: 'cleared' }, { learn: false });
          })
          .catch(() => {});
      }
    }
    return true;
  }

  return { text, setText, results, entries, problems, submit };
}

export const EXAMPLES = ['galleta 30', 'uber 85', 'ayer tacos 120', '+15000 quincena', 'netflix 299 cada mes', 'cena 900 entre 3', 'tv 12000 a 12 msi con nu', 'le presté 200 a Juan', 'gasolina 500 con bbva', 'tacos 120, refresco 25'];
