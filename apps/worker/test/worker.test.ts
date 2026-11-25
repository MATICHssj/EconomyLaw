import { describe, expect, it, beforeEach } from 'vitest';
import { buildDefaultCategories, type Account, type Transaction } from '@fina/core';
import { handleMessage, type BotDeps } from '../src/bot';
import { runDaily } from '../src/cron';
import { addressForUid, handleBankEmail, uidFromAddress } from '../src/email';
import { createApp } from '../src/index';
import { hmacSha256Hex, hashPhone, verifyMetaSignature } from '../src/lib/crypto';
import { MemoryStore } from '../src/lib/store';
import type { Incoming, Messenger } from '../src/lib/whatsapp';
import type { Env } from '../src/env';

class FakeKV {
  m = new Map<string, string>();
  async get(k: string) {
    return this.m.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.m.set(k, v);
  }
  async delete(k: string) {
    this.m.delete(k);
  }
}

class FakeWA implements Messenger {
  sent: Array<{ to: string; body: string; buttons?: string[]; list?: string[] }> = [];
  async text(to: string, body: string) {
    this.sent.push({ to, body });
  }
  async buttons(to: string, body: string, buttons: Array<{ id: string; title: string }>) {
    this.sent.push({ to, body, buttons: buttons.map((b) => b.id) });
  }
  async list(to: string, body: string, _l: string, rows: Array<{ id: string; title: string }>) {
    this.sent.push({ to, body, list: rows.map((r) => r.id) });
  }
  async downloadMedia() {
    return { bytes: new Uint8Array(), mime: 'audio/ogg' };
  }
  async markRead() {}
  last() {
    return this.sent[this.sent.length - 1]!;
  }
}

const env = { FIREBASE_PROJECT_ID: 'demo', ALLOWED_ORIGINS: 'https://app.test', APP_URL: 'https://app.test', PHONE_HASH_SALT: 'sal', WHATSAPP_APP_SECRET: 'secreto', WHATSAPP_VERIFY_TOKEN: 'verifica' } as unknown as Env;
const PHONE = '5215512345678';
const now = () => new Date('2025-11-20T18:00:00Z');
let n = 0;
const msg = (text: string, extra: Partial<Incoming> = {}): Incoming => ({ id: `wamid.${n++}`, from: PHONE, type: 'text', text, ...extra });

let store: MemoryStore;
let wa: FakeWA;
let kv: FakeKV;
let deps: BotDeps;

async function linkUser() {
  await store.set('users/ana', { profile: { name: 'Ana', level: 'basic' } });
  for (const c of buildDefaultCategories()) await store.set(`users/ana/categories/${c.id}`, c);
  const acc: Account = { id: 'cash', name: 'Efectivo', type: 'cash', institution: 'cash', currency: 'MXN', openingBalanceCents: 100000, color: '#000', icon: '💵', archived: false, aliases: [], createdAt: '2025-01-01' };
  await store.set('users/ana/accounts/cash', acc);
  await store.set(`waLinks/${await hashPhone(PHONE, 'sal')}`, { uid: 'ana' });
}

beforeEach(() => {
  store = new MemoryStore();
  wa = new FakeWA();
  kv = new FakeKV();
  deps = { env, store, wa, kv: kv as unknown as KVNamespace, now };
});

describe('vinculación', () => {
  it('pide vincular si el número es desconocido', async () => {
    await handleMessage(deps, msg('galleta 30'));
    expect(wa.last().body).toContain('vincula tu número');
  });
  it('vincula con un código vigente y lo consume; rechaza vencidos', async () => {
    await store.set('linkCodes/123456', { uid: 'ana', expiresAtMs: now().getTime() + 60_000 });
    await store.set('linkCodes/999999', { uid: 'ana', expiresAtMs: now().getTime() - 1 });
    await handleMessage(deps, msg('vincular 999999'));
    expect(wa.last().body).toContain('no es válido');
    await handleMessage(deps, msg('vincular 123456'));
    expect(wa.last().body).toContain('¡Listo!');
    expect(await store.get(`waLinks/${await hashPhone(PHONE, 'sal')}`)).toEqual({ uid: 'ana', linkedAt: now().toISOString() });
    expect(await store.get('linkCodes/123456')).toBeNull();
  });
});

