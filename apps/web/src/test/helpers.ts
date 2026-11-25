import { parseMany, type ParsedEntry } from '@fina/parser';
import { LocalBackend } from '@/lib/backend/local';
import { parseContext } from '@/lib/actions';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';

/** Conecta la app a un IndexedDB nuevo y espera a que cargue. */
export async function freshApp(): Promise<void> {
  useData.getState().detach();
  indexedDB.deleteDatabase('fina-local');
  useData.getState().attach(new LocalBackend());
  await waitFor(() => useData.getState().ready && useData.getState().data.categories.length > 0);
  useUI.setState({ toasts: [] });
}

export async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('Tiempo de espera agotado');
    await new Promise((r) => setTimeout(r, 10));
  }
}

export function entries(text: string): ParsedEntry[] {
  return parseMany(text, parseContext())
    .filter((r): r is { ok: true; entry: ParsedEntry } => r.ok)
    .map((r) => r.entry);
}

/** Toca el botón "Deshacer" del último aviso. */
export async function undoLast(): Promise<void> {
  const t = useUI.getState().toasts.at(-1);
  const undo = t?.actions?.find((a) => a.label === 'Deshacer');
  if (!undo) throw new Error('No hay "Deshacer"');
  undo.onClick();
}
