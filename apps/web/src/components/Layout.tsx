import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { BookOpen, Home, LayoutGrid, ListOrdered, PiggyBank, Plus, RefreshCw } from 'lucide-react';
import { isFeatureVisible } from '@fina/core';
import { useData } from '@/stores/data';
import { useUI } from '@/stores/ui';
import { cx } from './ui';
import { Logo } from './Logo';
import { QuickCaptureBar } from '@/features/capture/QuickCaptureBar';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

function useNavItems(): NavItem[] {
  const level = useData((s) => s.profile?.level ?? 'basic');
  const third: NavItem = isFeatureVisible(level, 'budgets') ? { to: '/presupuesto', label: 'Presupuesto', icon: PiggyBank } : { to: '/aprende', label: 'Aprende', icon: BookOpen };
  return [
    { to: '/', label: 'Inicio', icon: Home },
    { to: '/movimientos', label: 'Movimientos', icon: ListOrdered },
    third,
    { to: '/mas', label: 'Más', icon: LayoutGrid },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  const items = useNavItems();
  const openCapture = useUI((s) => s.openCapture);
  const swUpdate = useUI((s) => s.swUpdate);
  const loc = useLocation();
  const showDesktopCapture = loc.pathname !== '/';

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="mb-6 px-2">
          <Logo />
        </div>
        <button
          type="button"
          onClick={() => openCapture()}
          className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-3 font-semibold text-white shadow-sm shadow-accent-600/30 transition hover:bg-accent-700"
        >
          <Plus className="h-5 w-5" /> Anotar
        </button>
        <nav aria-label="Principal" className="space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition', isActive ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-200' : 'text-muted hover:bg-surface-2 hover:text-ink')
              }
            >
              <it.icon className="h-5 w-5" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-muted">Hecho en México 🇲🇽 · Tus datos son tuyos</div>
      </aside>

      <div className="min-w-0 flex-1">
        {swUpdate && (
          <div className="flex items-center justify-center gap-3 bg-accent-600 px-4 py-2 text-sm text-white">
            Hay una versión nueva de la app.
            <button type="button" onClick={swUpdate} className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 font-semibold">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-3xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:max-w-5xl lg:px-8 lg:pt-6 lg:pb-10">
          {showDesktopCapture && (
            <div className="mb-4 hidden lg:block">
              <QuickCaptureBar />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
          {items.slice(0, 2).map((it) => (
            <TabLink key={it.to} item={it} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Anotar un gasto o ingreso"
              onClick={() => openCapture()}
              className="-mt-6 flex h-15 w-15 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg shadow-accent-600/40 ring-4 ring-bg transition active:scale-95"
              style={{ height: '3.75rem', width: '3.75rem' }}
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </button>
          </div>
          {items.slice(2).map((it) => (
            <TabLink key={it.to} item={it} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-medium transition', isActive ? 'text-accent-600 dark:text-accent-300' : 'text-muted')}
    >
      <item.icon className="h-6 w-6" />
      {item.label}
    </NavLink>
  );
}
