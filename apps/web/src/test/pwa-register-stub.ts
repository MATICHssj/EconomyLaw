// En las pruebas no hay service worker.
export function registerSW() {
  return () => Promise.resolve();
}
