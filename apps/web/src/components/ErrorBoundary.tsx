import { Component, type ReactNode } from 'react';
import { recordError } from '@/lib/errorLog';

/** Si una pantalla falla, en lugar de quedar en blanco se muestra esto y se registra el error. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    recordError(error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-xl font-bold text-ink">Algo salió mal</p>
        <p className="text-muted">
          Tus datos están a salvo. Ya guardamos el error para arreglarlo. Vuelve a abrir la app.
        </p>
        <button
          type="button"
          className="mt-2 h-11 rounded-xl bg-accent-600 px-5 font-semibold text-white"
          onClick={() => {
            location.hash = '#/';
            location.reload();
          }}
        >
          Volver a Inicio
        </button>
      </div>
    );
  }
}
