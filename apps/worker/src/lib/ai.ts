import { DEFAULT_CATEGORIES } from '@fina/core';
import type { Env } from '../env';

/**
 * Workers AI (cuota gratuita diaria). Todo es opcional: si no hay binding AI,
 * las funciones devuelven null y la app sigue funcionando sin IA.
 */
export async function transcribe(env: Env, audio: Uint8Array): Promise<string | null> {
  if (!env.AI) return null;
  const r = (await env.AI.run('@cf/openai/whisper' as never, { audio: [...audio] } as never)) as { text?: string };
  return r.text?.trim() || null;
}

export interface ReceiptData {
  total: number | null;
  merchant: string | null;
  date: string | null;
}

function extractJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/** Lee el total, comercio y fecha de la foto de un ticket. */
export async function readReceipt(env: Env, image: Uint8Array): Promise<ReceiptData | null> {
  if (!env.AI) return null;
  const prompt =
    'Eres un lector de tickets de compra de México. Responde SOLO un JSON: {"total": número en pesos (el TOTAL a pagar), "merchant": nombre del comercio, "date": "YYYY-MM-DD" o null}. Sin texto extra.';
  const run = () => env.AI!.run(VISION_MODEL as never, { image: [...image], prompt, max_tokens: 200 } as never) as Promise<{ response?: string }>;
  let r: { response?: string };
  try {
    r = await run();
  } catch (e) {
    // El modelo de Meta requiere aceptar su licencia una vez.
    if (String(e).toLowerCase().includes('agree')) {
      await env.AI.run(VISION_MODEL as never, { prompt: 'agree' } as never);
      r = await run();
    } else throw e;
  }
  const data = extractJson<ReceiptData>(r.response ?? '');
  if (!data) return null;
  const total = typeof data.total === 'number' ? data.total : Number(String(data.total ?? '').replace(/[^\d.]/g, '')) || null;
  return { total, merchant: data.merchant ?? null, date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null };
}

const LLM = '@cf/meta/llama-3.1-8b-instruct';

/** Respaldo para frases ambiguas: elige una categoría de la lista (validada). */
export async function categorize(env: Env, text: string, type: 'expense' | 'income' = 'expense'): Promise<string | null> {
  if (!env.AI) return null;
  const cats = DEFAULT_CATEGORIES.filter((c) => c.type === type && !['review', 'adjustment'].includes(c.id));
  const list = cats.map((c) => `${c.id}: ${c.name}`).join('\n');
  const r = (await env.AI.run(LLM as never, {
    messages: [
      { role: 'system', content: `Clasificas gastos de personas en México. Responde SOLO un JSON {"categoryId": "<id>"} usando uno de estos ids:\n${list}` },
      { role: 'user', content: text.slice(0, 300) },
    ],
    max_tokens: 40,
  } as never)) as { response?: string };
  const id = extractJson<{ categoryId?: string }>(r.response ?? '')?.categoryId;
  return id && cats.some((c) => c.id === id) ? id : null;
}
