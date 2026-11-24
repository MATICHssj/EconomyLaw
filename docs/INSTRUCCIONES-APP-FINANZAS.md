# Instrucciones de construcción: app de finanzas personales tipo "anota en 3 segundos"

> **Para Claude Code:** este archivo es la especificación completa del proyecto. Léelo entero antes de escribir código. Construye la app **de principio a fin**, fase por fase. Al terminar debe quedar lista en un repositorio de GitHub, desplegada en la web, instalable en el teléfono (Android APK + PWA en iPhone) y en la computadora (PWA de escritorio).
>
> Nombre provisional: **Fina**. Todo el texto de marca debe salir de una sola constante (`APP_NAME`, eslogan, colores) para poder cambiarlo después sin tocar el resto del código.

---

## 0. Cómo trabajar con el dueño del proyecto (leer primero)

El dueño trabaja solo, con Claude como su apoyo principal. No es programador profesional. Reglas:

1. **Pregúntale lo que necesites, y dale opciones para elegir** ("¿prefieres A o B? Yo recomiendo A porque…"). Usa preguntas de opción múltiple siempre que puedas.
2. **Haz tú los cambios y publícalos tú.** No le des archivos ni pasos para copiar y pegar código. Solo pídele lo que únicamente él puede hacer (crear cuentas, iniciar sesión, pegar una clave), **paso a paso y con capturas mentales claras** ("abre X, toca el botón azul que dice Y").
3. **Analiza antes de hacer.** Al empezar cada fase, explica en 3–5 líneas qué vas a construir y por qué. Después constrúyelo sin pedir permiso para cada detalle.
4. **Cero tarjeta de crédito.** Solo servicios con plan gratuito que no pidan tarjeta. Si algo requiere pago, déjalo detrás de una interfaz ("adaptador") y apagado, y explícale el costo para que él decida.
5. **Todo en español de México** (textos de la app, mensajes del bot, comentarios de cara al usuario). El código y los nombres de variables, en inglés.
6. Al terminar cada fase: corre las pruebas, despliega, y dale un resumen corto de qué ya funciona y qué sigue.

---

## 1. La idea en una frase

Una app de finanzas donde registrar un gasto es tan fácil como escribir **"galleta de la tienda 30"** (en la app o por **WhatsApp**) y que crece con el usuario: desde alguien que solo quiere saber "¿en qué se me va el dinero?" hasta alguien que lleva presupuestos por sobres, deudas, inversiones, patrimonio y deducibles del SAT.

### Principios de producto (no negociables)

| Principio | Qué significa en la práctica |
|---|---|
| **Captura en 3 segundos** | Una sola línea de texto inteligente. Sin formularios. El sistema adivina monto, categoría, cuenta y fecha. El usuario solo corrige si quiere. |
| **Crece contigo** | 3 niveles (Básico, Organizado, Experto). La interfaz muestra solo lo del nivel elegido. Se cambia en cualquier momento. |
| **Hecha para México** | Pesos por defecto, quincenas, aguinaldo, MSI (meses sin intereses), fecha de corte y de pago, tandas, CETES, Afore, OXXO, SPEI, Mercado Pago, Nu, vales de despensa, CFDI del SAT. |
| **Tus datos son tuyos** | Nunca pedimos la contraseña del banco. Exportar todo en 1 toque. Borrar cuenta de verdad. |
| **Funciona sin internet** | Anotar offline y sincronizar después. |
| **Gratis de operar** | Toda la infraestructura en planes gratuitos. |

### Investigación de referencia (lo mejor del mercado que hay que superar)

- **YNAB**: presupuesto base cero ("dale un trabajo a cada peso"). Es el mejor para disciplina, pero es difícil para principiantes. → Lo copiamos **solo en nivel Experto**.
- **Monarch Money**: la mejor visión del hogar, en pareja, con metas visuales y reportes flexibles. → Copiamos el modo pareja/familia y el panel de patrimonio.
- **Copilot Money**: categorización automática con IA casi perfecta y un diseño hermoso. → Copiamos la autocategorización que aprende de tus correcciones.
- **Rocket Money**: detección de suscripciones y cargos recurrentes. → Copiamos el detector de suscripciones.
- **Goodbudget**: método de sobres. → Lo ofrecemos como estilo de presupuesto.
- **EveryDollar / 50-30-20**: métodos simples. → Opciones en nivel Organizado.
- **Lo que NINGUNO hace bien y será nuestra ventaja:** captura por WhatsApp en lenguaje natural (texto, **nota de voz** y **foto del ticket**), cosas de México (MSI, tandas, quincenas, CFDI) y que es gratis.

