import type { Env } from '../env';
import { base64url, base64urlDecode, pemToPkcs8 } from './crypto';

/**
 * Autenticación con Google desde el Worker, solo con WebCrypto (sin SDK):
 * - Token de acceso de la cuenta de servicio (JWT RS256) para Firestore, FCM e Identity Toolkit.
 * - Verificación de ID tokens de Firebase que manda la app.
 */
interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

const SCOPES = ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/firebase.messaging', 'https://www.googleapis.com/auth/identitytoolkit', 'https://www.googleapis.com/auth/cloud-platform'].join(' ');

let cachedToken: { token: string; exp: number } | null = null;

export function serviceAccount(env: Env): ServiceAccount {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT');
  return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
}

export async function accessToken(env: Env, fetcher: typeof fetch = fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const sa = serviceAccount(env);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${base64url(sig)}`;
  const res = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth de Google falló: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}

let jwks: { keys: Array<JsonWebKey & { kid: string }>; exp: number } | null = null;

async function securetokenKeys(fetcher: typeof fetch): Promise<Array<JsonWebKey & { kid: string }>> {
  if (jwks && jwks.exp > Date.now()) return jwks.keys;
  const res = await fetcher('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const json = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
  const maxAge = Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  jwks = { keys: json.keys, exp: Date.now() + maxAge * 1000 };
  return json.keys;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

/** Verifica un ID token de Firebase (firma RS256, emisor, audiencia y vigencia). */
export async function verifyIdToken(token: string, projectId: string, fetcher: typeof fetch = fetch): Promise<VerifiedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const [h, p, s] = parts as [string, string, string];
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(h))) as { alg: string; kid: string };
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(p))) as { iss: string; aud: string; exp: number; iat: number; sub: string; auth_time: number; email?: string; email_verified?: boolean };
  if (header.alg !== 'RS256') throw new Error('Algoritmo no permitido');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token de otro proyecto');
  if (payload.exp < now || payload.iat > now + 60 || payload.auth_time > now + 60) throw new Error('Token vencido');
  if (!payload.sub) throw new Error('Token sin usuario');
  const jwk = (await securetokenKeys(fetcher)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Llave desconocida');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('Firma inválida');
  return { uid: payload.sub, email: payload.email, emailVerified: payload.email_verified ?? false };
}

/** Borra el usuario de Firebase Auth (al borrar la cuenta). */
export async function deleteAuthUser(env: Env, uid: string, fetcher: typeof fetch = fetch): Promise<void> {
  const token = await accessToken(env, fetcher);
  const res = await fetcher(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:delete`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`No se pudo borrar el usuario: ${res.status}`);
}
