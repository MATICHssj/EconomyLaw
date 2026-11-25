# Seguridad de Fina

Principio: **cerrado por defecto, mínimo privilegio y nada de contraseñas bancarias.**

## Inicio de sesión
- Firebase Authentication con **Google** o **correo y contraseña**.
- Contraseña mínima de **8 caracteres**, con medidor de fuerza y rechazo de contraseñas comunes.
- **Verificación de correo**: las cuentas de correo deben confirmarlo antes de usar WhatsApp o el modo pareja (las de Google ya vienen verificadas).
- Recuperación de contraseña por correo; mensajes de error que no revelan si un correo existe (activar *protección contra enumeración* en Firebase).
- Firebase limita intentos fallidos automáticamente.
- Modo “sin cuenta” opcional: los datos se quedan solo en el dispositivo.

## En el dispositivo
- **Bloqueo con PIN** (hash SHA-256 con sal, nunca en texto) y **huella / Face ID** vía WebAuthn. Se vuelve a pedir tras 1 minuto en segundo plano.
- **Modo discreto** para ocultar montos.
- Caché local de Firestore / IndexedDB protegida por el aislamiento del navegador.

## Base de datos (`firebase/firestore.rules`)
- Cada usuario solo lee y escribe `users/{su uid}`.
- Hogares (pareja): solo integrantes; unirse exige un **código de invitación vigente**; nadie puede expulsar a otro; máx. 8 integrantes.
- `linkCodes` (WhatsApp): el cliente solo puede **crear** su código (vence ≤ 15 min); no puede leerlo ni sobrescribir uno ajeno.
- `waLinks`: inaccesible desde el cliente; solo el servidor.
- Validación de esquema: montos **enteros** en centavos y no negativos, tipos de movimiento permitidos, fechas `YYYY-MM-DD`, tamaños máximos de texto y de documento.
- Todo lo demás: **denegado**.
- **Pruebas automáticas** con el emulador (`pnpm --filter @fina/firebase test:rules`) en cada push.

## Servidor (Cloudflare Worker)
- Webhook de WhatsApp: firma **HMAC-SHA256** (`X-Hub-Signature-256`) verificada en tiempo constante; mensajes sin firma → 401.
- **Idempotencia** por id de mensaje (KV 48 h) y **límite de frecuencia** por número (20/min) y por usuario de la API (60/min).
- Teléfonos guardados como **hash SHA-256 con sal**; textos originales de WhatsApp y correos se **borran a los 30 días**.
- API de la app: exige **ID token de Firebase** verificado (firma RS256, emisor, audiencia y vigencia); **CORS** solo para los orígenes permitidos.
- Secretos solo en **Wrangler / GitHub Secrets**, nunca en el repositorio (`.env.example` sin valores).
- Borrar cuenta: elimina en cascada datos, vínculo de WhatsApp y el usuario de Auth.

## Web
- Encabezados en Firebase Hosting: **CSP** sin scripts en línea, `frame-ancestors 'none'`, **HSTS**, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Sin dependencias de terceros en tiempo de ejecución fuera de Firebase.

## Android
- Lector de notificaciones **opcional**, con pantalla de privacidad previa y **lista blanca** de apps bancarias; procesa en el teléfono.
- APK firmado con llave guardada en GitHub Secrets.
- **Tarjetas por NFC** (opcional, solo cuando tú tocas “Acercar tarjeta”): se leen únicamente los datos públicos que la tarjeta da a cualquier terminal, con una consulta de $0 y sin PIN. El número completo se usa solo en memoria del código nativo (`EmvReader.java`) para sacar los **últimos 4 dígitos** y se borra al instante; nunca llega a la app web, ni se guarda, ni se envía. No se lee el nombre del titular y el CVV no viaja por NFC. Probado con tarjetas simuladas (`EmvReaderTest.java`).

## Recomendado (gratis) al activar Firebase
- **App Check** con reCAPTCHA (Firebase → App Check): bloquea clientes que no sean tu app.
- Alertas de presupuesto en Google Cloud (aunque el plan Spark no cobra).
- Revisar mensualmente Authentication → Usuarios y los registros del Worker.

## Pendiente / mejoras de seguridad
- Autenticación de dos factores (requiere Identity Platform, que pide tarjeta para activarse).
- Revisión legal del aviso de privacidad (LFPDPPP).
