/**
 * ErrorBoundary — cattura errori di rendering e mostra un messaggio invece della pagina bianca.
 * Utile per diagnosticare crash dopo login o in qualsiasi route.
 */
import * as React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Stack dei componenti al momento dell’errore (per diagnosticare “more hooks” ecc.) */
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground font-body">
          <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-destructive mb-2">Si è verificato un errore</h1>
            <p className="text-sm text-muted-foreground mb-3">
              L’applicazione ha riscontrato un problema. Puoi ricaricare la pagina o tornare al login.
            </p>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40 mb-4" role="alert">
              {this.state.error.message}
            </pre>
            {this.state.componentStack ? (
              <details className="w-full mb-4" open>
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer">Dettaglio componente (copia per debug)</summary>
                <pre className="text-[10px] bg-muted/80 p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                  {this.state.componentStack}
                </pre>
              </details>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">Caricamento stack… (ricarica se serve)</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Ricarica pagina
              </button>
              <button
                type="button"
                onClick={() => {
                  window.sessionStorage.removeItem("followup3.accessToken");
                  window.sessionStorage.removeItem("followup3.lastEmail");
                  window.location.replace("/login");
                }}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
              >
                Torna al login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
