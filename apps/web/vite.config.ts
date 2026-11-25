import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const BRAND = { name: 'Fina', themeColor: '#4f46e5', background: '#f7f7f9' };

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (single) {
    // Demo de un solo archivo: el script de arranque va en línea.
    plugins.push({
      name: 'inline-boot',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace('<script src="boot.js"></script>', `<script>${readFileSync(fileURLToPath(new URL('./public/boot.js', import.meta.url)), 'utf8')}</script>`),
      },
      // Sin service worker en el demo.
      resolveId: (id) => (id === 'virtual:pwa-register' ? '\0pwa-stub' : null),
      load: (id) => (id === '\0pwa-stub' ? 'export function registerSW() { return () => {}; }' : null),
    });
    plugins.push(viteSingleFile());
  } else {
    plugins.push(
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
        injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
        manifest: {
          id: './',
          name: `${BRAND.name} · Finanzas personales`,
          short_name: BRAND.name,
          description: 'Anota tus gastos en 3 segundos y entiende tu dinero. Hecha para México.',
          lang: 'es-MX',
          dir: 'ltr',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: BRAND.background,
          theme_color: BRAND.themeColor,
          categories: ['finance', 'productivity'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Anotar gasto', short_name: 'Anotar', url: './#/?capture=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Movimientos', url: './#/movimientos', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
          share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        },
        devOptions: { enabled: false },
      }),
    );
  }
  return {
    base: process.env.BASE_PATH ?? './',
    plugins,
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'), __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
    build: {
      target: 'es2022',
      outDir: single ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 1500,
      rollupOptions: single
        ? undefined
        : {
            output: {
              manualChunks: {
                firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                charts: ['recharts'],
              },
            },
          },
    },
    test: { environment: 'jsdom', globals: false },
  };
});