---

## 2. Arquitectura y stack (100 % gratuito, sin tarjeta)

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  App (PWA React)             │        │  Cloudflare Worker "api"       │
│  - Web / escritorio / iPhone │◄──────►│  - Webhook WhatsApp Cloud API  │
│  - Android (APK Capacitor)   │        │  - Webhook de correos (Email   │
│  - Offline (Firestore cache) │        │    Routing) de bancos          │
└──────────────┬───────────────┘        │  - Cron: recordatorios, recu-  │
               │                        │    rrentes, resúmenes          │
               ▼                        │  - Workers AI (voz, ticket,    │
┌──────────────────────────────┐        │    categorización de respaldo) │
│  Firebase (plan Spark)       │◄───────┤  - Envía push vía FCM v1       │
│  - Auth (Google + correo)    │  REST  └───────────────────────────────┘
│  - Firestore (datos)         │
│  - Hosting (web)             │
│  - Cloud Messaging (push)    │
└──────────────────────────────┘
```

| Pieza | Tecnología | Por qué |
|---|---|---|
| Frontend | **React + Vite + TypeScript**, Tailwind CSS, componentes propios (estilo shadcn/ui) | Rápido, tipado y fácil de mantener |
| Estado / datos | Firestore SDK con **persistencia offline** + Zustand para el estado de la interfaz | Offline gratis y sincronización en tiempo real entre dispositivos |
| Gráficas | Recharts | Ligera, suficiente |
| Fechas / dinero | date-fns (locale es-MX), y **montos en centavos como enteros** (nunca float) | Evita errores de redondeo |
| Auth | Firebase Auth: Google + correo/contraseña | Gratis |
| Backend | **Cloudflare Workers** (plan gratuito) + Cron Triggers | Firebase Functions requiere plan Blaze (con tarjeta). Workers es gratis |
| IA | **Workers AI** (cuota gratuita diaria): Whisper para notas de voz, un modelo de visión para tickets y un LLM pequeño de respaldo para frases ambiguas | Gratis, sin tarjeta |
| Push | Firebase Cloud Messaging (API HTTP v1, firmada desde el Worker con cuenta de servicio usando WebCrypto) | Gratis |
| Móvil Android | **Capacitor** para generar el APK (+ plugin nativo para leer notificaciones de bancos, ver §6.4) | Reutiliza el 100 % del código web |
| iPhone | PWA instalable ("Agregar a inicio") con push web | Sin pagar la cuenta de Apple Developer |
| Escritorio | PWA instalable desde Chrome/Edge | Gratis |
| Repo / CI | **GitHub** + GitHub Actions: pruebas, deploy a Firebase Hosting, deploy del Worker con Wrangler, compilación del APK y publicación en GitHub Releases | Todo automático al hacer push |
| Pruebas | Vitest (unidad), Playwright (e2e), emulador de Firestore para las reglas | |

**Regla de oro del backend:** el Worker es el único que escribe en Firestore desde fuera (WhatsApp, correos, cron), usando una cuenta de servicio guardada como *secret* de Wrangler. Los clientes escriben directo a Firestore protegidos por reglas de seguridad.

---

## 3. Los 3 niveles de uso

Al entrar por primera vez, el onboarding pregunta (con tarjetas grandes y simpáticas):

> **¿Cómo quieres llevar tu dinero?**
> 🟢 **Básico**: "Solo quiero saber en qué se me va."
> 🔵 **Organizado**: "Quiero presupuestos y no pasarme."
> 🟣 **Experto**: "Quiero control total: sobres, deudas, inversiones, patrimonio."

El nivel solo **muestra u oculta** funciones; los datos son los mismos. Subir de nivel nunca pierde información.

### 🟢 Nivel Básico
- Barra de captura rápida siempre visible (también por WhatsApp).
- Una sola cuenta implícita ("Mi dinero") o efectivo + 1 tarjeta.
- Categorías automáticas (el usuario no tiene que crear nada).
- Pantalla de inicio: **"Este mes llevas $X gastados"**, top 5 categorías y lista de movimientos.
- Resumen semanal por WhatsApp/push: "Esta semana gastaste $1,240, sobre todo en comida (40 %)."
- Búsqueda simple y editar/borrar movimiento.

### 🔵 Nivel Organizado (todo lo Básico +)
- **Cuentas múltiples**: efectivo, débito, crédito, Mercado Pago, vales, ahorro, etc., con saldo.
- **Categorías y subcategorías personalizables** con emoji y color. Etiquetas (#viaje, #negocio).
- **Presupuestos mensuales** por categoría. Estilos para elegir: libre, **50/30/20**, o por categoría. Barra de progreso y alerta al 80 % y al 100 %.
- **Recurrentes**: renta, Netflix, luz… con aviso antes de que se cobren.
- **Detector de suscripciones** automático (mismo comercio + monto similar + periodicidad).
- **Ingresos**: quincena, sueldo, freelance, con calendario de "cuándo me pagan".
- **Metas de ahorro** con fecha y aporte sugerido por quincena.
- **Tarjetas de crédito bien hechas**: fecha de corte, fecha límite de pago, pago mínimo, pago para no generar intereses, y aviso antes del pago.
- **MSI (meses sin intereses)**: registrar "TV 12,000 a 12 MSI" crea el plan de cargos mensuales; muestra cuánto MSI te queda por pagar en total.
- Reportes: por categoría, por mes, comparación contra el mes anterior.
- Importar estados de cuenta (CSV/Excel/OFX), ver §6.
- Exportar a Excel/CSV.

### 🟣 Nivel Experto (todo lo Organizado +)
- **Presupuesto base cero / sobres** (estilo YNAB): "Dinero por asignar", mover entre sobres, y que lo que sobra pase al siguiente mes.
- **Deudas**: préstamos, créditos, tarjetas; simulador **bola de nieve vs. avalancha** con fecha de libertad financiera e intereses ahorrados.
- **Préstamos personales**: "le presté 500 a Juan" → cuentas por cobrar con recordatorio.
- **Gastos compartidos** (estilo Splitwise): "cena 900 entre 3" → quién debe a quién.
- **Tandas**: registrar tanda (monto, número de participantes, tu turno, periodicidad) con calendario de pagos y de cuándo te toca.
- **Inversiones**: CETES, pagarés, fondos, acciones, cripto y Afore, con aportaciones y valor actual capturado a mano (precios automáticos como mejora futura).
- **Patrimonio neto** (activos − pasivos) con gráfica histórica mensual.
- **Proyección de flujo de efectivo** a 30/60/90 días con recurrentes, quincenas y pagos de tarjeta: "El 28 te quedarías con $430".
- **Reglas automáticas**: "si el texto contiene OXXO → categoría Tiendita, cuenta Efectivo".
- **Conciliación**: marcar movimientos como conciliados contra el estado de cuenta.
- **Multimoneda** (USD, EUR…) con tipo de cambio del día (API gratuita) y conversión a MXN.
- **Impuestos / SAT**: importar facturas **CFDI XML**, marcar **deducibles personales** (médicos, colegiaturas, intereses hipotecarios, etc.) y resumen anual para la declaración. Además, separar gastos de negocio con la etiqueta #negocio.
- **Modo pareja/familia**: espacio compartido con otra persona, con presupuestos comunes y cuentas personales privadas.
- **Fondo de emergencia**: meta especial con "meses de gastos cubiertos".
- Reportes avanzados: tendencias, gasto por día de la semana, mapa de calor del calendario, top comercios, tasa de ahorro mensual.

### Funciones transversales (todos los niveles)
- **Asistente "Pregúntale a Fina"** (opcional, con Workers AI): "¿cuánto gasté en Uber en octubre?", "¿me alcanza para unos tenis de 1,800?". Responde con consultas reales sobre los datos del usuario, nunca inventa números.
- **Bloqueo con PIN o huella** y **modo discreto** (ocultar montos con un toque).
- Modo oscuro, tamaños de letra accesibles y lector de pantalla.
- Notificaciones configurables: tipo, anticipación y horas de silencio.

---

## 4. El corazón: captura en lenguaje natural

### 4.1 Comportamiento
Una sola caja de texto (en la app y en WhatsApp). El **parser** convierte la frase en un movimiento estructurado. En la app, mientras escribe, se muestra una vista previa en vivo ("🍪 Tiendita · −$30 · Efectivo · Hoy"). Con Enter se guarda, y aparece un aviso con **Deshacer** y **Editar**.

### 4.2 Arquitectura del parser
1. **Parser determinista en TypeScript** (paquete compartido `packages/parser`, usado igual por la app y por el Worker). Resuelve el 90 % de los casos sin IA y sin internet.
2. **Diccionario de categorías** (palabras clave → categoría), más un **aprendizaje por usuario**: si el usuario corrige "galleta → Tiendita", se guarda una regla personal y la próxima vez acierta.
3. **Respaldo con IA** (Workers AI) solo cuando la confianza sea menor a 0.6, y siempre devolviendo el mismo esquema JSON validado con Zod.
4. Si aun así es ambiguo: se guarda con la categoría "Por revisar" y se le pregunta al usuario con botones.

### 4.3 Esquema de salida
```ts
type ParsedEntry = {
  kind: 'expense' | 'income' | 'transfer' | 'loan_given' | 'loan_received'
      | 'debt_payment' | 'split' | 'installments' | 'recurring';
  amountCents: number;          // siempre positivo
  currency: 'MXN' | 'USD' | string;
  description: string;          // "galleta de la tienda"
  merchant?: string;            // "OXXO"
  categoryId?: string;          // sugerida
  accountHint?: string;         // "bbva", "nu", "efectivo"
  toAccountHint?: string;       // transferencias
  date: string;                 // ISO; "ayer", "el lunes", "15 de nov"
  person?: string;              // préstamos / compartidos
  splitCount?: number;          // "entre 3"
  installments?: number;        // "a 12 msi"
  recurrence?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  tags: string[];               // "#viaje"
  confidence: number;           // 0..1
};
```

### 4.4 Casos de prueba obligatorios (deben pasar todos en Vitest)
| Entrada | Resultado esperado |
|---|---|
| `galleta de la tienda 30 pesos` | gasto, $30, "galleta de la tienda", Tiendita/Snacks, hoy |
| `galleta 30` | gasto, $30, Snacks |
| `uber 85` | gasto, $85, Transporte, comercio Uber |
| `ayer tacos 120` | gasto, $120, Comida, fecha = ayer |
| `+15000 quincena` / `me pagaron 15 mil` | ingreso, $15,000, Sueldo |
| `gasolina 500 con bbva` | gasto, $500, Gasolina, cuenta BBVA |
| `netflix 299 cada mes` | gasto recurrente mensual, Suscripciones |
| `le presté 200 a Juan` | préstamo otorgado, $200, persona Juan |
| `Juan me pagó 200` | liquida el préstamo de Juan |
| `cena 900 entre 3` | gasto compartido: $900 total, tu parte $300, $600 por cobrar |
| `tv 12000 a 12 msi con nu` | compra a 12 MSI, $1,000 al mes en tarjeta Nu |
| `pagué 3500 de la tarjeta nu` | pago de deuda/tarjeta (transferencia, no gasto) |
| `pasé 1000 de bbva a efectivo` | transferencia entre cuentas |
| `hotel 200 dls #viaje` | gasto, USD 200 convertido a MXN, etiqueta viaje |
| `$1,250.50 super` / `1.5k súper` / `mil doscientos súper` | montos correctos (comas, k, palabras) |
| `oxxo 45.50 refresco y papas` | gasto, $45.50, comercio OXXO |
| `tanda 500` | aportación a la tanda activa |
| `cetes 5000` | aportación a la inversión CETES |

