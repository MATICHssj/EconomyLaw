/**
 * Configuración pública de la app. Se llena con variables de entorno al compilar
 * (en GitHub: Settings → Secrets and variables → Actions → Variables).
 * La configuración web de Firebase NO es secreta: está protegida por las reglas.
 */
import pub from './app.public.json';

const env = import.meta.env;
const fb = pub.firebase;

const firebaseConfig =
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID
    ? {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain:
          env.VITE_FIREBASE_AUTH_DOMAIN ?? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }
    : fb.apiKey && fb.projectId
      ? { ...fb, authDomain: fb.authDomain || `${fb.projectId}.firebaseapp.com` }
      : null;

export const config = {
  /** null = la app funciona en modo local (sin cuenta, solo este dispositivo). */
  firebase: env.MODE === 'single' ? null : firebaseConfig,
  vapidKey: env.VITE_FIREBASE_VAPID_KEY || pub.vapidKey,
  /** URL del Cloudflare Worker (WhatsApp, IA, push, correos). */
  workerUrl: (env.VITE_WORKER_URL || pub.workerUrl).replace(/\/$/, ''),
  /** Número de WhatsApp del bot, con lada: 5215512345678 */
  whatsappNumber: env.VITE_WHATSAPP_NUMBER || pub.whatsappNumber,
  apkUrl:
    env.VITE_APK_URL ?? 'https://github.com/MATICHssj/EconomyLaw/releases/latest/download/fina.apk',
  emailDomain: env.VITE_EMAIL_DOMAIN || pub.emailDomain,
  /** Cuando la app esté en las tiendas, la página Instalar manda ahí. */
  appStoreUrl: env.VITE_APP_STORE_URL || pub.appStoreUrl,
  playStoreUrl: env.VITE_PLAY_STORE_URL || pub.playStoreUrl,
  repoUrl: 'https://github.com/MATICHssj/EconomyLaw',
  isDemoBuild: env.MODE === 'single',
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
};

export const hasCloud = () => config.firebase !== null;
export const hasWorker = () => config.workerUrl !== '';
