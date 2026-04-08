interface ExperimentalHubPageProps {
  onOpenExperiment: (experimentId: string) => void;
}

export function ExperimentalHubPage({ onOpenExperiment }: ExperimentalHubPageProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Experimental Lab</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sandbox riservata ai superadmin Tecma. Seleziona un esperimento per aprirlo direttamente nella shell Followup.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpenExperiment("pascal-editor")}
          className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Esperimento 01</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">Pascal 3D Editor</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Prototipo di editor architetturale 3D embeddato nella shell Followup.
          </p>
          <span className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
            Apri esperimento
          </span>
        </button>

        <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-left shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Prossimamente</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">Nuovi esperimenti</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Questa area e pronta per ospitare altri prototipi senza impattare il core CRM.
          </p>
        </div>
      </div>
    </div>
  );
}
