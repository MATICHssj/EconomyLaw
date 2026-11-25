// Genera los íconos de Android (normales, redondos y adaptativos) desde la marca.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const RES = 'android/app/src/main/res';
const glyph = '<path d="M38.5 14c-6.6 0-10.5 3.9-10.5 10.4V28h-5v6h5v16h7V34h7v-6h-7v-3.2c0-2.6 1.3-4 3.8-4H43V14.3c-1.3-.2-2.8-.3-4.5-.3Z" fill="#fff"/><circle cx="46" cy="44" r="5" fill="#fff" opacity=".9"/>';
const full = (s, round) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs>${round ? '<circle cx="32" cy="32" r="32" fill="url(#g)"/>' : '<rect width="64" height="64" rx="14" fill="url(#g)"/>'}<g transform="translate(6 6) scale(0.8125)">${glyph}</g></svg>`;
// Adaptativo: 108dp con zona segura de 66dp al centro → el glifo ocupa ~55 %.
const fg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 108 108"><g transform="translate(27 27) scale(0.84)">${glyph}</g></svg>`;
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
}
for (const [d, k] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${d}`;
  mkdirSync(dir, { recursive: true });
  await render(full(48 * k, false), 48 * k, `${dir}/ic_launcher.png`);
  await render(full(48 * k, true), 48 * k, `${dir}/ic_launcher_round.png`);
  await render(fg(108 * k), 108 * k, `${dir}/ic_launcher_foreground.png`);
}
writeFileSync(`${RES}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#4F46E5</color>\n</resources>\n');
await browser.close();
console.log('Íconos de Android listos');
