// Aplica el tema guardado antes de pintar (evita el parpadeo blanco en modo oscuro).
try {
  var s = JSON.parse(localStorage.getItem('fina:boot') || '{}');
  var dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
  if (s.fontScale) document.documentElement.dataset.font = s.fontScale;
} catch (e) {}
