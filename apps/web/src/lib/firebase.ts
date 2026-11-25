import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { config } from '@/config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function firebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!config.firebase) throw new Error('Firebase no está configurado');
  if (!app) {
    app = initializeApp(config.firebase);
    auth = getAuth(app);
    auth.languageCode = 'es';
    db = initializeFirestore(app, {
      // Caché persistente = la app funciona sin internet y sincroniza al reconectar.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  }
  return { app, auth: auth!, db: db! };
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, cb);
}

export async function signInGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { auth } = firebase();
  const isStandaloneIOS =
    /iphone|ipad/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches;
  if (isStandaloneIOS) await signInWithRedirect(auth, provider);
  else await signInWithPopup(auth, provider);
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebase().auth, email, password);
}

export async function signUpEmail(name: string, email: string, password: string): Promise<void> {
  const check = passwordStrength(password);
  if (!check.ok) throw Object.assign(new Error(check.message), { code: 'fina/weak-password' });
  const cred = await createUserWithEmailAndPassword(firebase().auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user).catch(() => {});
}

export async function resendVerification(): Promise<void> {
  const u = firebase().auth.currentUser;
  if (u && !u.emailVerified) await sendEmailVerification(u);
}

const COMMON_PASSWORDS = [
  '12345678',
  '123456789',
  'password',
  'contraseña',
  'contrasena',
  'qwertyui',
  'iloveyou',
  'abcd1234',
  '11111111',
  'mexico123',
  'password1',
  '87654321',
  'fina1234',
];

/** Reglas de contraseña: 8+ caracteres, no común, y con variedad. Devuelve puntaje 0..4. */
export function passwordStrength(pw: string): { score: number; ok: boolean; message: string } {
  if (pw.length < 8) return { score: 0, ok: false, message: 'Usa al menos 8 caracteres.' };
  if (COMMON_PASSWORDS.includes(pw.toLowerCase()))
    return { score: 0, ok: false, message: 'Esa contraseña es muy común. Elige otra.' };
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw)) score = 0;
  const ok = score >= 2;
  return {
    score,
    ok,
    message: ok
      ? score >= 3
        ? 'Contraseña fuerte'
        : 'Contraseña aceptable'
      : 'Combina mayúsculas, minúsculas, números o símbolos (o usa 12+ caracteres).',
  };
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebase().auth, email);
}

export async function logOut(): Promise<void> {
  await signOut(firebase().auth);
}

export async function idToken(): Promise<string | null> {
  const user = firebase().auth.currentUser;
  return user ? user.getIdToken() : null;
}

/** Mensajes de error de Firebase Auth en español claro. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'fina/weak-password') return (e as Error).message;
  const map: Record<string, string> = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No hay una cuenta con ese correo.',
    'auth/wrong-password': 'La contraseña no es correcta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/unauthorized-domain':
      'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).',
  };
  return map[code] ?? 'Algo salió mal. Intenta de nuevo.';
}
