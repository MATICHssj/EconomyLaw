/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// App instalable y funcionando sin internet.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
registerRoute(({ url }) => url.hostname === 'open.er-api.com', new StaleWhileRevalidate({ cacheName: 'fx' }));
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'images', plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 })] }),
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/**
 * Notificaciones push (Firebase Cloud Messaging o Web Push estándar).
 * Formato FCM: { notification: { title, body }, data: { url } }
 */
self.addEventListener('push', (event) => {
  let payload: { notification?: { title?: string; body?: string; icon?: string }; data?: Record<string, string>; title?: string; body?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const n = payload.notification ?? {};
  const title = n.title ?? payload.title ?? payload.data?.title ?? 'Fina';
  const body = n.body ?? payload.body ?? payload.data?.body ?? '';
  const url = payload.data?.url ?? './';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-72.png',
      data: { url },
      tag: payload.data?.tag,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | undefined)?.url ?? './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clientsList) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await (c as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
