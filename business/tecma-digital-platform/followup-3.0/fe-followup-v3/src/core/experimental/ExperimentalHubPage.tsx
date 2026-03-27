interface ExperimentalHubPageProps {
  editorUrl: string;
}

export function ExperimentalHubPage({ editorUrl }: ExperimentalHubPageProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Pascal 3D Editor (sperimentale)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sandbox riservata ai superadmin Tecma. Questa sezione ospita prototipi non ancora consolidati nel core CRM.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={editorUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Apri editor in nuova scheda
          </a>
          <span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">
            URL: {editorUrl}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <iframe
          title="Pascal 3D Editor experimental"
          src={editorUrl}
          className="h-[78vh] w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