Incluye además pruebas de "sin monto" (debe pedir el monto), montos negativos, emojis y faltas de ortografía comunes ("gasolna", "super", "súper").

---

## 5. Bot de WhatsApp (pieza estrella)

### 5.1 Costo
Con la **WhatsApp Cloud API oficial de Meta**, los mensajes de servicio (respuestas dentro de las 24 h después de que el usuario escribe) son **gratuitos**. Como aquí siempre escribe primero el usuario y el bot solo responde, el costo es $0. **No** enviar plantillas de marketing. Los resúmenes y avisos proactivos van por **push de la app**; por WhatsApp solo si el usuario escribió en las últimas 24 h.

### 5.2 Vinculación del número
1. En la app: Configuración → WhatsApp → "Vincular" muestra un código de 6 dígitos (válido 10 min) y un botón que abre `wa.me/<número>?text=vincular%20123456`.
2. El Worker recibe "vincular 123456", valida el código, y guarda `phone → uid` (número hasheado con SHA-256 + sal).
3. Responde: "✅ ¡Listo! Ya puedes mandarme tus gastos. Prueba: *galleta 30*".

### 5.3 Qué entiende el bot
- **Texto**: cualquier frase de §4.4.
- **Nota de voz** 🎤: se descarga el audio, se transcribe con Whisper (Workers AI) y se procesa como texto. Responde mostrando lo que entendió.
- **Foto de ticket** 📸: modelo de visión → extrae total, comercio y fecha → propone el movimiento con botones para confirmar.
- **Varios en un mensaje**: `tacos 120, refresco 25, uber 60` → 3 movimientos.
- **Comandos**: `saldo`, `hoy`, `semana`, `mes`, `presupuesto comida`, `deshacer`, `ayuda`, `cuentas`, `desvincular`.
- **Preguntas** (nivel con asistente): "¿cuánto llevo en comida este mes?".

