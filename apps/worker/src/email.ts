import PostalMime from 'postal-mime';
import { addDays, findManualDuplicate, formatMoney, todayISO, tripForNewExpense, type Account, type Category, type Transaction, type Trip } from '@fina/core';
import { htmlToText, parseBankNotice } from '@fina/bank-profiles';
import { fromHex } from './lib/crypto';
import type { Pusher } from './lib/fcm';
import type { Store } from './lib/store';
import { noticeToTx } from './entries';

/**
 * Correos reenviados por el usuario a u<uid-en-hex>@dominio (Cloudflare Email
 * Routing → este Worker). Se convierten en movimientos "por revisar" y se avisa por push.
 */
export function uidFromAddress(to: string): string | null {
  const local = to.split('@')[0]?.toLowerCase() ?? '';
  const m = local.match(/^u([0-9a-f]{8,128})$/);
  if (!m || m[1]!.length % 2) return null;
  try {
    return new TextDecoder().decode(fromHex(m[1]!));
  } catch {
    return null;
  }
}

export function addressForUid(uid: string, domain: string): string {
  return `u${Array.from(new TextEncoder().encode(uid), (b) => b.toString(16).padStart(2, '0')).join('')}@${domain}`;
}

export async function handleBankEmail(deps: { store: Store; push: Pusher }, input: { to: string; from: string; raw: ArrayBuffer | ReadableStream | string }): Promise<'ok' | 'unknown-user' | 'not-a-purchase'> {
  const uid = uidFromAddress(input.to);
  if (!uid || !/^[A-Za-z0-9]{10,128}$/.test(uid)) return 'unknown-user';
  const meta = await deps.store.get(`users/${uid}`);
  if (!meta) return 'unknown-user';
  const email = await PostalMime.parse(input.raw as ArrayBuffer);
  const text = email.text ?? htmlToText(email.html ?? '');
  // Gmail reenvía con "De: banco@…" en el cuerpo: buscamos el remitente original.
  const origFrom = text.match(/(?:From|De):\s*.*?<?([\w.+-]+@[\w.-]+)>?/i)?.[1] ?? email.from?.address ?? input.from;
  const notice = parseBankNotice({ from: origFrom, subject: email.subject ?? '', text });
  if (!notice) return 'not-a-purchase';
  const accounts = await deps.store.list<Account>(`users/${uid}/accounts`);
  const byBank = accounts.filter((a) => !a.archived && a.institution === notice.bankId);
  const byLast4 = notice.last4 ? accounts.find((a) => !a.archived && (a.card?.last4 === notice.last4 || a.aliases.includes(notice.last4!))) : undefined;
  const account = byLast4 ?? byBank.find((a) => a.type === 'credit') ?? byBank[0] ?? null;
  const tx = noticeToTx({
    uid,
    amountCents: notice.amountCents,
    currency: notice.currency,
    kind: notice.kind === 'income' || notice.kind === 'transfer_in' ? 'income' : 'expense',
    description: notice.description,
    merchant: notice.merchant,
    categoryId: notice.categoryId ?? null,
    date: notice.date ?? todayISO(new Date(), 'America/Mexico_City'),
    accountId: account?.id ?? null,
    source: 'email',
    rawText: `${email.subject ?? ''}\n${text}`.slice(0, 500),
  });
  // ¿Ya lo había anotado a mano? Se guarda marcado para que confirme "¿es el mismo?".
  const recent = await deps.store
    .query<Transaction>(`users/${uid}/transactions`, [['date', '>=', addDays(tx.date, -1)]], 300)
    .catch(() => [] as Transaction[]);
  const dup = findManualDuplicate(tx, recent.filter((t) => t.date <= addDays(tx.date, 1)));
  if (dup) {
    tx.duplicateOf = dup.id;
    tx.status = 'review';
  }
  if (tx.kind === 'expense') {
    const trips = await deps.store.list<Trip>(`users/${uid}/trips`).catch(() => [] as Trip[]);
    const trip = tripForNewExpense(trips, tx);
    if (trip) tx.tripId = trip.id;
  }
  await deps.store.set(`users/${uid}/transactions/${tx.id}`, tx);
  const cats = await deps.store.list<Category>(`users/${uid}/categories`);
  const cat = cats.find((c) => c.id === tx.categoryId);
  await deps.push.send(uid, {
    title: `💳 Nueva ${tx.kind === 'income' ? 'entrada' : 'compra'} ${account?.name ?? notice.bankId.toUpperCase()} ${formatMoney(tx.amountCents)}`,
    body: `${notice.merchant}${cat && cat.id !== 'review' ? ` — ¿categoría ${cat.name}?` : ' — toca para elegir categoría'}`,
    url: '/#/movimientos',
    tag: `email:${tx.id}`,
  });
  return 'ok';
}
