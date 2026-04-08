import type { ReactNode } from "react";

interface ExperimentalExperimentPageProps {
  experimentId?: string;
  editorUrl: string;
}

export function ExperimentalExperimentPage({ experimentId, editorUrl }: ExperimentalExperimentPageProps) {
  if (experimentId === "pascal-editor" || experimentId === "editor") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <iframe
          title="Pascal 3D Editor experimental embedded"
          src={editorUrl}
          className="h-[82vh] w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <PageShell
      title="Esperimento non disponibile"
      description="Questo esperimento non e disponibile o non e ancora stato pubblicato."
    >
      <p className="text-sm text-muted-foreground">
        Torna alla sezione Experimental per scegliere un altro prototipo.
      </p>
    </PageShell>
  );
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">{children}</div>
    </div>
  );
}