### 5.4 Respuesta tipo
```
✅ Guardado
🍪 Galleta de la tienda — $30.00
📁 Snacks · 💵 Efectivo · 📅 Hoy
Comida este mes: $1,840 de $3,000 (61 %)
[✏️ Categoría] [💳 Cuenta] [↩️ Deshacer]
```
Usar **mensajes interactivos con botones de respuesta** (gratis dentro de la ventana de servicio). Para elegir categoría, usar un **mensaje de lista**.

### 5.5 Seguridad del webhook
Verificar la firma `X-Hub-Signature-256` con el App Secret, que los mensajes sean idempotentes por `message.id` (guardar los IDs procesados en KV durante 48 h), limitar la frecuencia por número y rechazar números no vinculados con instrucciones para vincularse.

### 5.6 Lo que el dueño tendrá que hacer (guíalo paso a paso)
Crear una cuenta en Meta for Developers → crear una app tipo "Business" → agregar el producto WhatsApp → obtener el número de prueba, el Phone Number ID, un token permanente (usuario del sistema) y el App Secret → configurar la URL del webhook del Worker y el token de verificación. Después, opcionalmente, registrar su propio número.

---

## 6. Traer datos de los bancos (sin pagar y sin pedir contraseñas)

En México los agregadores de *open finance* (por ejemplo **Belvo**) existen y conectan bancos como BBVA y Banamex, pero son servicios empresariales **de pago**, con contrato y demo comercial. Por eso la app usa **4 vías gratuitas** desde el día 1 y deja la de pago lista para enchufar después:

