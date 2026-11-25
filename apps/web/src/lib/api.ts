import { config, hasWorker } from '@/config';

/** Llamadas al Cloudflare Worker (IA, recibos, push, vinculación). Requieren sesión de Firebase. */
export async function workerFetch<T>(
  path: string,
  body?: unknown,
  init: RequestInit = {},
): Promise<T> {
  if (!hasWorker()) throw new Error('El servidor (Worker) aún no está configurado.');
  let token: string | null = null;
  if (config.firebase) {
    const { idToken } = await import('./firebase');
    token = await idToken();
  }
  const res = await fetch(`${config.workerUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...init,
    headers: {
      ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `Error ${res.status}`);
  return (await res.json()) as T;
}

export interface ReceiptResult {
  total: number | null;
  merchant: string | null;
  date: string | null;
  text: string;
}

export async function scanReceipt(file: File): Promise<ReceiptResult> {
  const fd = new FormData();
  fd.append('image', file);
  return workerFetch<ReceiptResult>('/api/receipt', fd);
}

export async function aiCategorize(text: string): Promise<{ categoryId: string | null }> {
  return workerFetch('/api/ai/categorize', { text });
}
