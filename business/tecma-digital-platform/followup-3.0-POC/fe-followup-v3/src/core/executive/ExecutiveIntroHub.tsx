import {
  ArrowRight,
  BookMarked,
  Building2,
  ClipboardCheck,
  ExternalLink,
  FileStack,
  Gauge,
  Layers,
  Route,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { EXECUTIVE_DOC_TABS } from "./executiveDocs";
import { buildGitDocUrl, getFollowupDocsBaseUrl } from "./executiveDocLinks";

export interface ExecutiveIntroHubProps {
  onOpenTab: (tabId: string) => void;
  mapsTabId: string;
}

const REPO_DOC_PATHS = [
  { path: "docs/PIANO_GLOBALE_FOLLOWUP_3.md", label: "Piano globale (backlog)" },
  { path: "docs/FOLLOWUP_3_MASTER.md", label: "Documento maestro (wave)" },
  { path: "docs/README.md", label: "Indice documentazione" },
  { path: "docs/RELEASE_READINESS_CHECKLIST.md", label: "Checklist go-live cliente" },
  { path: "docs/ACCEPTANCE_GATES.md", label: "Gate qualità CI" },
] as const;

/**
 * Landing ricca per /executive: contesto, pilastri, percorsi CEO/CTO, griglia documenti, link repo.
 */
export function ExecutiveIntroHub({ onOpenTab, mapsTabId }: ExecutiveIntroHubProps) {
  const docsBase = getFollowupDocsBaseUrl();

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/[0.08] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Allineamento leadership
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              FollowUp 3.0 — linea prodotto nuova, non clone del legacy
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Questa area raccoglie sintesi per <strong className="font-medium text-foreground">CTO e CEO</strong>: cosa stiamo
              dimostrando con lo stack moderno (React, REST, MongoDB <code className="rounded bg-muted px-1">tz_*</code>), dove
              siamo maturi e dove servono decisioni. Il dettaglio operativo resta nel piano globale e nei runbook collegati dal
              repository.
            </p>
          </div>
          <Button type="button" variant="secondary" className="shrink-0 gap-2 self-start" onClick={() => onOpenTab(mapsTabId)}>
            <Layers className="h-4 w-4" aria-hidden />
            Vai alle mappe visive
          </Button>
        </div>
      </div>

      {/* Pilastri */}
      <section aria-labelledby="executive-pillars-heading">
        <h3 id="executive-pillars-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gauge className="h-4 w-4 text-primary" aria-hidden />
          Cosa stiamo dimostrando
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/80 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building2 className="h-4 w-4 text-primary" aria-hidden />
                Dominio CRM
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Clienti, unità, richieste rent+sell, calendario, cockpit — costruiti sulla conoscenza operativa; il legacy resta
              riferimento funzionale, non vincolo uno-a-uno sul codice.
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Layers className="h-4 w-4 text-primary" aria-hidden />
                Piattaforma
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              API orientate a OpenAPI, workspace, RBAC, connettori (comunicazioni, marketing in evoluzione), direzione audit e
              osservabilità strutturata.
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Route className="h-4 w-4 text-primary" aria-hidden />
                Velocità controllata
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Greenfield <strong className="font-medium text-foreground">perimetrato</strong> per ridurre debito tecnico e
              accelerare security e integrazioni rispetto al patching continuo sullo stack storico.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Percorsi lettura */}
      <section aria-labelledby="executive-paths-heading">
        <h3 id="executive-paths-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookMarked className="h-4 w-4 text-primary" aria-hidden />
          Percorsi di lettura consigliati
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">~15 minuti — CEO / board</CardTitle>
              <p className="text-sm text-muted-foreground">
                Messaggio chiaro su MVP, limiti e rischi. Ideale prima di un pitch o di una revisione commerciale.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onOpenTab("01")}>
                Executive summary
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenTab("06")}>
                Rischi e decisioni
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">~45–60 minuti — CTO / engineering lead</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quadro completo: perché greenfield, stadio operativo per area, architettura, privacy, rischi. Usa i tab numerati in
                sequenza o l’indice nel tab &quot;Indice&quot;.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => onOpenTab("readme")}>
                Indice documenti
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenTab("02")}>
                Perché greenfield
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenTab("04")}>
                Architettura
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Griglia tab documenti */}
      <section aria-labelledby="executive-docs-grid-heading">
        <h3 id="executive-docs-grid-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileStack className="h-4 w-4 text-primary" aria-hidden />
          Documenti executive (stesso testo del repo)
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Ogni scheda apre il tab con il markdown aggiornato da <code className="rounded bg-muted px-1 text-xs">docs/executive/</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXECUTIVE_DOC_TABS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => onOpenTab(doc.id)}
              className="flex rounded-lg border border-border bg-card p-4 text-left text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium text-foreground">{doc.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Go-live + repo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-500/25 bg-amber-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-500" aria-hidden />
              Prima del go-live verso cliente esterno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Incrociare i rischi qui sopra con la checklist formale nel repository: identity, tenant, pentest, DPA, backup,
              supporto. Il tab <strong className="text-foreground">Rischi e decisioni</strong> elenca le decisioni ancora aperte.
            </p>
            {docsBase ? (
              <a
                href={buildGitDocUrl(docsBase, "docs/RELEASE_READINESS_CHECKLIST.md")}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apri RELEASE_READINESS_CHECKLIST.md
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              </a>
            ) : (
              <p className="text-xs">
                Imposta <code className="rounded bg-muted px-1">VITE_FOLLOWUP_DOCS_BASE_URL</code> nel frontend per aprire i file
                .md su Git dal browser.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileStack className="h-4 w-4 text-primary" aria-hidden />
              Altri riferimenti nel monorepo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {REPO_DOC_PATHS.map(({ path, label }) => (
                <li key={path}>
                  {docsBase ? (
                    <a
                      href={buildGitDocUrl(docsBase, path)}
                      className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/90"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {label} <span className="font-mono text-xs text-foreground/70">({path})</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
