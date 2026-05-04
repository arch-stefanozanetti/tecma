import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Evita schermata bianca se un componente lancia in render: mostra messaggio e pulsante ricarica.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Errore sconosciuto' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-6 py-10 text-slate-900"
          role="alert"
        >
          <h1 className="text-lg font-semibold">Si è verificato un errore nell&apos;interfaccia</h1>
          <p className="max-w-md text-center text-sm text-slate-700">{this.state.message}</p>
          <p className="max-w-md text-center text-xs text-slate-600">
            Apri la console del browser (F12) per i dettagli tecnici. Se hai appena aggiornato il codice,
            prova un ricarica forzata (Ctrl+Shift+R).
          </p>
          <button
            type="button"
            className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
            onClick={() => window.location.reload()}
          >
            Ricarica la pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
