import { defineConfig, devices } from '@playwright/test';

/** Prueba de punta a punta: la app compilada en un celular simulado. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'off',
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
