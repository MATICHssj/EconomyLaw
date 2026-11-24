import { config } from '@/config';
import { useUI, type BeforeInstallPromptEvent } from '@/stores/ui';

/** Registra el service worker (offline + push) y escucha el aviso de instalación. */
export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useUI.getState().setInstallEvent(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => useUI.getState().setInstallEvent(null));
  if (config.isDemoBuild || !('serviceWorker' in navigator) || import.meta.env.DEV) return;
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const update = registerSW({
        onNeedRefresh() {
          useUI.getState().setSwUpdate(() => void update(true));
        },
      });
    })
    .catch(() => {
      /* sin SW */
    });
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isCapacitor(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}