describe('mensajes', () => {
  beforeEach(linkUser);
  it('"uber 85" crea el movimiento y responde con botones', async () => {
    await handleMessage(deps, msg('uber 85'));
    const txs = await store.list<Transaction>('users/ana/transactions');
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ amountCents: 8500, categoryId: 'transport', merchant: 'Uber', source: 'whatsapp', accountId: 'cash' });
    expect(wa.last().body).toContain('✅ Guardado');
    expect(wa.last().buttons).toEqual([`cat:${txs[0]!.id}`, `acc:${txs[0]!.id}`, `undo:${txs[0]!.id}`]);
  });
  it('varios movimientos y "deshacer"', async () => {
    await handleMessage(deps, msg('tacos 120, refresco 25, uber 60'));
    expect(await store.list('users/ana/transactions')).toHaveLength(3);
    expect(wa.last().body).toContain('Guardé 3 movimientos');
    await handleMessage(deps, msg('deshacer'));
    expect(await store.list('users/ana/transactions')).toHaveLength(0);
  });
  it('MSI y compartidos crean sus documentos', async () => {
    await handleMessage(deps, msg('tv 12000 a 12 msi'));
    await handleMessage(deps, msg('cena 900 entre 3'));
    expect(await store.list('users/ana/installmentPlans')).toHaveLength(1);
    const splits = await store.list<{ participants: unknown[] }>('users/ana/splits');
    expect(splits[0]!.participants).toHaveLength(3);
    expect(wa.last().body).toContain('Tu parte: $300');
  });
  it('cambiar categoría con botón aprende la regla', async () => {
    await handleMessage(deps, msg('chuchito 50'));
    const tx = (await store.list<Transaction>('users/ana/transactions'))[0]!;
    await handleMessage(deps, msg('', { type: 'button', buttonId: `cat:${tx.id}` }));
    expect(wa.last().list).toContain(`setcat:${tx.id}:snacks`);
    await handleMessage(deps, msg('', { type: 'button', buttonId: `setcat:${tx.id}:snacks` }));
    expect((await store.get<Transaction>(`users/ana/transactions/${tx.id}`))!.categoryId).toBe('snacks');
    await handleMessage(deps, msg('chuchito 20'));
    const second = (await store.list<Transaction>('users/ana/transactions')).find((t) => t.amountCents === 2000)!;
    expect(second.categoryId).toBe('snacks');
  });
  it('comandos y preguntas', async () => {
    await handleMessage(deps, msg('galleta 30'));
    await handleMessage(deps, msg('saldo'));
    expect(wa.last().body).toContain('Disponible: *$970*');
    await handleMessage(deps, msg('hoy'));
    expect(wa.last().body).toContain('$30');
    await handleMessage(deps, msg('¿cuánto llevo en tiendita este mes?'));
    expect(wa.last().body).toMatch(/\$30/);
    await handleMessage(deps, msg('ayuda'));
    expect(wa.last().body).toContain('Comandos');
  });
  it('sin monto pide el monto', async () => {
    await handleMessage(deps, msg('galleta'));
    expect(wa.last().body).toContain('¿Cuánto fue?');
  });
  it('idempotente: el mismo id de mensaje se procesa una vez', async () => {
    const m = msg('galleta 30');
    await handleMessage(deps, m);
    await handleMessage(deps, m);
    expect(await store.list('users/ana/transactions')).toHaveLength(1);
  });
  it('límite de frecuencia', async () => {
    for (let i = 0; i < 22; i++) await handleMessage(deps, msg(`galleta ${i + 1}`));
    expect((await store.list('users/ana/transactions')).length).toBe(20);
    expect(wa.sent.some((s) => s.body.includes('Vas muy rápido'))).toBe(true);
  });
});

