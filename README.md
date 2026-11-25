# Fina · finanzas personales que se anotan en 3 segundos

**Fina** es una app de finanzas personales hecha para México: registras un gasto escribiendo *“galleta 30”* (en la app, por voz o por WhatsApp) y la app crece contigo, desde *“solo quiero saber en qué se me va”* hasta presupuestos por sobres, tarjetas con fecha de corte, MSI, deudas, tandas, inversiones, patrimonio, deducibles del SAT y **finanzas en pareja**.

> Funciona en el navegador, se instala en iPhone, Android y computadora, trabaja sin internet y toda la infraestructura cabe en planes gratuitos (sin tarjeta de crédito).

## Qué hace

| | |
|---|---|
| ✍️ **Captura en 3 segundos** | Una línea de texto: monto, categoría, cuenta y fecha se adivinan solos. Entiende `tv 12000 a 12 msi con nu`, `cena 900 entre 3`, `+15000 quincena`, `le presté 200 a Juan`, `hotel 200 dls #viaje`, faltas de ortografía y varios gastos en un mensaje. Aprende de tus correcciones. |
| 🌱 **3 niveles** | Básico, Organizado y Experto: la interfaz muestra solo lo que necesitas. Subir de nivel no pierde nada. |
| 💬 **WhatsApp** | Texto, notas de voz y fotos de tickets. Comandos (`saldo`, `hoy`, `mes`, `deshacer`…), botones para corregir y preguntas (“¿cuánto llevo en Uber?”). |
| 🇲🇽 **Hecha para México** | Quincenas, MSI, fecha de corte/pago, “pago para no generar intereses”, tandas, CETES, Afore, vales, OXXO, CFDI y deducciones personales. |
| 💑 **Pareja / familia** | Espacio compartido, cuentas personales privadas y “cuentas claras” (50/50 o proporcional al ingreso). |
| 🎓 **Enseña a usarla** | Bienvenida guiada, misiones por nivel y lecciones de 2 minutos (gastos hormiga, 50/30/20, tarjetas, MSI, deudas, CETES, SAT…). |
| 🏦 **Bancos sin contraseñas** | Importa CSV/Excel/OFX de 13+ bancos sin duplicar, reenvía correos de “compra aprobada” o (Android) deja que lea solo las notificaciones de tu banco. |
| 🔒 **Segura** | Reglas de Firestore estrictas y probadas, login con verificación de correo, PIN/huella, modo discreto, CSP, exportar y borrar todo. |

## Estructura

```
apps/web          App React + Vite + Tailwind (PWA) y proyecto Android (Capacitor)
apps/worker       Cloudflare Worker: WhatsApp, cron de recordatorios, correos, push, IA
packages/core     Modelo de datos y cálculos (saldos, presupuestos, tarjetas, MSI, deudas…)
packages/parser   Parser de lenguaje natural + asistente "Pregúntale a Fina"
packages/bank-profiles  Importación de estados de cuenta y lectura de correos bancarios
firebase          Reglas de seguridad, índices y sus pruebas con el emulador
docs              Guía del dueño, arquitectura, seguridad y pendientes
```

## Correr en tu computadora

```bash
corepack enable          # activa pnpm
pnpm install
pnpm dev                 # abre http://localhost:5173 (modo sin cuenta, todo local)
pnpm check               # revisor + tipos + pruebas (97 pruebas)
pnpm --filter @fina/firebase test:rules   # reglas de seguridad (requiere Java)
```

Sin configurar nada, la app funciona en **modo local** (los datos viven en el dispositivo). Para cuentas, sincronización, WhatsApp y notificaciones sigue **[docs/GUIA-DUENO.md](docs/GUIA-DUENO.md)**.

## Documentación

- [Guía del dueño](docs/GUIA-DUENO.md): cómo activar todo paso a paso, costos ($0) y qué hacer si algo falla.
- [Arquitectura](docs/ARQUITECTURA.md) · [Seguridad](docs/SEGURIDAD.md) · [Pendientes y mejoras](docs/PENDIENTES.md)
- [Especificación original](docs/INSTRUCCIONES-APP-FINANZAS.md)

Para cambiar el nombre o los colores de la app: `packages/core/src/brand.ts`.
