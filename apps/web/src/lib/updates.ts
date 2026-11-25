import { config } from '@/config';
import { useUI } from '@/stores/ui';
import { isCapacitor } from './pwa';

/**
 * APK fuera de la tienda: revisa si hay una versión nueva en GitHub Releases y
 * ofrece "Actualizar" (se descarga e instala encima, sin perder datos si el APK
 * está firmado con la misma llave). En la web/iPhone no hace falta: se actualiza sola.
 */
const KEY = 'fina:update-check';
const EVERY_MS = 12 * 60 * 60 * 1000;

export interface UpdateInfo {
  available: boolean;
  latest: string | null;
}

function buildOf(tag: string): number | null {
  const m = /(\d+)$/.exec(tag.replace(/^v/, ''));
  return m ? Number(m[1]) : null;
}

export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = Number(config.build);
  if (!isCapacitor() || !current) return { available: false, latest: null };
  try {
    const last = Number(localStorage.getItem(KEY) ?? 0);
    if (!force && Date.now() - last < EVERY_MS) return { available: false, latest: null };
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento */
  }
  const repo = config.repoUrl.replace('https://github.com/', '');
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return { available: false, latest: null };
  const rel = (await r.json()) as { tag_name?: string };
  const latestBuild = rel.tag_name ? buildOf(rel.tag_name) : null;
  const latest = rel.tag_name?.replace(/^v/, '') ?? null;
  return { available: latestBuild !== null && latestBuild > current, latest };
}

export function openApkDownload() {
  window.open(config.apkUrl, '_blank');
}

/** Al abrir la app: si hay versión nueva, avisa con un botón para actualizar. */
export async function notifyIfUpdate(): Promise<void> {
  const u = await checkForUpdate().catch(() => null);
  if (!u?.available) return;
  useUI.getState().pushToast({
    text: `Hay una versión nueva de Fina${u.latest ? ` (${u.latest})` : ''}.`,
    tone: 'info',
    actions: [{ label: 'Actualizar', onClick: openApkDownload }],
    timeout: 20000,
  });
}
