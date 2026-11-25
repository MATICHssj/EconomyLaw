# Plan de fases de Fina

De la beta con amigos a una app en la tienda que deja dinero. Fechas aproximadas a partir de diciembre de 2026; se ajustan según lo que diga la gente que la pruebe.

> **Idea central:** primero que **20–40 personas la usen todos los días sin perder datos**; luego la tienda; al final, cobrar por lo que más valor da (que todo se anote solo).

---

## Fase 0 · Preparar la beta (1–2 semanas)

**Meta:** que cualquiera pueda instalar Fina desde una página web en menos de 2 minutos, como si viniera de una tienda, y que reciba actualizaciones sin desinstalar.

**Ya está hecho**
- Página de descarga `/descargar/`: en Android baja el APK con pasos claros; en iPhone abre la app y explica “Agregar a pantalla de inicio”; en la computadora te mandas el enlace por WhatsApp.
- El APK avisa “Hay una versión nueva → Actualizar”. En iPhone y web se actualiza sola.
- Botón **Más → Enviar comentarios** (WhatsApp o correo).
- **Aprende** con 3 rutas de cómo usar la app: *Desde cero*, *Ya me organizo* y *Experto*.

**Te toca a ti**
1. GitHub → **Settings → Pages → Source: GitHub Actions** y hacer **Merge** del PR #1.
2. Crear tu **llave de firma**: `bash scripts/crear-llave-android.sh` y pegar los 4 secretos que te indica en GitHub. Sin llave, cada actualización obliga a desinstalar.
3. **Firebase** (inicio de sesión y respaldo en la nube) siguiendo `docs/GUIA-DUENO.md`; agrega `matichssj.github.io` como dominio autorizado.
4. Poner tu correo y/o WhatsApp de soporte en `apps/web/src/app.public.json` (`feedbackEmail`, `feedbackWhatsApp`) para recibir comentarios.

**Me toca a mí** (hecho el 25 nov)
- ✅ Restaurar respaldos y aviso de respaldo para quien usa la app sin cuenta.
- ✅ “¿Es el mismo gasto?” cuando el banco avisa de algo que ya anotaste.
- ✅ Registro de errores (en el teléfono y, con cuenta, en Firestore) y pantalla amable si algo falla.
- ✅ Pruebas automáticas de la app web y un recorrido en celular simulado en cada cambio.

**Listo cuando:** tú y 2–3 personas la usan una semana sin errores graves y se actualizan encima sin perder nada.

---

## Fase 1 · Beta privada (meses 1–3: dic–feb)

**Meta:** aprender qué confunde, qué falla y qué les encanta. No se cobra nada.

**A quién invitar (20–40 personas)**
- 10 que **nunca** han llevado sus finanzas (ruta *Desde cero*).
- 10 que ya usan Excel u otra app (ruta *Ya me organizo*).
- 5 parejas (modo pareja).
- 5–10 con iPhone.
- Que usen bancos distintos: BBVA, Nu, Banorte, Santander, Mercado Pago…

**Cómo se reparte:** les mandas el enlace `https://matichssj.github.io/EconomyLaw/descargar/` por WhatsApp. Crea un **grupo de WhatsApp de la beta** para avisos y dudas.

**Ritmo**
- Una actualización **cada 2 semanas** (les llega el aviso dentro de la app).
- Encuesta corta a las 2 semanas y al mes (5 preguntas).
- 5 llamadas de 15 minutos: “enséñame cómo anotas un gasto”. Ahí salen las mejores mejoras.
- Revisar **Más → Enviar comentarios** cada semana y responder a todos.

**Qué medir**

| Métrica | Meta |
|---|---|
| Instalan a la primera, sin ayuda | 9 de cada 10 |
| Siguen usándola a la semana | 50 % o más |
| Siguen usándola al mes | 30 % o más |
| Gastos anotados por persona por semana | 10 o más |
| Gastos que se anotaron solos (Android) | 40 % o más |
| “¿Se la recomendarías a un amigo?” (0–10) | promedio 8+ |
| Errores que pierdan datos | 0 |

**Listo cuando:** se cumplen las metas del mes y no hay errores graves abiertos.

---

## Fase 2 · Beta abierta y Google Play (meses 3–5: mar–abr)

**Meta:** pasar la revisión de Google y llegar a 200–1,000 personas.

**Google Play** (pago único de 25 USD)
1. Crear la cuenta de desarrollador en Play Console.
2. **Prueba cerrada con al menos 12 personas durante 14 días seguidos** (requisito para cuentas personales nuevas; usa a la gente de la beta).
3. Subir `fina.aab` (GitHub lo genera solo cuando tienes la llave).
4. Ficha de la tienda: capturas (ya están en `/descargar/shots/`), descripción, ícono.
5. Formularios: **Seguridad de los datos**, aviso de privacidad, declaración del permiso de notificaciones del banco y página web para **borrar la cuenta** (te los dejo redactados).
6. Después, prueba abierta y luego producción.

