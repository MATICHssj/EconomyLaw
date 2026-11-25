import { addDays, formatMoney, todayISO } from '@fina/core';
import { config, hasCloud } from '@/config';
import { useSession } from '@/stores/session';
import { isCapacitor } from './pwa';
import type { useFinance } from './finance';

/**
 * Notificaciones:
 * - Web / iPhone / escritorio: push con Firebase Cloud Messaging; el Worker las
 *   envía con su cron aunque la app esté cerrada.
 * - Android (APK): además se programan notificaciones LOCALES en el teléfono,
 *   que funcionan sin internet ni servidor.
 */
export type PushResult = 'granted' | 'denied' | 'unsupported' | 'needs-setup' | 'error';

export async function enablePush(): Promise<PushResult> {
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const p = await LocalNotifications.requestPermissions();
    return p.display === 'granted' ? 'granted' : 'denied';
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  if (!hasCloud() || !config.vapidKey || useSession.getState().mode !== 'firebase')
    return 'needs-setup';
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return 'unsupported';
    const { firebase } = await import('./firebase');
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebase().app), {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: reg,
    });
    const { doc, setDoc } = await import('firebase/firestore');
    const uid = useSession.getState().user!.uid;
    await setDoc(doc(firebase().db, 'users', uid, 'devices', token), {
      platform: /iphone|ipad/i.test(navigator.userAgent)
        ? 'ios'
        : /android/i.test(navigator.userAgent)
          ? 'android'
          : 'web',
      createdAt: new Date().toISOString(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return 'granted';
  } catch (e) {
    console.error(e);
    return 'error';
  }
}

export function pushStatus(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

/** Android: programa avisos locales para pagos de tarjeta y recurrentes de los próximos 30 días. */
export async function scheduleLocalReminders(
  f: ReturnType<typeof useFinance>,
  daysBefore = 2,
): Promise<void> {
  if (!isCapacitor()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  const today = todayISO();
  const notifications = f.upcoming
    .filter((u) => u.direction === 'out' && u.amountCents > 0)
    .map((u, i) => {
      const when = addDays(u.date, -(u.type === 'card' ? daysBefore : 1));
      return { u, i, when: when < today ? today : when };
    })
    .filter(({ when }) => when >= today)
    .slice(0, 40)
    .map(({ u, i, when }) => ({
      id: 1000 + i,
      title: u.type === 'card' ? `💳 ${u.title}` : `🔔 ${u.title}`,
      body: `${u.daysUntil <= 1 ? 'Mañana' : `El ${Number(u.date.slice(8))}`}: ${formatMoney(u.amountCents)}. Toca para verlo.`,
      schedule: { at: new Date(`${when}T10:00:00`) },
      extra: { url: '#/calendario' },
    }));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
