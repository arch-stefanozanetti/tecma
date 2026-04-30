import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import { Accordion, AccordionItem } from "../../components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  followupApi,
  type JiraPrdFeatureCatalogEntry,
  type JiraPrdStatusRow,
} from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";

const AREA_ALL = "__all__";
const KIND_ALL = "__all__";
const EPIC_ALL = "__all__";
const WORK_ALL = "__all__";
/** Filtro Product Blueprint: voci con/senza riferimenti design */
const DESIGN_ALL = "__all__";
const DESIGN_WITH = "with";
const DESIGN_WITHOUT = "without";

/** Ordine visualizzazione Epic (E10 dopo E9, non dopo E1) */
const EPIC_ORDER = [
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E7",
  "E8",
  "E9",
  "E10",
  "E11",
  "E12",
  "E13",
  "E14",
] as const;

function epicSortIndex(epicId: string): number {
  const i = EPIC_ORDER.indexOf(epicId as (typeof EPIC_ORDER)[number]);
  return i === -1 ? 999 : i;
}

function workItemKindLabel(k: string): string {
  switch (k) {
    case "story":
      return "Story";
    case "spike":
      return "Spike";
    case "task":
      return "Task";
    case "technical":
      return "Technical";
    default:
      return k;
  }
}

function statusByIdTema(rows: JiraPrdStatusRow[]): Map<string, JiraPrdStatusRow> {
  return new Map(rows.map((r) => [r.idTema, r]));
}

function WorkItemKindBadge({ kind }: { kind: string }) {
  if (kind === "spike") {
    return (
      <Badge variant="outline" className="border-amber-600/40 text-amber-900 dark:text-amber-100">
        Spike
      </Badge>
    );
  }
  if (kind === "task") {
    return <Badge variant="secondary">Task</Badge>;
  }
  if (kind === "technical") {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        technical
      </Badge>
    );
  }
  return <Badge variant="default">Story</Badge>;
}

const DISCIPLINE_LABEL: Record<keyof JiraPrdFeatureCatalogEntry["disciplines"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  uxUi: "UX/UI",
  qa: "QA",
  test: "Test",
};

