import { useEffect } from 'react';
import { ACCENT_PALETTES, type AccentName } from '@fina/core';
import { useData } from '@/stores/data';

export function applyAccent(name: AccentName) {
  const palette = ACCENT_PALETTES[name] ?? ACCENT_PALETTES.indigo;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(palette.shades)) root.style.setProperty(`--a-${k}`, v);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', palette.shades['600']);
}

/** Aplica tema (claro/oscuro/sistema), color de acento y tamaño de letra. */
export function useThemeEffect() {
  const theme = useData((s) => s.settings.theme);
  const accent = useData((s) => s.settings.accent);
  const fontScale = useData((s) => s.settings.fontScale);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  useEffect(() => {
    document.documentElement.dataset.font = fontScale;
  }, [fontScale]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' || (theme === 'system' && mq.matches),
      );
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