describe('webhook HTTP', () => {
  const bindings = () => ({ ...env, KV: new FakeKV() }) as unknown as Env;
  const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  it('verificación de Meta', async () => {
    const app = createApp(() => new MemoryStore());
    const ok = await app.request('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verifica&hub.challenge=42', {}, bindings(), ctx);
    expect(await ok.text()).toBe('42');
    const bad = await app.request('/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42', {}, bindings(), ctx);
    expect(bad.status).toBe(403);
  });
  it('rechaza mensajes sin firma válida', async () => {
    const app = createApp(() => new MemoryStore());
    const body = JSON.stringify({ entry: [] });
    const bad = await app.request('/whatsapp/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=deadbeef' } }, bindings(), ctx);
    expect(bad.status).toBe(401);
    const sig = await hmacSha256Hex('secreto', body);
    const good = await app.request('/whatsapp/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${sig}` } }, bindings(), ctx);
    expect(good.status).toBe(200);
    expect(await verifyMetaSignature('secreto', body, `sha256=${sig}`)).toBe(true);
  });
  it('la API exige sesión', async () => {
    const app = createApp(() => new MemoryStore());
    const r = await app.request('/api/account/delete', { method: 'POST' }, bindings(), ctx);
    expect(r.status).toBe(401);
  });
});

describe('cron', () => {
  it('avisa el pago de la tarjeta y el presupuesto al 80 %, una sola vez', async () => {
    await store.set('users/ana', { settings: {} });
    await store.set('users/ana/accounts/nu', { id: 'nu', name: 'Nu', type: 'credit', currency: 'MXN', openingBalanceCents: 0, color: '#000', icon: '💳', archived: false, aliases: [], createdAt: '2025-01-01', credit: { limitCents: 1000000, cutoffDay: 5, dueDay: 25, annualRate: 0.6, minPaymentRate: 0.05 } });
    await store.set('users/ana/transactions/t1', { id: 't1', kind: 'expense', amountCents: 90000, amountMxnCents: 90000, currency: 'MXN', accountId: 'nu', categoryId: 'food', tags: [], description: 'Cena', date: '2025-11-01', createdAt: '2025-11-01T10:00:00Z', updatedAt: '', source: 'app', status: 'cleared', reconciled: false, attachments: [] });
    await store.set('users/ana/budgets/2025-11', { id: '2025-11', method: 'category', lines: { food: { assignedCents: 100000, rollover: false } } });
    for (const c of buildDefaultCategories()) await store.set(`users/ana/categories/${c.id}`, c);
    const pushes: string[] = [];
    const push = { send: async (_uid: string, m: { title: string }) => (pushes.push(m.title), 1) };
    const d = { store, kv: kv as unknown as KVNamespace, push, now: () => new Date('2025-11-23T15:00:00Z') };
    await runDaily(d);
    expect(pushes.some((p) => p.includes('Nu: pagas en 2 días'))).toBe(true);
    expect(pushes.some((p) => p.includes('90 %'))).toBe(true);
    const before = pushes.length;
    await runDaily(d);
    expect(pushes.length).toBe(before);
    expect(await store.get('users/ana/snapshots/2025-11')).not.toBeNull();
  });
});

describe('correos del banco', () => {
  it('dirección única por usuario (ida y vuelta)', () => {
    const a = addressForUid('AbC123xyz789QWE', 'fina.mx');
    expect(uidFromAddress(a)).toBe('AbC123xyz789QWE');
    expect(uidFromAddress('hola@fina.mx')).toBeNull();
  });
  it('crea el movimiento y manda push', async () => {
    await store.set('users/ana1234567', { profile: {} });
    await store.set('users/ana1234567/accounts/bbva', { id: 'bbva', name: 'BBVA', type: 'debit', institution: 'bbva', currency: 'MXN', openingBalanceCents: 0, color: '#000', icon: '🏦', archived: false, aliases: [], createdAt: '' });
    const pushes: string[] = [];
    const raw = ['From: Mi Gmail <yo@gmail.com>', 'To: x', 'Subject: Fwd: Compra aprobada', 'Content-Type: text/plain; charset=utf-8', '', '---------- Forwarded message ---------', 'De: BBVA <notificaciones@bbva.mx>', 'Se realizó una compra aprobada por $245.00 en OXXO SUC 23 con tu tarjeta terminación 1234.'].join('\r\n');
    const r = await handleBankEmail({ store, push: { send: async (_u, m) => (pushes.push(`${m.title} ${m.body}`), 1) } }, { to: addressForUid('ana1234567', 'fina.mx'), from: 'yo@gmail.com', raw });
    expect(r).toBe('ok');
    const txs = await store.list<Transaction>('users/ana1234567/transactions');
    expect(txs[0]).toMatchObject({ amountCents: 24500, merchant: 'OXXO', accountId: 'bbva', source: 'email' });
    expect(pushes[0]).toContain('$245');
  });
});
