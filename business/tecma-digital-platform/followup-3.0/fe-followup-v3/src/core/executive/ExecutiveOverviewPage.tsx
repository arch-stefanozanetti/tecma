import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ExecutiveMarkdown } from "./ExecutiveMarkdown";
import { EXECUTIVE_DOC_TABS } from "./executiveDocs";
import { EXECUTIVE_DIAGRAMS } from "./executiveDiagrams";
import { MermaidBlock } from "./MermaidBlock";

const MAPS_TAB_ID = "maps";

/**
 * Panoramica strategica per CTO/CEO: contenuto da docs/executive nel monorepo.
 * Accesso: solo admin workspace (guard in App.tsx).
 * Solo il tab attivo monta il contenuto (markdown / diagrammi) per Mermaid stabile.
 */
export function ExecutiveOverviewPage() {
  const [tab, setTab] = useState(MAPS_TAB_ID);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        In evidenza: mappe di dominio. I tab testuali restano la fonte dettagliata; i link ai file .md si aprono su Git se è
        configurato <code className="rounded bg-muted px-1 text-xs">VITE_FOLLOWUP_DOCS_BASE_URL</code>.
      </p>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex min-h-0 flex-wrap gap-0 border-b border-border bg-transparent p-0">
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

        <TabsContent value={MAPS_TAB_ID} className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
          {tab === MAPS_TAB_ID ? (
            <div className="space-y-10">
              {EXECUTIVE_DIAGRAMS.map((d) => (
                <section key={d.id} className="scroll-mt-4">
                  <h2 className="mb-1 text-lg font-semibold tracking-tight text-foreground">{d.title}</h2>
                  {d.description ? <p className="mb-3 text-sm text-muted-foreground">{d.description}</p> : null}
                  <MermaidBlock key={`${MAPS_TAB_ID}-${d.id}`} chart={d.chart} />
                </section>
              ))}
            </div>
          ) : null}
        </TabsContent>

        {EXECUTIVE_DOC_TABS.map((doc) => (
          <TabsContent key={doc.id} value={doc.id} className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            {tab === doc.id ? <ExecutiveMarkdown source={doc.markdown} /> : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