### 6.1 Importar estado de cuenta (Fase 4)
- Arrastrar o subir **CSV, XLSX, OFX/QFX** y, como mejora, **PDF** (extraer texto con pdf.js en el navegador).
- **Perfiles por banco** con detección automática de columnas: BBVA, Banorte, Santander, Banamex, HSBC, Scotiabank, Nu, Mercado Pago, Hey Banco, Banco Azteca, Spin by OXXO, Klar, Stori, más un perfil genérico con asistente de mapeo de columnas que se guarda.
- **Deduplicación**: hash de fecha + monto + descripción normalizada, y emparejar con movimientos ya capturados a mano (±3 días, mismo monto) para no duplicar.
- Vista previa antes de importar, con categorías ya sugeridas.

### 6.2 Reenvío de correos de notificación del banco (Fase 5) ⭐
Los bancos mandan un correo por cada compra ("Compra aprobada por $245.00 en OXXO…").
- Cada usuario obtiene una dirección única, por ejemplo `u-<id>@<dominio>` vía **Cloudflare Email Routing → Email Worker** (gratis; requiere que el dueño tenga un dominio. Si no lo tiene, ofrecerle opciones baratas y explicárselo, o dejar esta vía para después).
- El usuario crea en Gmail un filtro que reenvía los correos de su banco a esa dirección (con una guía visual en la app).
- El Worker trae **plantillas de extracción por banco** (regex) y, si no hay coincidencia, usa el LLM de respaldo. Crea el movimiento como "importado automáticamente" y manda push: "💳 Nueva compra BBVA $245 OXXO — ¿categoría Tiendita?".

### 6.3 CFDI del SAT (Fase 7)
Subir los XML de facturas (o un ZIP). Se leen el emisor, el RFC, el total, la fecha y el uso CFDI. Sirven para emparejar con movimientos y para marcar deducibles.

