import { inviteCode, newId, numericCode, type Household } from '@fina/core';
import { useData } from '@/stores/data';
import { useSession } from '@/stores/session';

/**
 * Modo pareja / familia (requiere cuenta en la nube). Cada quien conserva sus
 * cuentas personales privadas; lo compartido vive en households/{hid}.
 */
async function fs() {
  const m = await import('firebase/firestore');
  const { firebase } = await import('./firebase');
  return { ...m, db: firebase().db };
}

function me() {
  const u = useSession.getState().user;
  if (!u || useSession.getState().mode !== 'firebase')
    throw new Error('Necesitas iniciar sesión con tu cuenta para usar el modo pareja.');
  if (!u.emailVerified)
    throw new Error('Por seguridad, primero verifica tu correo (revisa tu bandeja de entrada).');
  const name = useData.getState().profile?.name || u.name || 'Yo';
  return { uid: u.uid, name };
}

export async function createHousehold(
  name: string,
  splitMode: Household['splitMode'],
  myIncomeCents?: number,
): Promise<string> {
  const { uid, name: myName } = me();
  const { doc, setDoc, db } = await fs();
  const hid = newId();
  const h: Omit<Household, 'id'> = {
    name,
    members: [uid],
    memberNames: { [uid]: myName },
    splitMode,
    weights: myIncomeCents ? { [uid]: myIncomeCents } : {},
    createdBy: uid,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'households', hid), h);
  await useData.getState().updateProfile({ householdId: hid });
  return hid;
}

/** Crea un código de invitación de 6 letras válido por 7 días. */
export async function createInvite(hid: string): Promise<string> {
  const { uid } = me();
  const { doc, setDoc, db } = await fs();
  const code = inviteCode(6);
  await setDoc(doc(db, 'householdInvites', code), {
    hid,
    createdBy: uid,
    expiresAtMs: Date.now() + 7 * 86_400_000,
  });
  return code;
}

export async function joinHousehold(rawCode: string, myIncomeCents?: number): Promise<void> {
  const { uid, name } = me();
  const code = rawCode.trim().toUpperCase();
  const { doc, getDoc, updateDoc, arrayUnion, db } = await fs();
  const inv = await getDoc(doc(db, 'householdInvites', code));
  if (!inv.exists()) throw new Error('Ese código no existe. Revísalo con tu pareja.');
  const { hid, expiresAtMs } = inv.data() as { hid: string; expiresAtMs: number };
  if (expiresAtMs < Date.now()) throw new Error('El código ya venció. Pide uno nuevo.');
  await updateDoc(doc(db, 'households', hid), {
    members: arrayUnion(uid),
    [`memberNames.${uid}`]: name,
    ...(myIncomeCents ? { [`weights.${uid}`]: myIncomeCents } : {}),
    joinCode: code,
  });
  await useData.getState().updateProfile({ householdId: hid });
}

export async function updateHousehold(
  hid: string,
  patch: Partial<Pick<Household, 'name' | 'splitMode' | 'weights' | 'memberNames'>>,
): Promise<void> {
  const { doc, updateDoc, db } = await fs();
  await updateDoc(doc(db, 'households', hid), patch);
}

export async function leaveHousehold(hid: string): Promise<void> {
  const { uid } = me();
  const { doc, updateDoc, arrayRemove, db } = await fs();
  await updateDoc(doc(db, 'households', hid), { members: arrayRemove(uid) });
  await useData.getState().updateProfile({ householdId: null });
}

// ——————————————————— WhatsApp ———————————————————

/** Código de 6 dígitos (10 min) que el usuario manda por WhatsApp: "vincular 123456". */
export async function createWhatsAppLinkCode(): Promise<string> {
  const { uid } = me();
  const { doc, setDoc, db } = await fs();
  for (let i = 0; i < 3; i++) {
    const code = numericCode(6);
    try {
      await setDoc(doc(db, 'linkCodes', code), { uid, expiresAtMs: Date.now() + 10 * 60_000 });
      return code;
    } catch {
      /* colisión: intenta otro */
    }
  }
  throw new Error('No se pudo crear el código. Intenta de nuevo.');
}