function CatalogEntryMetaStrip({ e }: { e: JiraPrdFeatureCatalogEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="font-mono">
        {e.epicId}
      </Badge>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <span className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-initial">
        <span className="line-clamp-2 text-foreground/90">{e.epicTitle}</span>
      </span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <WorkItemKindBadge kind={e.workItemKind} />
      {e.kind === "product" ? (
        <Badge variant="secondary">product</Badge>
      ) : (
        <Badge variant="outline">technical</Badge>
      )}
      {e.storyRef ? (
        <>
          <span aria-hidden>·</span>
          <span>
            Ref <span className="font-mono text-foreground">{e.storyRef}</span>
          </span>
        </>
      ) : null}
      {e.parentIdTema ? (
        <>
          <span aria-hidden>·</span>
          <span>
            Parent <span className="font-mono text-foreground">{e.parentIdTema}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function CatalogEntryPrdPanel({
  e,
  showHeading = true,
}: {
  e: JiraPrdFeatureCatalogEntry;
  /** Se false, non ripetere titolo (drawer singolo ha già il titolo in header) */
  showHeading?: boolean;
}) {
  const [prdOpen, setPrdOpen] = useState<string | null>("problem");
  const [prdRestOpen, setPrdRestOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState<string | null>("backend");

  const prdSections = useMemo(
    () =>
      [
        { id: "problem", title: "Problema / job", body: e.prd.problemJob },
        { id: "expected", title: "Comportamento atteso", body: e.prd.expectedBehavior },
        { id: "nongoals", title: "Non-goals", body: e.prd.nonGoals },
        { id: "data", title: "Dati (Mongo)", body: e.prd.dataMongo },
        { id: "perm", title: "Permessi / entitlement", body: e.prd.permissionsEntitlement },
        { id: "failure", title: "Failure modes", body: e.prd.failureModes },
        { id: "qa", title: "Prove QA / test", body: e.prd.qaProofs },
      ] as const,
    [e.prd]
  );

  const primaryPrdIds = useMemo(() => new Set(["problem", "expected", "nongoals"]), []);
  const primaryPrdSections = useMemo(
    () => prdSections.filter((s) => primaryPrdIds.has(s.id)),
    [prdSections, primaryPrdIds]
  );
  const restPrdSections = useMemo(
    () => prdSections.filter((s) => !primaryPrdIds.has(s.id)),
    [prdSections, primaryPrdIds]
  );
  const isTechnical = e.kind === "technical";

  const discKeys = Object.keys(e.disciplines) as Array<keyof typeof e.disciplines>;

  return (
    <article className="space-y-4 border-b pb-6 last:border-0">
      {showHeading ? (
        <h3 className="text-base font-semibold leading-snug text-foreground">
          {e.areaPrefix} {e.title}
        </h3>
      ) : null}

      <CatalogEntryMetaStrip e={e} />

      <p className="font-mono text-[11px] text-muted-foreground">{e.idTema}</p>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0">
          <TabsTrigger value="overview" className="px-4 py-2 text-xs sm:text-sm">
            Panoramica
          </TabsTrigger>
          <TabsTrigger value="disciplines" className="px-4 py-2 text-xs sm:text-sm">
            Discipline
          </TabsTrigger>
          <TabsTrigger value="prd" className="px-4 py-2 text-xs sm:text-sm">
            PRD completo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
            Per implementazione (file, route, collezioni, test) usa il tab{" "}
            <strong className="font-semibold">Discipline</strong> — evita di partire dal solo testo del PRD completo.
          </div>
          {e.kind === "technical" && e.parentIdTema ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Dettaglio <strong>tecnico</strong> sotto la capability{" "}
              <span className="font-mono font-semibold">{e.parentIdTema}</span> — usa il catalogo per aprire la voce
              product collegata se serve il contesto completo.
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sintesi</p>
            <p className="text-sm leading-relaxed text-foreground">{e.summary}</p>
          </div>
          {e.designRefs && e.designRefs.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Design / UX</p>
              <div className="flex flex-wrap gap-1.5">
                {e.designRefs.map((d) => (
                  <Badge key={d} variant="secondary" className="font-mono text-[11px] font-normal">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="disciplines" className="mt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Contenuti operativi per FE/BE/DB/UX/QA/Test — punto di partenza consigliato per dev e QA; espandi una sezione
            alla volta.
          </p>
          <Accordion>
            {discKeys.map((k) => (
              <AccordionItem
                key={k}
                title={DISCIPLINE_LABEL[k]}
                type="border"
                open={discOpen === k}
                onOpenChange={(open) => setDiscOpen(open ? k : null)}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{e.disciplines[k]}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="prd" className="mt-3">
          {isTechnical ? (
            <>
              <p className="mb-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Vista compatta per righe <strong>technical</strong>: in evidenza le prime tre sezioni (override); il
                resto è testo generato per export Jira e può sovrapporsi al tab Discipline.
              </p>
              <Accordion>
                {primaryPrdSections.map((s) => (
                  <AccordionItem
                    key={s.id}
                    title={s.title}
                    type="border"
                    open={prdOpen === s.id}
                    onOpenChange={(open) => setPrdOpen(open ? s.id : null)}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{s.body}</p>
                  </AccordionItem>
                ))}
              </Accordion>
              {restPrdSections.length > 0 ? (
                <Accordion className="mt-2">
                  <AccordionItem
                    title="Resto del PRD (testo lungo per Jira)"
                    type="border"
                    open={prdRestOpen}
                    onOpenChange={setPrdRestOpen}
                  >
                    <div className="space-y-4 border-t border-border pt-3">
                      {restPrdSections.map((s) => (
                        <div key={s.id}>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {s.title}
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Testo lungo per export Jira — sezioni collassabili; solo &quot;Problema / job&quot; aperto di default. Per
                dettaglio implementativo preferire il tab Discipline.
              </p>
              <Accordion>
                {prdSections.map((s) => (
                  <AccordionItem
                    key={s.id}
                    title={s.title}
                    type="border"
                    open={prdOpen === s.id}
                    onOpenChange={(open) => setPrdOpen(open ? s.id : null)}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{s.body}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("a, button, [role='checkbox'], label, input"));
}

export function ProductBlueprintPage() {
  const [catalog, setCatalog] = useState<JiraPrdFeatureCatalogEntry[]>([]);
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraBrowseBase, setJiraBrowseBase] = useState<string | null>(null);
  const [statusRows, setStatusRows] = useState<JiraPrdStatusRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterArea, setFilterArea] = useState<string>(AREA_ALL);
  const [filterKind, setFilterKind] = useState<string>(KIND_ALL);
  const [filterEpic, setFilterEpic] = useState<string>(EPIC_ALL);
  const [filterWork, setFilterWork] = useState<string>(WORK_ALL);
  const [filterDesign, setFilterDesign] = useState<string>(DESIGN_ALL);
  const [search, setSearch] = useState("");
  const [forceRepublish, setForceRepublish] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<JiraPrdFeatureCatalogEntry | null>(null);
  const [publishResult, setPublishResult] = useState<{
    created: Array<{ idTema: string; storyKey: string; subtaskKeys: string[] }>;
    skipped: Array<{ idTema: string; reason: string }>;
  } | null>(null);

  const openDetail = useCallback((entry: JiraPrdFeatureCatalogEntry) => {
    setDetailEntry(entry);
    setPreviewOpen(false);
  }, []);

  const closeDetail = useCallback(() => setDetailEntry(null), []);

  const openPreview = useCallback(() => {
    setDetailEntry(null);
    setPreviewOpen(true);
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setError("");
    try {
      const res = await followupApi.getJiraPrdCatalog();
      setCatalog(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caricamento catalogo fallito");
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError("");
    try {
      const res = await followupApi.getJiraPrdStatus();
      const d = res.data;
      setJiraConfigured(d.jiraConfigured);
      setJiraBrowseBase(d.jiraBrowseBase);
      setStatusRows(d.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sincronizzazione stato fallita");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const statusMap = useMemo(() => statusByIdTema(statusRows), [statusRows]);

  const areaOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) s.add(e.areaPrefix);
    return [...s].sort();
  }, [catalog]);

  const epicOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of catalog) s.add(e.epicId);
    return [...s].sort((a, b) => epicSortIndex(a) - epicSortIndex(b));
  }, [catalog]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((e) => {
      if (filterKind !== KIND_ALL && e.kind !== filterKind) return false;
      if (filterArea !== AREA_ALL && e.areaPrefix !== filterArea) return false;
      if (filterEpic !== EPIC_ALL && e.epicId !== filterEpic) return false;
      if (filterWork !== WORK_ALL && e.workItemKind !== filterWork) return false;
      if (filterDesign === DESIGN_WITH && (!e.designRefs || e.designRefs.length === 0)) return false;
      if (filterDesign === DESIGN_WITHOUT && e.designRefs && e.designRefs.length > 0) return false;
      if (!q) return true;
      const prdBlob = Object.values(e.prd).join(" ");
      const designBlob = (e.designRefs ?? []).join(" ");
      const blob = `${e.idTema} ${e.title} ${e.summary} ${prdBlob} ${e.parentIdTema ?? ""} ${e.epicId} ${e.epicTitle} ${e.storyRef ?? ""} ${designBlob}`.toLowerCase();
      return blob.includes(q);
    });
  }, [catalog, filterArea, filterEpic, filterKind, filterDesign, filterWork, search]);

  /** Prima per Epic (E1…E14), poi per capability radice */
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const ea = epicSortIndex(a.epicId);
      const eb = epicSortIndex(b.epicId);
      if (ea !== eb) return ea - eb;
      const ga = a.parentIdTema ?? a.idTema;
      const gb = b.parentIdTema ?? b.idTema;
      if (ga !== gb) return ga.localeCompare(gb);
      const da = a.parentIdTema ? 1 : 0;
      const db = b.parentIdTema ? 1 : 0;
      if (da !== db) return da - db;
      return a.idTema.localeCompare(b.idTema);
    });
  }, [filteredRows]);

  const toggleOne = (idTema: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idTema)) next.delete(idTema);
      else next.add(idTema);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(sortedRows.map((e) => e.idTema)));
  };

  const clearSelection = () => setSelected(new Set());

  const selectedEntries = useMemo(
    () => catalog.filter((e) => selected.has(e.idTema)),
    [catalog, selected]
  );

  const handlePublish = async () => {
    const idTemaList = [...selected];
    if (idTemaList.length === 0) {
      setError("Seleziona almeno una funzionalità.");
      return;
    }
    setPublishing(true);
    setError("");
    setPublishResult(null);
    try {
      const res = await followupApi.publishJiraPrd({ idTemaList, force: forceRepublish });
      setPublishResult(res.data);
      await loadStatus();
    } catch (e) {
      const msg =
        e instanceof HttpApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Pubblicazione fallita";
      setError(msg);
    } finally {
      setPublishing(false);
    }
  };

  const issueHref = (key: string) =>
    jiraBrowseBase ? `${jiraBrowseBase}/${encodeURIComponent(key)}` : `#`;

  return (
    <div className="flex flex-col gap-4">
      {!jiraConfigured && !loadingStatus && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Integrazione Jira non configurata sul backend (variabili <span className="font-mono text-xs">JIRA_*</span>). La
          pubblicazione restituirà errore finché non sono impostate su Render / env del servizio API.
        </p>
      )}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {publishResult ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">Esito pubblicazione</p>
          {publishResult.created.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              Create: {publishResult.created.map((c) => `${c.idTema} → ${c.storyKey}`).join("; ")}
            </p>
          ) : null}
          {publishResult.skipped.length > 0 ? (
            <p className="mt-1 text-muted-foreground">
              Saltate:{" "}
              {publishResult.skipped.map((s) => `${s.idTema} (${s.reason})`).join("; ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs text-muted-foreground">Area</label>
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger>
              <SelectValue placeholder="Tutte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AREA_ALL}>Tutte</SelectItem>
              {areaOptions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Cerca</label>
          <Input
            placeholder="idTema, titolo, descrizione, PRD…"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            checked={forceRepublish}
            onCheckedChange={(c) => setForceRepublish(c === true)}
            aria-label="Forza ripubblicazione"
          />
          <span className="text-sm text-muted-foreground">Forza (ricrea issue anche se già pubblicate)</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-muted-foreground">Tipo voce</label>
          <Select value={filterKind} onValueChange={setFilterKind}>
            <SelectTrigger>
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KIND_ALL}>Tutti</SelectItem>
              <SelectItem value="product">Capability (product)</SelectItem>
              <SelectItem value="technical">Dettaglio (technical)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[100px]">
          <label className="mb-1 block text-xs text-muted-foreground">Epic</label>
          <Select value={filterEpic} onValueChange={setFilterEpic}>
            <SelectTrigger>
              <SelectValue placeholder="Tutte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EPIC_ALL}>Tutte</SelectItem>
              {epicOptions.map((ep) => (
                <SelectItem key={ep} value={ep}>
                  {ep}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs text-muted-foreground">Backlog</label>
          <Select value={filterWork} onValueChange={setFilterWork}>
            <SelectTrigger>
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WORK_ALL}>Tutti</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="spike">Spike</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-muted-foreground">Design</label>
          <Select value={filterDesign} onValueChange={setFilterDesign}>
            <SelectTrigger>
              <SelectValue placeholder="Tutte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DESIGN_ALL}>Tutte</SelectItem>
              <SelectItem value={DESIGN_WITH}>Con designRefs</SelectItem>
              <SelectItem value={DESIGN_WITHOUT}>Senza designRefs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
          Seleziona filtrate ({sortedRows.length})
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
          Deseleziona
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openPreview}
          disabled={selectedEntries.length === 0}
        >
          Anteprima testi
        </Button>
        <Button type="button" size="sm" onClick={handlePublish} disabled={publishing || selected.size === 0}>
          {publishing ? "Pubblicazione…" : "Pubblica su Jira"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadStatus()}
          disabled={loadingStatus}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${loadingStatus ? "animate-spin" : ""}`} />
          Aggiorna stato da Jira
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Le righe sono raggruppate per <strong>Epic</strong> (E1–E14). In tabella compaiono titolo e descrizione sintetica;
        colonne Backlog e Ref indicano il tipo issue Jira suggerito e il riferimento blueprint. Per il PRD completo e le
        discipline usa l&apos;icona, il click sulla riga (tranne checkbox e link Jira), o &quot;Anteprima testi&quot; con
        selezione multipla. Il filtro <strong>Design</strong> limita alle voci con o senza{" "}
        <span className="font-mono text-xs">designRefs</span> (badge nel dettaglio Panoramica).
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Area</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Backlog</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>idTema</TableHead>
              <TableHead className="min-w-[min(380px,45vw)]">Funzionalità</TableHead>
              <TableHead>Story Jira</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingCatalog ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">
                  Caricamento catalogo…
                </TableCell>
              </TableRow>
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">
                  Nessuna riga corrisponde ai filtri.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row, rowIndex) => {
                const st = statusMap.get(row.idTema);
                const storyKey = st?.storyKey ?? null;
                const isChild = Boolean(row.parentIdTema);
                const prevEpic = rowIndex > 0 ? sortedRows[rowIndex - 1]?.epicId : null;
                const showEpicHeader = prevEpic !== row.epicId;
                return (
                  <Fragment key={row.idTema}>
                    {showEpicHeader ? (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={10} className="py-2.5 text-sm font-semibold">
                          <span className="font-mono text-primary">{row.epicId}</span>
                          <span className="text-muted-foreground"> — {row.epicTitle}</span>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow
                      className={`${isChild ? "bg-muted/20 " : ""}cursor-pointer hover:bg-muted/40`}
                      onClick={(ev) => {
                        if (isInteractiveTarget(ev.target)) return;
                        openDetail(row);
                      }}
                    >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.idTema)}
                        onCheckedChange={() => toggleOne(row.idTema)}
                        aria-label={`Seleziona ${row.idTema}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.areaPrefix}</TableCell>
                    <TableCell className="text-xs">
                      {row.kind === "product" ? (
                        <Badge variant="secondary">product</Badge>
                      ) : (
                        <Badge variant="outline">technical</Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <WorkItemKindBadge kind={row.workItemKind} />
                    </TableCell>
                    <TableCell className="max-w-[72px] truncate font-mono text-[10px] text-muted-foreground" title={row.storyRef ?? ""}>
                      {row.storyRef ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs" title={row.parentIdTema ?? ""}>
                      {row.parentIdTema ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs" title={row.idTema}>
                      {row.idTema}
                    </TableCell>
                    <TableCell className="max-w-[min(420px,50vw)] align-top">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 h-8 w-8 shrink-0"
                          aria-label={`Apri PRD e dettaglio per ${row.idTema}`}
                          title="Apri PRD completo"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openDetail(row);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <div className={`min-w-0 flex-1 ${isChild ? "border-l-2 border-muted-foreground/30 pl-3" : ""}`}>
                          <div className="line-clamp-2 font-medium leading-snug" title={row.title}>
                            {row.title}
                          </div>
                          <div
                            className="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground"
                            title={row.summary}
                          >
                            {row.summary}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {storyKey && jiraBrowseBase ? (
                        <a
                          href={issueHref(storyKey)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {storyKey}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!st ? (
                        <span className="text-muted-foreground">Non pubblicato</span>
                      ) : st.allDone ? (
                        <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
                          Completato
                        </Badge>
                      ) : (
                        <Badge variant="outline">{st.issues.filter((i) => i.done).length}/{st.issues.length} done</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer
        open={detailEntry !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DrawerContent side="right" size="lg">
          <DrawerHeader actions={<DrawerCloseButton />}>
            {detailEntry ? (
              <>
                <DrawerTitle className="pr-8 text-left text-base font-semibold leading-snug">
                  {detailEntry.title}
                </DrawerTitle>
                <p className="mt-1 text-left text-xs text-muted-foreground">
                  <span className="font-mono">{detailEntry.idTema}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono">{detailEntry.epicId}</span>
                  <span className="mx-1.5">·</span>
                  {detailEntry.areaPrefix}
                </p>
              </>
            ) : (
              <DrawerTitle>Catalogo</DrawerTitle>
            )}
          </DrawerHeader>
          <DrawerBody>
            {detailEntry ? (
              <div className="text-sm">
                <CatalogEntryPrdPanel e={detailEntry} showHeading={false} />
              </div>
            ) : null}
          </DrawerBody>
          <DrawerFooter>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={closeDetail}>
                Chiudi
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={previewOpen} onOpenChange={setPreviewOpen}>
        <DrawerContent side="right" size="lg">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Anteprima testi PRD ({selectedEntries.length})</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-6 text-sm">
              {selectedEntries.map((e) => (
                <CatalogEntryPrdPanel key={e.idTema} e={e} />
              ))}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
                Chiudi
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