### 6.4 Notificaciones del celular (solo APK Android, opcional, Fase 6)
Plugin nativo de Capacitor con **NotificationListenerService**: con permiso explícito del usuario, leer **solo** las notificaciones de las apps bancarias que él elija (BBVA, Nu, Mercado Pago…) y convertir "Compraste $120 en Starbucks" en un movimiento. Todo se procesa en el teléfono y se muestra una pantalla de privacidad clara antes de activarlo.

### 6.5 Agregador de pago (preparado pero apagado)
Crear la interfaz `BankConnector` (`connect`, `listAccounts`, `syncTransactions`) con la implementación `ManualImportConnector` activa y un `BelvoConnector` *stub* con comentarios. Debe ser posible activarlo con variables de entorno si algún día el negocio lo paga.

---

## 7. Modelo de datos (Firestore)

```
users/{uid}
  profile: { name, email, level: 'basic'|'organized'|'expert', currency:'MXN',
             locale:'es-MX', payday: {type:'biweekly', days:[15,30]}, createdAt }
  settings: { theme, privacyMode, pinEnabled, notifications:{...}, quietHours }

users/{uid}/accounts/{accountId}
  { name, type:'cash'|'debit'|'credit'|'savings'|'investment'|'wallet'|'voucher'|'loan',
    institution?, currency, openingBalanceCents, color, icon, archived,
    credit?: { limitCents, cutoffDay, dueDay, annualRate } }

users/{uid}/transactions/{txId}
  { kind, amountCents, currency, fxRate?, amountMxnCents,
    accountId, toAccountId?, categoryId, tags[], description, merchant?,
    date, createdAt, updatedAt, source:'app'|'whatsapp'|'voice'|'receipt'|'email'|'import'|'notification'|'recurring',
    rawText?, status:'cleared'|'pending'|'review', reconciled:boolean,
    splitId?, installmentPlanId?, recurringId?, loanId?, goalId?, attachments[] ,
    dedupeHash }

users/{uid}/categories/{id}   { name, emoji, color, parentId?, type:'expense'|'income', group:'needs'|'wants'|'savings' }
users/{uid}/rules/{id}        { match:{contains|merchant|regex}, set:{categoryId,accountId,tags}, priority, learned:boolean }
users/{uid}/budgets/{yyyy-mm} { method:'category'|'503020'|'zero', lines:{[categoryId]: {assignedCents, rollover}} , toAssignCents }
users/{uid}/recurring/{id}    { template, frequency, nextDate, remindDaysBefore, active }
users/{uid}/goals/{id}        { name, targetCents, targetDate, savedCents, accountId?, type:'normal'|'emergency' }
users/{uid}/debts/{id}        { name, balanceCents, annualRate, minPaymentCents, accountId? }
users/{uid}/installmentPlans/{id} { description, totalCents, months, paidMonths, accountId, startDate }
users/{uid}/loans/{id}        { person, direction:'lent'|'borrowed', amountCents, paidCents, dueDate? }
users/{uid}/splits/{id}       { totalCents, participants:[{name, shareCents, paid}] }
users/{uid}/tandas/{id}       { name, contributionCents, participants, myTurn, frequency, startDate }
users/{uid}/investments/{id}  { name, type:'cetes'|'afore'|'fund'|'stock'|'crypto'|'other', contributions[], currentValueCents, updatedAt }
users/{uid}/snapshots/{yyyy-mm} { netWorthCents, assetsCents, liabilitiesCents }   // lo escribe el cron
users/{uid}/cfdi/{uuid}       { rfcEmisor, nombre, totalCents, fecha, usoCfdi, deductible, txId? }
users/{uid}/devices/{token}   { platform, createdAt }   // tokens FCM

households/{hid}              { members:[uid], name }   // modo pareja/familia
households/{hid}/...          (cuentas, presupuestos y movimientos compartidos, mismo esquema)

waLinks/{phoneHash}           { uid, linkedAt }         // solo lo lee/escribe el Worker
linkCodes/{code}              { uid, expiresAt }
```

- **Saldos**: calcularlos a partir de los movimientos, con agregados mensuales cacheados en `users/{uid}/aggregates/{yyyy-mm}` (actualizados en el cliente con transacciones por lotes) para que el inicio cargue rápido.
- **Reglas de seguridad**: cada usuario solo lee y escribe `users/{su uid}`; en `households`, solo los miembros; `waLinks` y `linkCodes` sin acceso desde el cliente (excepto crear su propio código). Validar tipos y que los montos sean enteros. **Escribir pruebas de las reglas con el emulador.**
- Índices compuestos necesarios en `firestore.indexes.json`.

