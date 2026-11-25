# Guía del dueño de Fina

Esta guía es para ti, sin tecnicismos. Todo lo que aparece aquí es **gratis y sin tarjeta de crédito**. Hazlo en este orden; cada paso suma funciones y la app sigue funcionando aunque no termines todos.

| Paso | Qué activa | Tiempo |
|---|---|---|
| 1. Unir el Pull Request | La app publicada en internet (GitHub Pages) en modo sin cuenta | 2 min |
| 2. Firebase | Inicio de sesión, sincronizar dispositivos, modo pareja | 15 min |
| 3. Cloudflare | Servidor: recordatorios con la app cerrada, IA, correos | 15 min |
| 4. WhatsApp (Meta) | El bot de WhatsApp | 30 min |
| 5. Llave de Android | Que las actualizaciones del APK se instalen encima | 5 min |

---

## 1. Publicar la app

1. En GitHub abre el **Pull Request** de Fina y toca el botón verde **“Merge pull request”** → **“Confirm merge”**.
2. Ve a **Settings → Pages** del repositorio. En “Source” elige **“GitHub Actions”**.
3. Ve a la pestaña **Actions**: en unos minutos “Publicar web” queda en verde ✅.
4. Tu app queda en `https://matichssj.github.io/EconomyLaw/`. Ábrela en el celular y toca “Instalar”.

El APK de Android se publica solo en **Releases** (enlace fijo: `…/releases/latest/download/fina.apk`).

---

## 2. Firebase (cuentas e inicio de sesión)

**Crear el proyecto**
1. Entra a <https://console.firebase.google.com> con tu cuenta de Google → **“Crear un proyecto”**. Nombre: `fina-app` (o el que quieras). Desactiva Google Analytics. El plan **Spark** es gratis y no pide tarjeta.
2. Menú **Compilación → Authentication → Comenzar**. En “Método de acceso” activa **Google** y **Correo electrónico/contraseña**.
3. En Authentication → **Configuración** → *Protección contra la enumeración de correos*: **actívala** (más seguro).
4. Menú **Compilación → Firestore Database → Crear base de datos** → ubicación `us-central` o `nam5` → **modo de producción**.

**Conectar la app**
5. En ⚙️ **Configuración del proyecto → General → Tus apps** toca el ícono **</>** (web). Ponle “Fina web” y regístrala. Te muestra un bloque `firebaseConfig` con `apiKey`, `authDomain`, etc. **Esos datos no son secretos** (los protegen las reglas de seguridad).
6. En GitHub: **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**, y crea una por cada dato:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
7. **Notificaciones web**: en Firebase ⚙️ → **Cloud Messaging** → *Configuración web* → **Generar par de claves**. Copia la clave en la variable `VITE_FIREBASE_VAPID_KEY`.
8. **Cuenta de servicio** (para publicar reglas y para el servidor): ⚙️ → **Cuentas de servicio** → **Generar nueva clave privada** → se descarga un `.json`. **Esto SÍ es secreto.** En GitHub → **Secrets** (no Variables) → `FIREBASE_SERVICE_ACCOUNT` y pega TODO el contenido del archivo. Luego borra el archivo de tu computadora.
9. En Authentication → Configuración → **Dominios autorizados** agrega `matichssj.github.io` (y tu dominio si tienes).
10. En GitHub → Actions → “Publicar web” → **Run workflow**. Esto publica la app en `https://<tu-proyecto>.web.app` **y sube las reglas de seguridad**.

> Si me pegas en el chat el bloque `firebaseConfig` (paso 5), yo creo las variables por ti. **Nunca** pegues el `.json` de la cuenta de servicio en el chat: ese va solo en GitHub Secrets.

---

## 3. Cloudflare (servidor gratuito)

1. Crea una cuenta en <https://dash.cloudflare.com/sign-up> (gratis, sin tarjeta).
2. **Workers & Pages → KV → Create namespace** → nombre `fina`. Copia su **ID**.
3. **Mi perfil → API Tokens → Create Token** → plantilla **“Edit Cloudflare Workers”** → Continuar → Crear. Copia el token (solo se ve una vez).
4. Tu **Account ID** está en la barra derecha de “Workers & Pages”.
5. En GitHub:
   - **Secrets**: `CLOUDFLARE_API_TOKEN` (paso 3) y `PHONE_HASH_SALT` (inventa 30 letras y números al azar).
   - **Variables**: `CLOUDFLARE_ACCOUNT_ID`, `WORKER_KV_ID` (paso 2), `FIREBASE_PROJECT_ID`, `APP_URL` (`https://<tu-proyecto>.web.app`), `ALLOWED_ORIGINS` (`https://<tu-proyecto>.web.app,https://matichssj.github.io`).
6. Actions → “Publicar servidor” → **Run workflow**. Al terminar, tu servidor queda en `https://fina-api.<tu-subdominio>.workers.dev`. Ábrelo y agrega `/health`: debe decir `"ok": true`.
7. Crea la variable `VITE_WORKER_URL` con esa dirección y vuelve a correr “Publicar web”.

Con esto se activan: recordatorios de pago con la app cerrada (9:00 a. m.), resumen semanal, IA para tickets y categorías, y borrar cuenta en cascada.

