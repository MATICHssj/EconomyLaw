/**
 * Configuración pública de la app. Se llena con variables de entorno al compilar
 * (en GitHub: Settings → Secrets and variables → Actions → Variables).
 * La configuración web de Firebase NO es secreta: está protegida por las reglas.
 */
const env = import.meta.env;

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
    : null;

export const config = {
  /** null = la app funciona en modo local (sin cuenta, solo este dispositivo). */
  firebase: env.MODE === 'single' ? null : firebaseConfig,
  vapidKey: env.VITE_FIREBASE_VAPID_KEY ?? '',
  /** URL del Cloudflare Worker (WhatsApp, IA, push, correos). */
  workerUrl: (env.VITE_WORKER_URL ?? '').replace(/\/$/, ''),
  /** Número de WhatsApp del bot, con lada: 5215512345678 */
  whatsappNumber: env.VITE_WHATSAPP_NUMBER ?? '',
  apkUrl:
    env.VITE_APK_URL ?? 'https://github.com/MATICHssj/EconomyLaw/releases/latest/download/fina.apk',
  emailDomain: env.VITE_EMAIL_DOMAIN ?? '',
  repoUrl: 'https://github.com/MATICHssj/EconomyLaw',
  isDemoBuild: env.MODE === 'single',
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
};

export const hasCloud = () => config.firebase !== null;
export const hasWorker = () => config.workerUrl !== '';
