import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pruebas de la app web (sin el plugin de PWA ni Tailwind).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register-stub.ts', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __APP_BUILD__: JSON.stringify(''),
    __BUILD_DATE__: JSON.stringify('2026-01-01'),
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
