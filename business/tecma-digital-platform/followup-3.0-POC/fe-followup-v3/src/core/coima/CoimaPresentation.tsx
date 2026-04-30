import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers, LayoutGrid, Maximize2, Minimize2, Search, Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import {
  COIMA_EXTRAS_TECMA,
  COIMA_PHASES,
  COIMA_PROJECT_CONTEXT,
  COIMA_RISKS,
  type CoimaPhase,
  type CoimaRow,
  type CoimaStatus,
  globalTotals,
  rowCounts,
  statusLabel,
} from "./coimaData";

const CoimaVisualTabLazy = lazy(() =>
  import("./CoimaVisualTab").then((module) => ({ default: module.CoimaVisualTab }))
);

const COL = { si: "#22c55e", parziale: "#f59e0b", no: "#ef4444" } as const;
type StatusFilter = "all" | CoimaStatus;

function matchesStatusFilter(row: CoimaRow, f: StatusFilter): boolean {
  if (f === "all") return true;
  if (f === "parziale") return row.status === "parziale" || row.status === "misto";
  return row.status === f;
}

function StatusBadge({ status }: { status: CoimaStatus }) {
  if (status === "si") return <Badge variant="success">Sì</Badge>;
  if (status === "no") return <Badge variant="destructive">No</Badge>;
  return <Badge variant="warning">{status === "misto" ? "Sì / Parziale" : "Parziale"}</Badge>;
}

function coverageTerms(status: CoimaStatus): string {
  if (status === "si") return "Capability nativa disponibile in Followup 3.0 (con eventuale configurazione progetto/workflow).";
  if (status === "no") return "Fuori dal perimetro nativo del prodotto: richiede processo esterno o integrazione specialistica.";
  if (status === "misto") return "Copertura presente ma non end-to-end: parte disponibile oggi, parte in evoluzione/roadmap.";
  return "Copertura parziale: gestibile con strumenti generici (workflow, note, allegati, configurazione), ma senza modulo dedicato completo.";
}

function StrongMarkdownLike({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((chunk, i) =>
        i % 2 === 1 ? (
          <strong key={i}>{chunk}</strong>
        ) : (
          <span key={i}>{chunk}</span>
        )
      )}
    </>
  );
}

