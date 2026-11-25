import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env';
import { handleMessage } from './bot';
import { runDaily } from './cron';
import { handleBankEmail } from './email';
import { categorize, readReceipt } from './lib/ai';
import { verifyMetaSignature } from './lib/crypto';
import { FcmPusher } from './lib/fcm';
import { deleteAuthUser, verifyIdToken, type VerifiedUser } from './lib/google';
import { FirestoreStore, type Store } from './lib/store';
import { WhatsAppClient, extractMessages } from './lib/whatsapp';

type AppEnv = { Bindings: Env; Variables: { user: VerifiedUser } };

export function createApp(makeStore: (env: Env) => Store = (env) => new FirestoreStore(env)) {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: (origin, c) => {
        const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
        return allowed.includes(origin) ? origin : null;
      },
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 86400,
    }),
  );

  app.get('/', (c) => c.text('Fina API ✅'));
  app.get('/health', (c) => c.json({ ok: true, whatsapp: !!c.env.WHATSAPP_TOKEN, firestore: !!c.env.FIREBASE_SERVICE_ACCOUNT, ai: !!c.env.AI }));

  // ——— WhatsApp ———
  // Verificación del webhook (Meta manda un GET al configurarlo).
  app.get('/whatsapp/webhook', (c) => {
    const mode = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge') ?? '';
    if (mode === 'subscribe' && c.env.WHATSAPP_VERIFY_TOKEN && token === c.env.WHATSAPP_VERIFY_TOKEN) return c.text(challenge);
    return c.text('Prohibido', 403);
  });

  app.post('/whatsapp/webhook', async (c) => {
    const raw = await c.req.text();
    if (!c.env.WHATSAPP_APP_SECRET || !(await verifyMetaSignature(c.env.WHATSAPP_APP_SECRET, raw, c.req.header('x-hub-signature-256') ?? null))) {
      return c.text('Firma inválida', 401);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.text('JSON inválido', 400);
    }
    const msgs = extractMessages(body as Parameters<typeof extractMessages>[0]);
    const deps = { env: c.env, store: makeStore(c.env), wa: new WhatsAppClient(c.env), kv: c.env.KV };
    // Respondemos 200 de inmediato; el procesamiento sigue en segundo plano.
    c.executionCtx.waitUntil(
      Promise.all(
        msgs.map(async (m) => {
          try {
            await handleMessage(deps, m);
          } catch (e) {
            console.error('bot error', e);
            await deps.wa.text(m.from, '😵 Tuve un problema procesando tu mensaje. Intenta de nuevo en un momento.').catch(() => {});
          }
        }),
      ),
    );
    return c.text('ok');
  });

  // ——— API para la app (requiere ID token de Firebase) ———
  const auth = async (c: Context<AppEnv>, next: Next) => {
    const h = c.req.header('authorization') ?? '';
    if (!h.startsWith('Bearer ')) return c.json({ error: 'Falta iniciar sesión' }, 401);
    try {
      c.set('user', await verifyIdToken(h.slice(7), c.env.FIREBASE_PROJECT_ID));
    } catch {
      return c.json({ error: 'Sesión inválida' }, 401);
    }
    // Límite de frecuencia por usuario (60 solicitudes por minuto).
    const key = `rlapi:${c.get('user').uid}:${Math.floor(Date.now() / 60_000)}`;
    const n = Number((await c.env.KV.get(key)) ?? '0') + 1;
    await c.env.KV.put(key, String(n), { expirationTtl: 120 });
    if (n > 60) return c.json({ error: 'Demasiadas solicitudes' }, 429);
    await next();
  };

  app.post('/api/ai/categorize', auth, async (c) => {
    const { text } = await c.req.json<{ text?: string }>();
    if (!text || text.length > 300) return c.json({ categoryId: null });
    return c.json({ categoryId: await categorize(c.env, text).catch(() => null) });
  });

  app.post('/api/receipt', auth, async (c) => {
    const form = await c.req.formData();
    const file = form.get('image') as unknown as Blob | string | null;
    if (!file || typeof file === 'string' || file.size > 6 * 1024 * 1024) return c.json({ error: 'Imagen inválida (máx. 6 MB)' }, 400);
    const r = await readReceipt(c.env, new Uint8Array(await file.arrayBuffer())).catch(() => null);
    return c.json({ total: r?.total ?? null, merchant: r?.merchant ?? null, date: r?.date ?? null, text: '' });
  });

  /** Borrar cuenta: elimina TODO en cascada (datos, vínculo de WhatsApp y usuario). */
  app.post('/api/account/delete', auth, async (c) => {
    const { uid } = c.get('user');
    const store = makeStore(c.env);
    for (const col of await store.subcollections(`users/${uid}`)) {
      const ids = await store.listIds(`users/${uid}/${col}`);
      await store.commit(ids.map((id) => ({ delete: `users/${uid}/${col}/${id}` })));
    }
    await store.delete(`users/${uid}`);
    for (const l of await store.query<{ id: string }>('waLinks', [['uid', '==', uid]])) await store.delete(`waLinks/${l.id}`);
    await deleteAuthUser(c.env, uid);
    return c.json({ ok: true });
  });

  return app;
}

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const store = new FirestoreStore(env);
    ctx.waitUntil(runDaily({ store, kv: env.KV, push: new FcmPusher(env, store), wa: env.WHATSAPP_TOKEN ? new WhatsAppClient(env) : undefined }).then((r) => console.log('cron', r)));
  },
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    const store = new FirestoreStore(env);
    const raw = await new Response(message.raw).arrayBuffer();
    const r = await handleBankEmail({ store, push: new FcmPusher(env, store) }, { to: message.to, from: message.from, raw });
    if (r === 'unknown-user') message.setReject('Destinatario desconocido');
    void ctx;
  },
} satisfies ExportedHandler<Env>;
