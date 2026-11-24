import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
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
  const isStandaloneIOS = /iphone|ipad/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches;
  if (isStandaloneIOS) await signInWithRedirect(auth, provider);
  else await signInWithPopup(auth, provider);
}

export async function signInEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebase().auth, email, password);
}

export async function signUpEmail(name: string, email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(firebase().auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
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
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).',
  };
  return map[code] ?? 'Algo salió mal. Intenta de nuevo.';
}
