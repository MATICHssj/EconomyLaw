import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env: RulesTestEnvironment;
const tx = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'expense', amountCents: 3000, amountMxnCents: 3000, date: '2025-11-20', description: 'galleta', tags: [], ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fina',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

describe('datos personales', () => {
  it('cada quien lee y escribe solo lo suyo', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const beto = env.authenticatedContext('beto').firestore();
    await assertSucceeds(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('t1')));
    await assertSucceeds(getDoc(doc(ana, 'users/ana/transactions/t1')));
    await assertFails(getDoc(doc(beto, 'users/ana/transactions/t1')));
    await assertFails(setDoc(doc(beto, 'users/ana/transactions/t2'), tx('t2')));
    await assertFails(getDocs(collection(beto, 'users/ana/transactions')));
  });
  it('sin sesión no se puede nada', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/ana')));
    await assertFails(setDoc(doc(anon, 'users/ana/transactions/t1'), tx('t1')));
  });
  it('valida montos enteros, tipos y fechas', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    await assertFails(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('t1', { amountCents: 30.5 })));
    await assertFails(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('t1', { amountCents: -100 })));
    await assertFails(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('t1', { kind: 'hack' })));
    await assertFails(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('t1', { date: 'ayer' })));
    await assertFails(setDoc(doc(ana, 'users/ana/transactions/t1'), tx('otro-id')));
    await assertFails(setDoc(doc(ana, 'users/ana/secretos/x'), { id: 'x' }));
  });
  it('viajes: fechas válidas y nombre corto', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const trip = { id: 'v1', name: 'Cancún', startDate: '2026-04-01', endDate: '2026-04-05', items: [], budget: { food: 250000 } };
    await assertSucceeds(setDoc(doc(ana, 'users/ana/trips/v1'), trip));
    await assertFails(setDoc(doc(ana, 'users/ana/trips/v1'), { ...trip, endDate: '2026-03-01' }));
    await assertFails(setDoc(doc(ana, 'users/ana/trips/v1'), { ...trip, startDate: 'pronto' }));
    await assertFails(setDoc(doc(ana, 'users/ana/trips/v1'), { ...trip, name: 'x'.repeat(61) }));
    await assertFails(setDoc(doc(env.authenticatedContext('beto').firestore(), 'users/ana/trips/v2'), { ...trip, id: 'v2' }));
  });
  it('registro de errores: solo agregar, tamaño limitado y solo lo tuyo', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const beto = env.authenticatedContext('beto').firestore();
    const err = { at: '2026-11-25T10:00:00Z', message: 'TypeError: x is undefined', route: '#/viajes', version: '0.1.3', build: '3', platform: 'android-apk', count: 1 };
    await assertSucceeds(setDoc(doc(ana, 'users/ana/errors/e1'), err));
    await assertFails(setDoc(doc(ana, 'users/ana/errors/e1'), { ...err, count: 2 }));
    await assertFails(setDoc(doc(ana, 'users/ana/errors/e2'), { ...err, message: 'x'.repeat(301) }));
    await assertFails(setDoc(doc(ana, 'users/ana/errors/e3'), { ...err, montos: [1, 2] }));
    await assertFails(setDoc(doc(beto, 'users/ana/errors/e4'), err));
    await assertFails(getDoc(doc(beto, 'users/ana/errors/e1')));
  });
  it('perfil: solo profile y settings', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    await assertSucceeds(setDoc(doc(ana, 'users/ana'), { profile: { name: 'Ana', level: 'basic' } }));
    await assertFails(setDoc(doc(ana, 'users/ana'), { isAdmin: true }));
  });
});

describe('hogar / pareja', () => {
  it('crear, invitar y unirse con código; extraños fuera', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const beto = env.authenticatedContext('beto').firestore();
    const eve = env.authenticatedContext('eve').firestore();
    await assertSucceeds(setDoc(doc(ana, 'households/h1'), { name: 'Casa', members: ['ana'], memberNames: { ana: 'Ana' }, createdBy: 'ana', splitMode: 'equal', weights: {} }));
    await assertFails(setDoc(doc(eve, 'households/h2'), { name: 'X', members: ['eve', 'ana'], createdBy: 'eve' }));
    await assertFails(getDoc(doc(beto, 'households/h1')));
    // Sin invitación válida no puede entrar
    await assertFails(updateDoc(doc(beto, 'households/h1'), { members: arrayUnion('beto'), 'memberNames.beto': 'Beto', joinCode: 'ABCDEF' }));
    await assertSucceeds(setDoc(doc(ana, 'householdInvites/ABCDEF'), { hid: 'h1', createdBy: 'ana', expiresAtMs: Date.now() + 86_400_000 }));
    await assertFails(setDoc(doc(eve, 'householdInvites/ZZZZZZ'), { hid: 'h1', createdBy: 'eve', expiresAtMs: Date.now() + 86_400_000 }));
    await assertSucceeds(updateDoc(doc(beto, 'households/h1'), { members: arrayUnion('beto'), 'memberNames.beto': 'Beto', joinCode: 'ABCDEF' }));
    await assertSucceeds(getDoc(doc(beto, 'households/h1')));
    // Datos compartidos: miembros sí, extraños no
    await assertSucceeds(setDoc(doc(beto, 'households/h1/transactions/t1'), tx('t1')));
    await assertSucceeds(getDoc(doc(ana, 'households/h1/transactions/t1')));
    await assertFails(getDoc(doc(eve, 'households/h1/transactions/t1')));
    // Nadie puede expulsar a otro
    await assertFails(updateDoc(doc(beto, 'households/h1'), { members: ['beto'] }));
    // Un código vencido no sirve
    await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'householdInvites/OLDOLD'), { hid: 'h1', createdBy: 'ana', expiresAtMs: Date.now() - 1000 }));
    await assertFails(updateDoc(doc(eve, 'households/h1'), { members: arrayUnion('eve'), joinCode: 'OLDOLD' }));
  });
});

describe('vinculación de WhatsApp', () => {
  it('solo crear tu propio código, que venza pronto, sin leer ni sobrescribir', async () => {
    const ana = env.authenticatedContext('ana').firestore();
    const eve = env.authenticatedContext('eve').firestore();
    await assertSucceeds(setDoc(doc(ana, 'linkCodes/123456'), { uid: 'ana', expiresAtMs: Date.now() + 10 * 60_000 }));
    await assertFails(getDoc(doc(ana, 'linkCodes/123456')));
    await assertFails(setDoc(doc(eve, 'linkCodes/123456'), { uid: 'eve', expiresAtMs: Date.now() + 60_000 }));
    await assertFails(setDoc(doc(eve, 'linkCodes/654321'), { uid: 'ana', expiresAtMs: Date.now() + 60_000 }));
    await assertFails(setDoc(doc(eve, 'linkCodes/111111'), { uid: 'eve', expiresAtMs: Date.now() + 86_400_000 }));
    await assertFails(getDoc(doc(ana, 'waLinks/abc')));
    await assertFails(deleteDoc(doc(ana, 'linkCodes/123456')));
  });
});
