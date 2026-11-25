/** Variables y secretos del Worker. Los secretos se cargan con `wrangler secret put`. */
export interface Env {
  KV: KVNamespace;
  AI?: Ai;
  // Vars públicas (wrangler.toml)
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string; // separado por comas
  APP_URL: string;
  EMAIL_DOMAIN?: string;
  WHATSAPP_API_VERSION?: string;
  // Secretos
  FIREBASE_SERVICE_ACCOUNT?: string; // JSON completo de la cuenta de servicio
  WHATSAPP_TOKEN?: string; // token permanente (usuario del sistema)
  WHATSAPP_APP_SECRET?: string; // para verificar X-Hub-Signature-256
  WHATSAPP_VERIFY_TOKEN?: string; // el que pones en Meta al configurar el webhook
  WHATSAPP_PHONE_NUMBER_ID?: string;
  PHONE_HASH_SALT?: string; // sal para guardar los teléfonos hasheados
  // Agregador de pago (apagado por defecto)
  BELVO_SECRET_ID?: string;
  BELVO_SECRET_PASSWORD?: string;
}
