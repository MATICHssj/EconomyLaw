import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parseBankNotice } from '@fina/bank-profiles';
import { convertToMxn, newId, todayISO, tripForNewExpense, type Transaction } from '@fina/core';
import { applyChanges, defaultAccountId } from './actions';
import { isCapacitor } from './pwa';
import { getDocs } from '@/stores/data';
import { toast } from '@/stores/ui';

interface CapturedNotification {
  id: string;
  package: string;
  title: string;
  text: string;
  postedAt: number;
}

interface BankNotificationsPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
  setAllowedApps(o: { packages: string[] }): Promise<void>;
  getAllowedApps(): Promise<{ packages: string[] }>;
  takePending(): Promise<{ items: CapturedNotification[] }>;
  addListener(
    event: 'bankNotification',
    cb: (n: CapturedNotification) => void,
  ): Promise<PluginListenerHandle>;
}

const Bank = registerPlugin<BankNotificationsPlugin>('BankNotifications');

/** Apps bancarias conocidas en México (paquete de Android → institución). */
export const BANK_APPS: Array<{ package: string; name: string; institution: string }> = [
  { package: 'com.bancomer.mbanking', name: 'BBVA México', institution: 'bbva' },
  { package: 'com.nu.production', name: 'Nu México', institution: 'nu' },
  { package: 'com.mercadopago.wallet', name: 'Mercado Pago', institution: 'mercadopago' },
  { package: 'mx.bancosantander.supermovil', name: 'Santander', institution: 'santander' },
  { package: 'com.banorte.movil', name: 'Banorte', institution: 'banorte' },
  { package: 'com.citibanamex.banamexmobile', name: 'Banamex', institution: 'banamex' },
  { package: 'mx.hsbc.hsbcmexico', name: 'HSBC México', institution: 'hsbc' },
  { package: 'com.scotiabank.mexico', name: 'Scotiabank', institution: 'scotiabank' },
  { package: 'mx.com.heybanco', name: 'Hey Banco', institution: 'hey' },
  { package: 'com.bancoazteca.bazdigitalmovil', name: 'Banco Azteca', institution: 'azteca' },
  { package: 'com.spinbyoxxo', name: 'Spin by OXXO', institution: 'spin' },
  { package: 'mx.klar.app', name: 'Klar', institution: 'klar' },
  { package: 'mx.stori.app', name: 'Stori', institution: 'stori' },
];

export const bankNotificationsAvailable = () =>
  isCapacitor() && /android/i.test(navigator.userAgent);

export const BankNotifications = Bank;

/** Convierte las notificaciones capturadas en movimientos "por revisar". */
export async function importPendingBankNotifications(): Promise<number> {
  if (!bankNotificationsAvailable()) return 0;
  const { items } = await Bank.takePending();
  return importItems(items);
}

async function importItems(items: CapturedNotification[]): Promise<number> {
  const accounts = getDocs('accounts');
  const stamp = new Date().toISOString();
  const changes = [];
  for (const it of items) {
    const app = BANK_APPS.find((b) => b.package === it.package);
    const notice = parseBankNotice({
      from: app?.institution ?? '',
      subject: it.title,
      text: it.text,
    });
    if (!notice || (notice.kind !== 'expense' && notice.kind !== 'income')) continue;
    const acc =
      (notice.last4
        ? accounts.find(
            (a) =>
              !a.archived &&
              (a.card?.last4 === notice.last4 || a.aliases.includes(notice.last4!)),
          )
        : undefined) ??
      accounts.find((a) => !a.archived && a.institution === (app?.institution ?? notice.bankId));
    const { amountMxnCents } = convertToMxn(notice.amountCents, notice.currency);
    const tx: Transaction = {
      id: newId(),
      kind: notice.kind,
      amountCents: notice.amountCents,
      currency: notice.currency,
      amountMxnCents,
      accountId: acc?.id ?? defaultAccountId(),
      toAccountId: null,
      categoryId: notice.categoryId ?? (notice.kind === 'income' ? 'other_income' : 'review'),
      tags: [],
      description: notice.description,
      merchant: notice.merchant,
      date: notice.date ?? todayISO(new Date(it.postedAt)),
      createdAt: stamp,
      updatedAt: stamp,
      source: 'notification',
      rawText: `${it.title} ${it.text}`.slice(0, 500),
      status: notice.categoryId ? 'cleared' : 'review',
      reconciled: false,
      attachments: [],
      dedupeHash: it.id,
    };
    const trip = notice.kind === 'expense' ? tripForNewExpense(getDocs('trips'), tx) : null;
    if (trip) tx.tripId = trip.id;
    if (getDocs('transactions').some((t) => t.dedupeHash === it.id)) continue;
    changes.push({
      space: 'personal' as const,
      col: 'transactions' as const,
      before: null,
      after: tx,
    });
  }
  if (changes.length) {
    await applyChanges(changes);
    toast(
      `${changes.length} ${changes.length === 1 ? 'movimiento' : 'movimientos'} del banco registrados`,
      'success',
    );
  }
  return changes.length;
}

/** Escucha en vivo mientras la app está abierta. */
export async function listenBankNotifications(): Promise<() => void> {
  if (!bankNotificationsAvailable()) return () => {};
  const h = await Bank.addListener('bankNotification', () => void importPendingBankNotifications());
  return () => void h.remove();
}