**Otros**
- Página pública con **lista de espera** y la opción de descargar.
- Número oficial de WhatsApp (Meta Business, verificado).
- Encuesta de precio: “¿Pagarías $49, $69 o $99 al mes por que tus gastos se anoten solos?”.

**Listo cuando:** Google aprueba la app y 1 de cada 3 que la instala sigue activo al mes.

---

## Fase 3 · Lanzamiento (mes 6: mayo)

**Meta:** salir al público en Google Play y crecer sin pagar anuncios al inicio.

- **Android:** publicación en Google Play.
- **iPhone:** sigue como app web instalable (gratis). App Store después: requiere 99 USD al año y compilar en una Mac (o un servicio de Mac en la nube).
- **Contenido:** videos cortos (TikTok, Reels, Shorts) con temas reales: “cuánto gasto en tacos al mes”, “me llegó el aguinaldo, ¿qué hago?”, “cómo no pagar intereses en tu tarjeta”. Retos como el ahorro de 52 semanas.
- **Creadores de finanzas personales en México:** colaboraciones a cambio de acceso Plus o comisión.
- **Referidos:** “invita a alguien y los dos ganan un mes de Plus”.
- **Legal:** aviso de privacidad y términos revisados por un abogado; registro de la marca “Fina” en el IMPI (unos $3,000 MXN por clase; verifica que el nombre esté disponible antes).

---

## Fase 4 · Ganar dinero (meses 6–12)

**Lo gratis se queda gratis** (es lo que hace que la gente llegue): anotar, presupuestos, metas, pagos pendientes, viajes, Aprende, respaldo en la nube.

**Fina Plus** (suscripción; precio a validar en la Fase 2, por ejemplo $59–79 MXN al mes o $599 al año)
- **Tus bancos conectados**: los movimientos llegan solos, sin notificaciones ni correos (con un servicio como Belvo; tiene costo por conexión, por eso es de paga).
- **Modo pareja y familia** completo.
- **WhatsApp con IA** ilimitado (voz, foto de ticket, preguntas).
- **Fina arma tu viaje**: itinerario y presupuesto propuestos por IA.
- Reportes avanzados y exportes.
- **Socios fundadores:** quienes probaron la beta pagan menos para siempre.

**Comisiones de las tiendas:** Google y Apple cobran 15 % de las suscripciones pagadas dentro de la app.

**Otras fuentes**
- **Afiliados:** recomendar cuentas o tarjetas con enlaces de referido, siempre diciendo que es un enlace patrocinado y solo cuando de verdad convenga al usuario.
- **Empresas:** “bienestar financiero” para empleados (pago por empleado al mes). Es la fuente más grande a mediano plazo.
- **Talleres** (por ejemplo, “sal de deudas en 90 días”).
- **Nunca:** vender datos ni mostrar anuncios. La confianza es el producto.

**Ejemplo de números** (supuestos, para darte idea)

| Usuarios activos | Pagan Plus (5 %) | A $69/mes | Te queda después del 15 % de la tienda |
|---|---|---|---|
| 1,000 | 50 | $3,450 | ≈ $2,930 al mes |
| 10,000 | 500 | $34,500 | ≈ $29,300 al mes |
| 50,000 | 2,500 | $172,500 | ≈ $146,600 al mes |

A eso réstale el costo de conectar bancos (por usuario de Plus), servidores (gratis al inicio) e impuestos.

**Para cobrar en regla:** darte de alta en el SAT (por ejemplo en RESICO como persona física) y tener un contador desde el primer peso. Google y Apple te pagan desde el extranjero.

---

## Fase 5 · Crecer (año 2)

- Conexión bancaria automática para todos los bancos grandes.
- App nativa en App Store.
- Modo negocio (para quien vende por su cuenta) y facturación.
- Inversiones (CETES) con datos actualizados.
- Versión para empresas.

---

## Costos por fase

| Fase | Costo | Detalle |
|---|---|---|
| 0–1 | $0 | GitHub, Firebase, Cloudflare y WhatsApp en planes gratuitos |
| 2 | 25 USD una vez | Cuenta de Google Play |
| 3 | ≈ $3,000 MXN + 99 USD/año (opcional) | Marca en IMPI; App Store solo si se hace nativa |
| 4 | Variable | Conexión bancaria (cotizar), contador, abogado |

Los planes gratuitos alcanzan para cientos de usuarios activos; al crecer se paga según uso (Firebase “Blaze” y Cloudflare).

---

## Qué hago yo en cada fase

| Fase | Yo | Tú |
|---|---|---|
| 0 | Respaldos, duplicados, pruebas, registro de errores | Pages + Merge, llave, Firebase, correo de soporte |
| 1 | Una versión cada 2 semanas con lo que digan los testers | Invitar, grupo de WhatsApp, encuestas y llamadas |
| 2 | AAB, textos de la ficha y formularios de Google, página para borrar cuenta | Cuenta de Play, 12 testers 14 días, subir a la consola |
| 3 | Mejoras de lanzamiento, referidos | Contenido, creadores, abogado, IMPI |
| 4 | Fina Plus, pagos con Google Play, conexión bancaria | Precio final, SAT y contador, acuerdos con Belvo/afiliados |