---

## 8. Diseño de interfaz

- **Estilo**: limpio y neutro con **un solo color de acento** (propón 3 paletas para que el dueño elija; por defecto, verde esmeralda). Tipografía Inter. Esquinas redondeadas, mucho espacio en blanco y números grandes y legibles. Verde para ingresos y neutro (no rojo agresivo) para gastos.
- **Móvil primero**, con barra inferior: **Inicio · Movimientos · ➕ (captura) · Presupuesto · Más**. En escritorio, barra lateral y paneles más amplios.
- **Inicio**: saldo disponible, gastado del mes vs. presupuesto, próximos pagos (tarjetas, recurrentes, MSI), y alertas ("Te quedan $420 en Comida para 9 días").
- **Captura**: botón ➕ grande → campo con el teclado abierto al instante, chips de sugerencia (últimas 5 categorías) y vista previa en vivo.
- **Movimientos**: lista agrupada por día, búsqueda, filtros (cuenta, categoría, etiqueta, rango) y deslizar para editar o borrar.
- Ilustraciones y textos con personalidad amable ("¡Vas muy bien! 🎉 Llevas 3 días sin gastos hormiga").
- **Gastos hormiga** ⭐: detectar gastos pequeños y frecuentes (<$100: café, dulces, refrescos) y mostrar "Tus gastos hormiga del mes: $1,120 = 37 cafés ☕".
- Accesibilidad AA, foco visible y etiquetas ARIA.

Usa el skill o las guías de diseño frontend disponibles para que no se vea como plantilla genérica.

---

## 9. Seguridad y privacidad

- Nunca pedir, guardar ni transmitir contraseñas bancarias.
- Reglas de Firestore estrictas, con pruebas.
- Secrets solo en Wrangler/GitHub Secrets, nunca en el repo (`.env.example` sin valores).
- Teléfonos de WhatsApp hasheados; los textos crudos de WhatsApp y de correo se borran a los 30 días (dejar solo el movimiento).
- PIN/huella local (Capacitor Biometric en el APK; WebAuthn o PIN en la PWA).
- Exportar todos los datos (JSON + CSV) y **borrar cuenta** (borra todo en cascada desde el Worker).
- Página de **Aviso de privacidad** y **Términos** en español (borradores claros, marcados como "revisar con abogado").
- CSP y headers de seguridad en Firebase Hosting.

---

## 10. Estructura del repositorio

```
/ (monorepo con pnpm workspaces)
├─ apps/
│  ├─ web/            # React PWA (también la base de Capacitor)
│  │  ├─ android/     # proyecto Capacitor generado
│  │  └─ src/{features,components,lib,pages,stores,i18n}
│  └─ worker/         # Cloudflare Worker (whatsapp, email, cron, ai, fcm)
├─ packages/
│  ├─ parser/         # parser de lenguaje natural + pruebas
│  ├─ core/           # tipos, esquemas Zod, cálculos (saldos, MSI, deudas, proyecciones)
│  └─ bank-profiles/  # perfiles de importación y plantillas de correo por banco
├─ firebase/          # firestore.rules, firestore.indexes.json, firebase.json
├─ .github/workflows/ # ci.yml, deploy-web.yml, deploy-worker.yml, android-release.yml
├─ docs/              # GUIA-DUENO.md, ARQUITECTURA.md, PRIVACIDAD.md, guías de bancos
└─ README.md
```

---

## 11. Plan por fases (con criterios de "terminado")

Construye en este orden. Cada fase termina **desplegada y con pruebas en verde**.

