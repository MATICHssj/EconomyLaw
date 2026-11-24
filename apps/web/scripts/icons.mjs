// Genera los íconos PNG de la app a partir del SVG de la marca (usa Playwright/Chromium).
// Uso: node scripts/icons.mjs [colorHex]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync, mkdirSync } from 'node:fs';

const c1 = process.argv[2] ?? '#6366f1';
const c2 = process.argv[3] ?? '#4338ca';
const mark = (size, pad = 0, rounded = true) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="64" height="64" rx="${rounded ? 18 : 0}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(64 - 2 * pad) / 64})">
    <path d="M38.5 14c-6.6 0-10.5 3.9-10.5 10.4V28h-5v6h5v16h7V34h7v-6h-7v-3.2c0-2.6 1.3-4 3.8-4H43V14.3c-1.3-.2-2.8-.3-4.5-.3Z" fill="#fff"/>
    <circle cx="46" cy="44" r="5" fill="#fff" opacity=".9"/>
  </g>
</svg>`;
const badge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><path d="M38.5 14c-6.6 0-10.5 3.9-10.5 10.4V28h-5v6h5v16h7V34h7v-6h-7v-3.2c0-2.6 1.3-4 3.8-4H43V14.3c-1.3-.2-2.8-.3-4.5-.3Z" fill="#fff"/></svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', mark(64));
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
}
await render(mark(192), 192, 'public/icons/icon-192.png');
await render(mark(512), 512, 'public/icons/icon-512.png');
await render(mark(512, 10, false), 512, 'public/icons/maskable-512.png');
await render(mark(180, 0, false), 180, 'public/apple-touch-icon.png');
await render(badge(72), 72, 'public/icons/badge-72.png');
await render(mark(1024, 0, false), 1024, 'public/icons/icon-1024.png');
await browser.close();
console.log('Íconos generados');
