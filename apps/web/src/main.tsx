import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BRAND, type AccentName } from '@fina/core';
import './index.css';
import { App } from './App';
import { registerServiceWorker } from './lib/pwa';
import { applyAccent } from './lib/theme';

// Aplica el acento guardado antes del primer render (sin parpadeo).
try {
  const boot = JSON.parse(localStorage.getItem('fina:boot') ?? '{}') as { accent?: AccentName };
  applyAccent(boot.accent ?? BRAND.defaultAccent);
} catch {
  applyAccent(BRAND.defaultAccent);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