**Correos del banco (opcional, requiere un dominio):** si tienes un dominio (cuesta ~$200 MXN/año), agrégalo a Cloudflare → **Email → Email Routing** → *Catch-all* → **Send to a Worker: fina-api**. Crea la variable `VITE_EMAIL_DOMAIN` con tu dominio. Cada usuario verá su dirección única en Ajustes.

---

## 4. WhatsApp (bot)

Los mensajes que el bot **responde** dentro de 24 h de que el usuario escribió son gratis. Fina nunca manda publicidad.

1. Entra a <https://developers.facebook.com> → **Mis apps → Crear app** → tipo **“Otro” → “Empresa” (Business)**.
2. En la app, agrega el producto **WhatsApp** → **Configuración de la API**. Meta te da un **número de prueba** y su **Phone Number ID**.
3. **Token permanente**: en <https://business.facebook.com> → Configuración del negocio → **Usuarios del sistema** → Agregar (rol Admin) → **Generar token** → elige tu app → permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. **App Secret**: en la app de Meta → Configuración → Básica → **Clave secreta de la app** → Mostrar.
5. En GitHub **Secrets**: `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_VERIFY_TOKEN` (inventa una palabra larga). Corre “Publicar servidor”.
6. En Meta → WhatsApp → **Configuración → Webhook → Editar**: URL `https://fina-api.<tu-subdominio>.workers.dev/whatsapp/webhook` y el mismo `WHATSAPP_VERIFY_TOKEN`. Luego **Suscribirse** al campo `messages`.
7. Variable `VITE_WHATSAPP_NUMBER` con el número del bot (con lada, sin +, ej. `5215512345678`) y vuelve a publicar la web.
8. Prueba: en la app → Más → WhatsApp → Vincular.

Para usar tu propio número en lugar del de prueba, agrégalo en Meta → WhatsApp → Números de teléfono (requiere verificar el negocio).

---

## 5. Llave para firmar el APK de Android

Sin llave, cada APK es “de prueba” y para actualizar hay que desinstalar. Con llave, las actualizaciones se instalan encima.

```bash
keytool -genkey -v -keystore fina.keystore -alias fina -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 fina.keystore > fina.keystore.b64
```

En GitHub **Secrets**: `ANDROID_KEYSTORE_BASE64` (contenido del `.b64`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`fina`), `ANDROID_KEY_PASSWORD`. **Guarda el archivo `fina.keystore` en un lugar seguro**: si lo pierdes no podrás actualizar la app instalada.

---

## Cambiar nombre, colores o textos

- Nombre, eslogan y paletas: `packages/core/src/brand.ts` (y `name`/`short_name` en `apps/web/vite.config.ts`).
- Íconos: `apps/web/scripts/icons.mjs` y `apps/web/scripts/android-icons.mjs`.
- Lecciones de “Aprende”: `apps/web/src/features/academy/lessons.ts`.
- Categorías por defecto y palabras clave: `packages/core/src/categories.ts` y `packages/parser/src/dictionary.ts`.

Pídemelo y lo cambio yo.

---

## Costos y límites (todo $0)

| Servicio | Plan gratis | Límite que importa |
|---|---|---|
| GitHub (código, Actions, Pages, Releases) | Gratis (repo público) | 2,000 min/mes de Actions en repos privados; ilimitado en públicos |
| Firebase Spark | Gratis, sin tarjeta | Firestore: 50,000 lecturas y 20,000 escrituras **por día**, 1 GB. Auth: ilimitado con correo/Google |
| Firebase Cloud Messaging | Gratis | Sin límite práctico |
| Cloudflare Workers | Gratis | 100,000 solicitudes/día, 10 ms de CPU por solicitud |
| Workers KV | Gratis | 100,000 lecturas y 1,000 escrituras por día |
| Workers AI | Gratis | ~10,000 “neuronas”/día (cientos de notas de voz o tickets) |
| WhatsApp Cloud API | Gratis | Respuestas dentro de 24 h gratis; mensajes iniciados por el negocio se cobran (Fina no los usa) |
| Dominio para correos | **Opcional, de pago** | ~$200 MXN/año |
| Agregador bancario (Belvo) | **De pago, apagado** | Contrato empresarial; ver `packages/bank-profiles/src/connectors.ts` |

Con unos cientos de usuarios activos todo sigue en $0. Si algún día creces, el primer límite será Firestore (lecturas diarias).

---

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| “Este dominio no está autorizado” al entrar con Google | Firebase → Authentication → Configuración → Dominios autorizados. |
| La web no cambia después de unir cambios | Actions → “Publicar web” en verde; en el celular, cierra y abre la app (se actualiza sola). |
| El bot no contesta | `…workers.dev/health` debe decir `whatsapp: true`; en Meta, el webhook suscrito a `messages`; revisa los registros en Cloudflare → Workers → fina-api → Logs. |
| No llegan notificaciones | Ajustes → Notificaciones → Activar; en iPhone la app debe estar instalada en la pantalla de inicio. |
| Algo raro con los datos | Ajustes → Exportar (JSON) y mándamelo. |

Siempre puedes escribirme: “Claude, X no funciona” con una captura, y lo arreglo.