function MatrixRequirementCard({ phase, row }: { phase: CoimaPhase; row: CoimaRow }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {phase.shortLabel} · #{row.n}
          </Badge>
          <StatusBadge status={row.status} />
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requisito COIMA (testo ricevuto)</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">"{row.title}"</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lettura Tecma / copertura reale</p>
          <p className="mt-1 text-sm text-muted-foreground">{row.note}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Termini:</strong> {coverageTerms(row.status)}
          </p>
        </div>
        {row.extra ? (
          <p className="flex items-start gap-2 text-sm text-primary">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Extra Tecma:</strong> {row.extra}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CoimaPresentation() {
  const presentationRef = useRef<HTMLDivElement>(null);
  const [presentationFs, setPresentationFs] = useState(false);

  const [tab, setTab] = useState("overview");
  const [phaseId, setPhaseId] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const totals = useMemo(() => globalTotals(), []);

  useEffect(() => {
    const sync = () => setPresentationFs(document.fullscreenElement === presentationRef.current);
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      const el = presentationRef.current;
      if (el && document.fullscreenElement === el) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const togglePresentationFullscreen = useCallback(() => {
    const el = presentationRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const barData = useMemo(
    () => COIMA_PHASES.map((p) => ({ name: p.shortLabel, ...rowCounts(p) })),
    []
  );
  const pieData = useMemo(
    () => [
      { name: "Sì", value: totals.si, fill: COL.si },
      { name: "Parziale", value: totals.parziale, fill: COL.parziale },
      { name: "No", value: totals.no, fill: COL.no },
    ],
    [totals]
  );

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const phases: CoimaPhase[] = phaseId === "all" ? COIMA_PHASES : COIMA_PHASES.filter((p) => p.id === phaseId);
    const out: { phase: CoimaPhase; row: CoimaRow }[] = [];
    for (const p of phases) {
      for (const row of p.rows) {
        if (!matchesStatusFilter(row, statusFilter)) continue;
        if (needle) {
          const blob = `${row.title} ${row.note} ${row.extra ?? ""}`.toLowerCase();
          if (!blob.includes(needle)) continue;
        }
        out.push({ phase: p, row });
      }
    }
    return out;
  }, [phaseId, q, statusFilter]);

  const sortedFilteredRows = useMemo(() => {
    const order = COIMA_PHASES.map((p) => p.id);
    return [...filteredRows].sort((a, b) => {
      const ia = order.indexOf(a.phase.id);
      const ib = order.indexOf(b.phase.id);
      if (ia !== ib) return ia - ib;
      return a.row.n - b.row.n;
    });
  }, [filteredRows]);

  const matrixGroups = useMemo(() => {
    const m = new Map<string, { phase: CoimaPhase; row: CoimaRow }[]>();
    for (const item of sortedFilteredRows) {
      const list = m.get(item.phase.id) ?? [];
      list.push(item);
      m.set(item.phase.id, list);
    }
    return COIMA_PHASES.map((p) => ({ phase: p, rows: m.get(p.id) ?? [] })).filter((g) => g.rows.length > 0);
  }, [sortedFilteredRows]);

  return (
    <div
      ref={presentationRef}
      className={cn(
        "space-y-6",
        presentationFs && "min-h-screen overflow-y-auto bg-background p-4 sm:p-6 lg:p-8"
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={togglePresentationFullscreen}
          aria-pressed={presentationFs}
          title={presentationFs ? "Esci da schermo intero (Esc)" : "Apri presentazione a schermo intero"}
        >
          {presentationFs ? (
            <>
              <Minimize2 className="h-4 w-4" />
              Esci da presentazione
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              Presentazione (schermo intero)
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Assessment COIMA / BTS vs Tecma</CardTitle>
            <Badge variant="outline">Documento operativo</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Analisi del perimetro build-to-sell su Followup 3.0: copertura nativa, copertura parziale e fuori perimetro.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            <p className="font-medium">{COIMA_PROJECT_CONTEXT.title}</p>
            <p className="mt-1 text-muted-foreground">
              <StrongMarkdownLike text={COIMA_PROJECT_CONTEXT.summary} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <StrongMarkdownLike text={COIMA_PROJECT_CONTEXT.scopeNote} />
            </p>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex min-h-0 flex-wrap gap-0 border-b border-border bg-transparent p-0">
            <TabsTrigger value="overview" className="shrink-0 px-3 py-2 text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="visual" className="shrink-0 px-3 py-2 text-xs sm:text-sm">Grafici & Gantt</TabsTrigger>
            <TabsTrigger value="matrix" className="shrink-0 px-3 py-2 text-xs sm:text-sm">Matrice requisiti</TabsTrigger>
            <TabsTrigger value="actions" className="shrink-0 px-3 py-2 text-xs sm:text-sm">Azioni & rischi</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Requisiti mappati", value: String(totals.total), sub: "voci assessment" },
              { label: "Sì", value: `${totals.pctSi}%`, sub: `${totals.si} voci` },
              { label: "Parziale", value: `${totals.pctParziale}%`, sub: `${totals.parziale} voci` },
              { label: "No", value: `${totals.pctNo}%`, sub: `${totals.no} voci` },
            ].map((k) => (
              <Card key={k.label}>
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase text-muted-foreground">{k.label}</p>
                  <p className="text-3xl font-semibold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.sub}</p>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Percorso COIMA</CardTitle>
              <p className="text-sm text-muted-foreground">
                Seleziona una fase per pre-filtrare la matrice requisiti.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COIMA_PHASES.map((p) => {
                const c = rowCounts(p);
                const active = phaseId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhaseId(active ? "all" : p.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{p.shortLabel}</p>
                    <p className="mt-1 text-sm font-semibold">{p.title}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {c.si} sì · {c.parziale} parziale · {c.no} no
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visual" className="mt-4">
          <Suspense fallback={<div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Caricamento grafici e Gantt…</div>}>
            <CoimaVisualTabLazy barData={barData} pieData={pieData} total={totals.total} />
          </Suspense>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Matrice requisiti — filtri</CardTitle>
              <p className="text-sm text-muted-foreground">
                Percorso COIMA: <strong className="text-foreground">Prospect</strong> → <strong className="text-foreground">Preliminare</strong> →{" "}
                <strong className="text-foreground">Vita fino a consegna</strong> → <strong className="text-foreground">Post consegna</strong>. Scegli la fase e
                l&apos;esito in Tecma; la lista sotto si aggiorna e resta raggruppata per fase.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm font-medium text-foreground">1. Fase del percorso</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Clicca una card per vedere solo quella fase; clic di nuovo per tornare a tutte le fasi.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setPhaseId("all")}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      phaseId === "all"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-muted/40"
                    )}
                  >
                    <p className="text-sm font-semibold">Tutte le fasi</p>
                    <p className="mt-1 text-xs text-muted-foreground">Vista completa del percorso cliente</p>
                  </button>
                  {COIMA_PHASES.map((p) => {
                    const c = rowCounts(p);
                    const active = phaseId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPhaseId(active ? "all" : p.id)}
                        title={p.title}
                        className={cn(
                          "rounded-lg border p-3 text-left transition",
                          active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <p className="text-sm font-semibold leading-snug">{p.shortLabel}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.subtitle}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800 dark:bg-green-950/50 dark:text-green-300">
                            {c.si} sì
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                            {c.parziale} parz.
                          </span>
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
                            {c.no} no
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-foreground">2. Esito in Tecma (colonna «In Tecma»)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["all", "si", "parziale", "no"] as const).map((id) => (
                    <Button
                      key={id}
                      variant={statusFilter === id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(id)}
                    >
                      {id === "all" ? "Tutti gli esiti" : statusLabel(id as CoimaStatus)}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Legenda: <Badge variant="success" className="align-middle">Sì</Badge> nativo ·{" "}
                  <Badge variant="warning" className="align-middle">
                    Parziale
                  </Badge>{" "}
                  con strumenti generici · <Badge variant="destructive" className="align-middle">No</Badge> fuori prodotto.
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-foreground">3. Ricerca testuale</p>
                <div className="relative mt-2 max-w-lg">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cerca nel requisito COIMA o nella lettura Tecma"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{filteredRows.length}</strong> requisit{filteredRows.length === 1 ? "o" : "i"} in elenco
                  {phaseId !== "all" ? (
                    <>
                      {" "}
                      · fase: <strong className="text-foreground">{COIMA_PHASES.find((p) => p.id === phaseId)?.shortLabel}</strong>
                    </>
                  ) : null}
                  {statusFilter !== "all" ? (
                    <>
                      {" "}
                      · esito: <strong className="text-foreground">{statusLabel(statusFilter as CoimaStatus)}</strong>
                    </>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPhaseId("all");
                    setStatusFilter("all");
                    setQ("");
                  }}
                >
                  Azzera filtri
                </Button>
              </div>
            </CardContent>
          </Card>

          {matrixGroups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nessun requisito corrisponde ai filtri. Prova ad allargare l&apos;esito, a selezionare «Tutte le fasi» o a ridurre la ricerca.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {matrixGroups.map(({ phase, rows }) => (
                <section key={phase.id} className="space-y-3">
                  <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-foreground">{phase.title}</h3>
                        <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                      </div>
                      <Badge variant="secondary">
                        {rows.length} di {rowCounts(phase).total} in questa fase
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {rows.map(({ row }) => (
                      <MatrixRequirementCard key={`${phase.id}-${row.n}`} phase={phase} row={row} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />
                Extra Tecma
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {COIMA_EXTRAS_TECMA.map((line) => (
                <div key={line} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  {line}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="h-4 w-4" />
                Rischi e decisioni
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {COIMA_RISKS.map((r) => (
                <div key={r.title} className="rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Documento guida: <code className="rounded bg-muted px-1">docs/deliverables/COIMA_TECMA_ALLINEAMENTO_E_PIANO.md</code>
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
