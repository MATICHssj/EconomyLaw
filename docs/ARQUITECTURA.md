# Arquitectura

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│ App (React PWA)  apps/web       │        │ Cloudflare Worker  apps/worker   │
│ • Web, iPhone, escritorio (PWA) │◄──────►│ • Webhook WhatsApp (Hono)        │
│ • Android (Capacitor + plugin)  │  HTTPS │ • Email Worker (correos banco)   │
│ • Offline: IndexedDB o caché    │        │ • Cron diario: avisos, resumen   │
│   persistente de Firestore      │        │ • Workers AI: voz, tickets, IA   │
└───────────────┬─────────────────┘        │ • Push con FCM v1                │
                │ SDK                      └───────────────┬──────────────────┘
                ▼                                          │ REST + cuenta de servicio
┌─────────────────────────────────┐                        │
│ Firebase (plan Spark)           │◄───────────────────────┘
│ Auth · Firestore · Hosting · FCM│
└─────────────────────────────────┘
```

## Paquetes compartidos
- **`@fina/core`**: modelo de datos (Zod) y cálculos puros: saldos, presupuestos (categoría, 50/30/20, base cero), tarjetas (corte, fecha límite, pago sin intereses), MSI, deudas (bola de nieve/avalancha), recurrentes, suscripciones, gastos hormiga, proyección, tandas, préstamos, pareja, patrimonio, metas, CFDI, salud financiera y datos de ejemplo.
- **`@fina/parser`**: parser determinista de lenguaje natural (sin IA ni internet) y el asistente “Pregúntale a Fina”. Lo usan igual la app y el Worker.
- **`@fina/bank-profiles`**: importación CSV/XLSX/OFX, deduplicación, plantillas de correos/notificaciones bancarias y la interfaz `BankConnector` (Belvo apagado).

## Datos
- Montos en **centavos enteros**; fechas `YYYY-MM-DD`; ids aleatorios de 20 caracteres.
- `users/{uid}` (perfil y ajustes) + subcolecciones por tipo (`transactions`, `accounts`, `budgets`…).
- `households/{hid}` + subcolecciones compartidas (`accounts`, `transactions`, `budgets`, `recurring`, `goals`, `installmentPlans`).
- `waLinks`, `linkCodes`, `householdInvites` para vinculación.
- La app usa un **backend intercambiable** (`apps/web/src/lib/backend`): `LocalBackend` (IndexedDB) o `FirebaseBackend` (Firestore con caché persistente). Las escrituras no esperan al servidor: funcionan sin internet.
- Todos los cambios pasan por `lib/actions.ts` como “changesets” con **deshacer**.

## Niveles
`packages/core/src/features.ts` define qué función aparece en cada nivel y deja listo el interruptor de una futura versión Pro (`PRO_ENFORCED = false`).

## Pruebas
- `packages/*` y `apps/worker`: Vitest (97 pruebas: casos del parser, cálculos, importación, bot, cron, correos).
- `firebase/test`: reglas con el emulador de Firestore.
- Recorrido de las 31 pantallas con Playwright durante el desarrollo.