| Fase | Qué | Terminado cuando… |
|---|---|---|
| **0. Preparación** | Monorepo, lint, TypeScript estricto, Vitest y CI. Guiar al dueño para crear el repo en GitHub y el proyecto Firebase (Spark) y para conectar Cloudflare. | El push a `main` corre CI y publica una página "Hola" en Firebase Hosting. |
| **1. Núcleo** | Auth (Google + correo), onboarding con elección de nivel, parser + captura rápida, movimientos (crear/editar/borrar/deshacer), categorías por defecto, inicio Básico, offline. | Puedo escribir "galleta 30" sin internet y aparece en otro dispositivo al reconectar. Todos los casos de §4.4 pasan. |
| **2. Organizado** | Cuentas, saldos, presupuestos (categoría y 50/30/20), recurrentes, metas, tarjetas de crédito (corte/pago), MSI, reportes básicos, exportar CSV/Excel. | Puedo registrar una compra a MSI y ver los próximos pagos en Inicio. |
| **3. WhatsApp** | Worker con webhook, vinculación, texto, varios movimientos por mensaje, comandos, botones, deshacer; después notas de voz y fotos de ticket. | Mando "uber 85" por WhatsApp y aparece en la app en <5 s con respuesta y botones. |
| **4. Importar estados de cuenta** | CSV/XLSX/OFX, perfiles de bancos, mapeo, deduplicación y vista previa. | Importo un CSV de ejemplo de BBVA y de Nu sin duplicar lo capturado a mano. |
| **5. Push y correos** | FCM (web + Android), cron de recordatorios (pagos de tarjeta, recurrentes, presupuesto 80 %, resumen semanal), Email Worker para correos bancarios. | Llega un push un día antes de la fecha de pago de la tarjeta, con la app cerrada. |
| **6. Apps instalables** | PWA completa (manifest, íconos, service worker, botón "Instalar app"), APK con Capacitor compilado en GitHub Actions y publicado en Releases, biometría, lector de notificaciones bancarias opcional. | Descargo el APK desde la web, lo instalo y funciona; en iPhone y PC se instala como app. |
| **7. Experto** | Base cero/sobres, deudas (bola de nieve/avalancha), préstamos, compartidos, tandas, inversiones, patrimonio, proyección de flujo, reglas, conciliación, multimoneda, CFDI/deducibles, modo pareja/familia. | Cada función tiene datos de ejemplo y pruebas de sus cálculos en `packages/core`. |
| **8. Asistente y pulido** | "Pregúntale a Fina", gastos hormiga, logros, modo discreto, accesibilidad, rendimiento (Lighthouse ≥ 90), textos finales, aviso de privacidad. | Lighthouse ≥ 90 en Performance/Accesibilidad/PWA; e2e de los flujos principales en verde. |

**Datos de demo**: un botón "Cargar datos de ejemplo" (3 meses ficticios) para probar y para mostrar la app. Debe poder borrarse con un toque.

---

## 12. Entregables finales

1. Repositorio en GitHub con README en español (qué es, capturas, cómo correrlo).
2. Web publicada en `https://<proyecto>.web.app` con despliegue automático.
3. Worker publicado (`https://<nombre>.<cuenta>.workers.dev`) con el webhook de WhatsApp funcionando.
4. APK en GitHub Releases + enlace "Descargar para Android" en la web.
5. `docs/GUIA-DUENO.md`: cómo funciona todo, cómo cambiar el nombre/colores, dónde están las claves, qué hacer si algo falla, y los costos (todo $0 y los límites de cada plan gratuito).
6. Lista de pendientes y mejoras futuras (agregador bancario, Google Play, App Store, versión de pago con funciones premium).

---

## 13. Ideas extra (libertad creativa; implementarlas si el tiempo lo permite)

- **Reto de ahorro** de 52 semanas o "no gastos este fin de semana", con racha 🔥.
- **"¿Me alcanza?"**: escribes un precio y te dice cómo afectaría tu presupuesto y tu fecha de pago.
- **Calendario de dinero**: vista mensual con días de pago, cobros y vencimientos.
- **Aguinaldo y PTU**: planeador para repartirlos entre deudas, ahorro y gustos.
- **Widget de Android** para anotar desde la pantalla de inicio.
- **Atajo de iPhone** (Shortcuts) que manda la frase al Worker.
- **Compartir a la app** desde otra app (por ejemplo, compartir un SMS del banco).
- **Modo negocio pequeño**: separar personal vs. negocio con su propio reporte.
- **Monetización futura** (no construir pagos ahora): plan gratis generoso + "Pro" (asistente IA ilimitado, modo familia, CFDI), con la lógica de *feature flags* ya lista.

---

## 14. Primer mensaje que debes mandarle al dueño

Antes de programar, hazle **solo estas preguntas** (opción múltiple) y luego arranca la Fase 0:

1. Nombre de la app: ¿dejamos "Fina" o propongo 5 nombres y revisas cuáles te gustan?
2. Color de acento: verde esmeralda (recomendado), azul índigo o morado.
3. ¿Tienes un dominio propio? (Sí / No / Lo compro después). Solo afecta la vía de correos bancarios.
4. ¿Qué bancos usas tú? (para priorizar sus perfiles de importación y de correo).
