import { config } from '@/config';
import { useSession } from '@/stores/session';
import { isCapacitor } from './pwa';

/**
 * Registro de errores ligero (sin servicios de paga): se guardan los últimos
 * errores en el teléfono y, si hay cuenta, también en tu espacio de Firestore
 * para poder arreglarlos. Nunca se guardan montos, movimientos ni textos tuyos:
 * solo el mensaje técnico, la pantalla y la versión.
 */
export interface ErrorEntry {
  at: string;
  message: string;
  stack?: string;
  route: string;
  version: string;
  build: string;
  platform: string;
  count: number;
}

const KEY = 'fina:errors';
const MAX = 30;
const MAX_CLOUD_PER_SESSION = 10;
let cloudSent = 0;
let installed = false;

function platform(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad/i.test(ua) ? 'ios' : 'desktop';
  return `${os}-${isCapacitor() ? 'apk' : 'web'}`;
}

/** Quita lo que podría ser dato personal: números largos, correos y direcciones con parámetros. */
export function sanitize(text: string, max: number): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/\d{5,}/g, '#')
    .replace(/https?:\/\/[^\s)]+/g, (u) => u.split(/[?#]/)[0]!.split('/').slice(-1)[0] ?? 'url')
    .slice(0, max);
}

export function getErrors(): ErrorEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento */
  }
}

export function recordError(err: unknown): void {
  const e =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Error desconocido');
  // Errores de red o de extensiones del navegador no son de la app.
  if (/ResizeObserver loop|Script error\.?$|Load failed|Failed to fetch/i.test(e.message)) return;
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    message: sanitize(`${e.name}: ${e.message}`, 300),
    stack: e.stack ? sanitize(e.stack.split('\n').slice(0, 6).join('\n'), 1200) : undefined,
    route: (location.hash.split('?')[0] || '#/').slice(0, 100),
    version: config.version,
    build: config.build || 'local',
    platform: platform(),
    count: 1,
  };
  try {
    const list = getErrors();
    const same = list.find((x) => x.message === entry.message && x.route === entry.route);
    if (same) {
      same.count++;
      same.at = entry.at;
    } else list.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* sin almacenamiento */
  }
  void sendToCloud(entry);
}

async function sendToCloud(entry: ErrorEntry) {
  if (cloudSent >= MAX_CLOUD_PER_SESSION || !config.firebase) return;
  cloudSent++;
  try {
    const s = useSession.getState();
    if (s.mode !== 'firebase' || !s.user) return;
    const [{ firebase }, { doc, setDoc }] = await Promise.all([
      import('./firebase'),
      import('firebase/firestore'),
    ]);
    const id = `${entry.at.replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
    const data: Record<string, unknown> = { ...entry };
    if (!entry.stack) delete data.stack;
    await setDoc(doc(firebase().db, 'users', s.user.uid, 'errors', id), data);
  } catch {
    /* si falla el registro, no hacemos nada (no queremos otro error) */
  }
}

export function installErrorHandlers() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (ev) => recordError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => recordError(ev.reason));
}

/** Texto corto para mandar con los comentarios. */
export function errorReport(limit = 3): string {
  return getErrors()
    .slice(0, limit)
    .map((e) => `• ${e.at.slice(0, 16).replace('T', ' ')} ${e.route} (${e.count}x): ${e.message}`)
    .join('\n');
}
