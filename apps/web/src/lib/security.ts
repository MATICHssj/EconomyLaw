import { sha256Hex } from '@fina/core';

/**
 * Bloqueo local con PIN o huella. El PIN nunca sale del dispositivo: solo se
 * guarda su hash con sal. La huella usa WebAuthn (el sensor del teléfono/PC).
 */
const PIN_KEY = 'fina:pin';
const BIO_KEY = 'fina:bio';

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash: await sha256Hex(`${salt}:${pin}`) }));
}

export async function checkPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(PIN_KEY);
  if (!raw) return true;
  const { salt, hash } = JSON.parse(raw) as { salt: string; hash: string };
  return (await sha256Hex(`${salt}:${pin}`)) === hash;
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(BIO_KEY);
}

export function biometricAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext;
}

export function hasBiometric(): boolean {
  try {
    return !!localStorage.getItem(BIO_KEY);
  } catch {
    return false;
  }
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function enrollBiometric(): Promise<boolean> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Fina' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'fina-local', displayName: 'Fina' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(BIO_KEY, b64(cred.rawId));
  return true;
}

export async function verifyBiometric(): Promise<boolean> {
  const id = localStorage.getItem(BIO_KEY);
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(id) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}
