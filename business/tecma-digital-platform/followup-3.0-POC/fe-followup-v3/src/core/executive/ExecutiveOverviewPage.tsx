import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ExecutiveIntroHub } from "./ExecutiveIntroHub";
import { EXECUTIVE_DOC_TABS } from "./executiveDocs";
import { EXECUTIVE_DIAGRAMS } from "./executiveDiagrams";

const ExecutiveMarkdownLazy = lazy(() =>
  import("./ExecutiveMarkdown").then((module) => ({ default: module.ExecutiveMarkdown }))
);
const MermaidBlockLazy = lazy(() =>
  import("./MermaidBlock").then((module) => ({ default: module.MermaidBlock }))
);

const INTRO_TAB_ID = "intro";
const MAPS_TAB_ID = "maps";

/**
 * Panoramica strategica per CTO/CEO: hub introduttivo + mappe Mermaid + markdown da docs/executive.
 * Accesso: solo admin workspace (guard in App.tsx).
 * Solo il tab attivo monta il contenuto (markdown / diagrammi) per Mermaid stabile.
 */
export function ExecutiveOverviewPage() {
  const [tab, setTab] = useState(INTRO_TAB_ID);

  const scrollToDiagram = (id: string) => {
    document.getElementById(`executive-diag-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex min-h-0 flex-wrap gap-0 border-b border-border bg-transparent p-0">
            <TabsTrigger value={INTRO_TAB_ID} className="shrink-0 px-3 py-2 text-xs sm:text-sm">
              Intro e percorsi
            </TabsTrigger>
            <TabsTrigger value={MAPS_TAB_ID} className="shrink-0 px-3 py-2 text-xs sm:text-sm">
              Panoramica visiva
            </TabsTrigger>
            {EXECUTIVE_DOC_TABS.map((doc) => (
              <TabsTrigger key={doc.id} value={doc.id} className="shrink-0 px-3 py-2 text-xs sm:text-sm">
                {doc.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={INTRO_TAB_ID} className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
          {tab === INTRO_TAB_ID ? (
            <ExecutiveIntroHub onOpenTab={setTab} mapsTabId={MAPS_TAB_ID} />
          ) : null}
        </TabsContent>

        <TabsContent value={MAPS_TAB_ID} className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
          {tab === MAPS_TAB_ID ? (
            <div className="space-y-8">
              <div className="space-y-3 border-b border-border pb-6">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Mappe e diagrammi</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Vista sintetica di contesto prodotto, multi-tenant, RBAC, entitlement, entità CRM, privacy, maturità e pipeline
                  CI/CD. Usa i collegamenti per saltare al diagramma; ogni blocco è renderizzato con Mermaid.
                </p>
                <p className="text-xs text-muted-foreground">
                  I tab testuali riportano il markdown completo da{" "}
                  <code className="rounded bg-muted px-1">docs/executive/</code>. Per aprire i file su Git configurare{" "}
                  <code className="rounded bg-muted px-1">VITE_FOLLOWUP_DOCS_BASE_URL</code> (root del monorepo{" "}
                  <code className="rounded bg-muted px-1">followup-3.0</code> sul remoto).
                </p>
                <nav aria-label="Salta al diagramma" className="flex flex-wrap gap-2">
                  {EXECUTIVE_DIAGRAMS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => scrollToDiagram(d.id)}
                      className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {d.title}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="space-y-12">
                {EXECUTIVE_DIAGRAMS.map((d) => (
                  <section key={d.id} id={`executive-diag-${d.id}`} className="scroll-mt-24">
                    <h3 className="mb-1 text-base font-semibold tracking-tight text-foreground">{d.title}</h3>
                    {d.description ? <p className="mb-3 text-sm text-muted-foreground">{d.description}</p> : null}
                    <Suspense fallback={<div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">Caricamento diagramma…</div>}>
                      <MermaidBlockLazy key={`${MAPS_TAB_ID}-${d.id}`} chart={d.chart} />
                    </Suspense>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        {EXECUTIVE_DOC_TABS.map((doc) => (
          <TabsContent key={doc.id} value={doc.id} className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            {tab === doc.id ? (
              <Suspense fallback={<div className="text-sm text-muted-foreground">Caricamento contenuto…</div>}>
                <ExecutiveMarkdownLazy source={doc.markdown} />
              </Suspense>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
