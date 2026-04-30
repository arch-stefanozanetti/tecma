import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Euro,
  Building2,
  Users,
  CalendarDays,
  Home,
  Handshake,
  UserPlus,
  CalendarPlus,
  ChevronRight,
  RefreshCw,
  Flame,
} from "lucide-react";
import moment from "moment";
import "moment/locale/it";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { useIsMobile } from "../shared/useIsMobile";
import { isPriceAvailabilityRelevant } from "../features";
import type { CalendarEvent, ClientRow, RequestRow } from "../../types/domain";
import type { AiSuggestion, ProjectAccessProject } from "../../types/domain";
import { HttpApiError } from "../../api/http";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { PrioritySuggestionsList, type PriorityActionItem } from "./PrioritySuggestionsList";
import { AgentExecutionResultSheet, type AgentExecutionResult } from "./AgentExecutionResultSheet";
import { trackProductEvent } from "../../telemetry/trackProductEvent";

moment.locale("it");

const BUCKET_BASEURL = import.meta.env.VITE_BUCKET_BASEURL ?? "";

type SectionId = "calendar" | "clients" | "apartments" | "createApartment" | "associateAptClient" | "requests" | "users" | "priceAvailability";

interface CockpitPageProps {
  workspaceId: string;
  projectIds: string[];
  /** Progetti filtrati per workspace (da App). Se non passati, usa useWorkspace().projects */
  projects?: ProjectAccessProject[];
  onNavigateToSection?: (section: SectionId, state?: object) => void;
  isAdmin?: boolean;
}

/** Mappa l'azione alla sezione di destinazione. */
const getSectionForAction = (action: string): SectionId => {
  const a = action.toLowerCase();
  if (a.includes("calendario") || a.includes("appuntamento") || a.includes("conferma appuntamento")) return "calendar";
  if (a.includes("proposta") || a.includes("associa") || a.includes("compromesso") || a.includes("reminder") || a.includes("proponi")) return "associateAptClient";
  return "clients";
}

const suggestionToCard = (s: AiSuggestion): PriorityActionItem => ({
  id: s._id,
  suggestionId: s._id,
  title: s.title,
  urgency: s.risk === "high" ? "risk" : s.risk === "medium" ? "opportunity" : "followup",
  context: s.reason,
  action: s.recommendedAction,
  dealValue: undefined,
  daysSinceContact: undefined,
  aggregatedKind: s.aggregatedKind,
  aggregatedItems:
    s.aggregatedItems && s.aggregatedItems.length > 0 ? s.aggregatedItems.map((i) => ({ ...i })) : undefined,
});

/** Allineato a MAX_SUGGESTION_GROUPS nel BE: max macro-card Priorità operative. */
const MAX_PRIORITY_GROUPS = 8;

/** Richieste in evidenza sul cockpit (BSS H1 2025 / spec adoption-first): scadenza preventivo o trattativa “fredda”. */
export function selectCockpitUrgentRequests(staleCandidates: RequestRow[], recentWithQuotes: RequestRow[]): RequestRow[] {
  const byId = new Map<string, RequestRow>();
  const add = (r: RequestRow) => {
    if (!byId.has(r._id)) byId.set(r._id, r);
  };

  const now = moment();
  const horizon = now.clone().add(2, "days").endOf("day");

  for (const r of recentWithQuotes) {
    if (!r.quoteExpiryOn) continue;
    const exp = moment(r.quoteExpiryOn).endOf("day");
    if (exp.isSameOrAfter(now.clone().startOf("day")) && exp.isSameOrBefore(horizon)) {
      const qs = String(r.quoteStatus || "").toLowerCase();
      if (["declined", "cancelled", "rejected"].includes(qs)) continue;
      add(r);
    }
  }

  const staleThreshold = now.clone().subtract(5, "days");
  for (const r of staleCandidates) {
    if ((r.status === "new" || r.status === "contacted") && moment(r.updatedAt).isBefore(staleThreshold)) {
      add(r);
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const ae = a.quoteExpiryOn ? moment(a.quoteExpiryOn).valueOf() : Number.POSITIVE_INFINITY;
      const be = b.quoteExpiryOn ? moment(b.quoteExpiryOn).valueOf() : Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      return moment(a.updatedAt).valueOf() - moment(b.updatedAt).valueOf();
    })
    .slice(0, 8);
}

function cockpitUrgentRowHint(r: RequestRow): string {
  if (r.quoteExpiryOn) {
    const exp = moment(r.quoteExpiryOn).endOf("day");
    const now = moment();
    if (exp.isSameOrAfter(now.clone().startOf("day")) && exp.isSameOrBefore(now.clone().add(2, "days").endOf("day"))) {
      return `Preventivo · scadenza ${moment(r.quoteExpiryOn).format("D MMM")}`;
    }
  }
  if (r.status === "new" || r.status === "contacted") {
    const label = r.status === "new" ? "Nuovo" : "Contattato";
    return `${label} · in pausa da ${moment(r.updatedAt).fromNow()}`;
  }
  return "";
}

function mapSuggestionsLoadError(error: unknown): { message: string; showAiConfigCta: boolean } {
  if (error instanceof HttpApiError) {
    if (error.code === "FEATURE_NOT_ENTITLED") {
      return {
        message: "Suggerimenti AI non disponibili: il modulo AI Approvals non è attivo su questo workspace.",
        showAiConfigCta: false,
      };
    }
    if (error.status === 403) {
      return {
        message: "Non hai i permessi necessari per leggere i suggerimenti AI in questo workspace.",
        showAiConfigCta: false,
      };
    }
    if (error.status === 401) {
      return {
        message: "Sessione non valida o scaduta. Ricarica la pagina ed effettua nuovamente l'accesso.",
        showAiConfigCta: false,
      };
    }
  }
  return {
    message: "Impossibile caricare i suggerimenti. Verifica la connessione e la configurazione AI del workspace.",
    showAiConfigCta: true,
  };
}

export const CockpitPage = ({ workspaceId, projectIds, projects: projectsProp, onNavigateToSection, isAdmin }: CockpitPageProps) => {
  const isMobile = useIsMobile();
  const { email: scopeEmail, projects: scopeProjects, hasPermission } = useWorkspace();
  const canCreateRequest = hasPermission("requests.create");
  const canCreateCalendarEvent = hasPermission("calendar.create");
  const canReadCalendar = hasPermission("calendar.read");
  const canReadRequests = hasPermission("requests.read");
  /** Usa progetti passati da App (filtrati per workspace) se disponibili, altrimenti scope */
  const projects = projectsProp ?? scopeProjects ?? [];
  const [actions, setActions] = useState<PriorityActionItem[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [llmUsedForSuggestions, setLlmUsedForSuggestions] = useState<boolean | null>(null);
  const [suggestionsFromCache, setSuggestionsFromCache] = useState(true);
  const [showAiConfigCtaOnError, setShowAiConfigCtaOnError] = useState(false);
  const [suggestionsRefreshing, setSuggestionsRefreshing] = useState(false);
  const [executingSuggestionId, setExecutingSuggestionId] = useState<string | null>(null);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const [lastAgentResult, setLastAgentResult] = useState<AgentExecutionResult | null>(null);
  const { toast, toastError } = useToast();
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [kpi, setKpi] = useState<{
    apartments: number | null;
    soldOrRented: number | null;
    calendar: number | null;
    clients: number | null;
    requests: number | null;
  }>({ apartments: null, soldOrRented: null, calendar: null, clients: null, requests: null });
  const [kpiLoading, setKpiLoading] = useState(false);
  const [recentClients, setRecentClients] = useState<ClientRow[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestRow[]>([]);
  const [urgentRequests, setUrgentRequests] = useState<RequestRow[]>([]);
  const [metricsTick, setMetricsTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const n = projectIds.length;
    const project_count = n === 0 ? 0 : n === 1 ? 1 : 2;
    trackProductEvent("cockpit.page.view", {
      section: "cockpit",
      workspace_id: workspaceId,
      project_count,
    });
  }, [workspaceId, projectIds.length]);

  const applySuggestionsResponse = useCallback(
    (res: { data?: AiSuggestion[]; aiConfigured?: boolean; llmUsed?: boolean | null }, fromCache: boolean) => {
      const cards = (res.data || []).map(suggestionToCard);
      setActions(cards);
      setAiConfigured(res.aiConfigured ?? true);
      setLlmUsedForSuggestions(res.llmUsed === true ? true : res.llmUsed === false ? false : null);
      setSuggestionsFromCache(fromCache);
      setShowAiConfigCtaOnError(false);
    },
    []
  );

  const handleRefreshSuggestions = useCallback(() => {
    if (!workspaceId || projectIds.length === 0) return;
    setSuggestionsRefreshing(true);
    setSuggestionsError(null);
    followupApi
      .generateAiSuggestions(workspaceId, projectIds, MAX_PRIORITY_GROUPS)
      .then((res) => {
        applySuggestionsResponse(res, false);
        toast({
          title: "Suggerimenti aggiornati",
          description: "È stato generato un nuovo batch e salvato in elenco.",
          variant: "success",
          autoHideDuration: 4500,
        });
      })
      .catch(() => {
        setSuggestionsError("Impossibile aggiornare i suggerimenti. Riprova tra poco.");
        toastError("Aggiornamento suggerimenti non riuscito");
      })
      .finally(() => setSuggestionsRefreshing(false));
  }, [workspaceId, projectIds, applySuggestionsResponse, toast, toastError]);

  const handleExecuteWithAi = async (item: PriorityActionItem) => {
    const sid = item.suggestionId;
    if (!sid || !scopeEmail) return;
    setExecutingSuggestionId(sid);
    try {
      const res = await followupApi.executeAiSuggestion(sid, { actorEmail: scopeEmail });
      const result: AgentExecutionResult = {
        summary: res.summary,
        toolLog: res.toolLog ?? [],
        steps: res.steps ?? 0,
      };
      setLastAgentResult(result);
      setAgentSheetOpen(true);
      toast({
        title: "Esecuzione AI completata",
        description: "Usa «Vedi dettagli» per sintesi e elenco tool eseguiti.",
        variant: "success",
        autoHideDuration: 8000,
        actions: (
          <Button type="button" variant="outline" size="sm" className="min-h-9 rounded-lg" onClick={() => setAgentSheetOpen(true)}>
            Vedi dettagli
          </Button>
        ),
      });
      try {
        await followupApi.decideAiSuggestion(sid, "approved", scopeEmail, "Eseguito con AI (agente)");
      } catch {
        /* approvazione best-effort */
      }
      setActions((prev) => prev.filter((a) => a.id !== item.id));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Esecuzione AI non riuscita");
    } finally {
      setExecutingSuggestionId(null);
    }
  };

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    const unsubscribe = followupApi.subscribeRealtimeEvents(
      workspaceId,
      { eventTypes: ["metrics.updated"], projectId: projectIds.length === 1 ? projectIds[0] : undefined },
      () => setMetricsTick((v) => v + 1)
    );
    return () => unsubscribe();
  }, [workspaceId, projectIds]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    setKpiLoading(true);
    const base = { workspaceId, projectIds, page: 1, perPage: 1, searchText: "" };
    Promise.all([
      followupApi.apartments.queryApartments(base).then((r) => r.pagination.total),
      followupApi.apartments.queryApartments({ ...base, filters: { status: ["SOLD", "RENTED"] } }).then((r) => r.pagination.total),
      followupApi.queryCalendar({ ...base, filters: { dateFrom: moment().startOf("day").toISOString(), dateTo: moment().endOf("day").add(1, "year").toISOString() } }).then((r) => r.pagination.total),
      followupApi.clients.queryClients(base).then((r) => r.pagination.total),
      followupApi.queryRequests(base).then((r) => r.pagination.total),
    ])
      .then(([apartments, soldOrRented, calendar, clients, requests]) => setKpi({ apartments, soldOrRented, calendar, clients, requests }))
      .catch(() => setKpi({ apartments: null, soldOrRented: null, calendar: null, clients: null, requests: null }))
      .finally(() => setKpiLoading(false));
  }, [workspaceId, projectIds, metricsTick]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0 || !canReadCalendar) {
      setTodayEvents([]);
      return;
    }
    const dateFrom = moment().startOf("day").toISOString();
    const dateTo = moment().endOf("day").add(1, "day").toISOString();
    followupApi
      .queryCalendar({ workspaceId, projectIds, page: 1, perPage: 40, searchText: "", sort: { field: "startsAt", direction: 1 }, filters: { dateFrom, dateTo } })
      .then((res) => setTodayEvents(res.data || []))
      .catch(() => setTodayEvents([]));
  }, [workspaceId, projectIds, canReadCalendar]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0 || !canReadRequests) {
      setUrgentRequests([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      followupApi.queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 25,
        searchText: "",
        sort: { field: "updatedAt", direction: 1 },
        filters: { status: ["new", "contacted"] },
      }),
      followupApi.queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 40,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
        filters: {},
      }),
    ])
      .then(([staleRes, recentRes]) => {
        if (cancelled) return;
        setUrgentRequests(selectCockpitUrgentRequests(staleRes.data ?? [], recentRes.data ?? []));
      })
      .catch(() => {
        if (!cancelled) setUrgentRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectIds, metricsTick, canReadRequests]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    let cancelled = false;
    setSuggestionsError(null);
    setSuggestionsLoaded(false);
    followupApi
      .getAiSuggestions(workspaceId, projectIds, MAX_PRIORITY_GROUPS)
      .then((res) => {
        if (cancelled) return;
        applySuggestionsResponse(res, true);
        setSuggestionsLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        const mapped = mapSuggestionsLoadError(error);
        setActions([]);
        setAiConfigured(null);
        setLlmUsedForSuggestions(null);
        setSuggestionsFromCache(true);
        setSuggestionsError(mapped.message);
        setShowAiConfigCtaOnError(mapped.showAiConfigCta);
        setSuggestionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectIds, applySuggestionsResponse]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    followupApi.clients
      .queryClients({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 5,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
      })
      .then((r) => setRecentClients(r.data ?? []))
      .catch(() => setRecentClients([]));
    followupApi
      .queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 5,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
      })
      .then((r) => setRecentRequests(r.data ?? []))
      .catch(() => setRecentRequests([]));
  }, [workspaceId, projectIds]);

  const displayProjects = useMemo(() => projects.filter((p) => projectIds.includes(p.id)), [projects, projectIds]);
  /** Prossimi appuntamenti da ora fino a fine domani (finestra BSS / cockpit unificato). */
  const upcomingAppointments = useMemo(() => {
    const end = moment().endOf("day").add(1, "day");
    return [...todayEvents]
      .filter((e) => moment(e.startsAt).isSameOrAfter(moment()) && moment(e.startsAt).isSameOrBefore(end))
      .sort((a, b) => moment(a.startsAt).valueOf() - moment(b.startsAt).valueOf())
      .slice(0, 6);
  }, [todayEvents]);
  const priorityActions = useMemo(() => actions.slice(0, MAX_PRIORITY_GROUPS), [actions]);

  const isLoading = !suggestionsLoaded && actions.length === 0;

  return (
    <div className="min-h-full bg-background font-body text-foreground">
      <div className="mx-auto max-w-5xl space-y-8 px-5 pb-10 pt-6 lg:px-20">

        {/* ── KPI ───────────────────────────────────────────────────────────── */}
        {workspaceId && projectIds.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Appartamenti
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpiLoading ? "—" : kpi.apartments ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Euro className="h-4 w-4" />
                Venduti / Affittati
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpiLoading ? "—" : kpi.soldOrRented ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                In calendario
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpiLoading ? "—" : kpi.calendar ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="h-4 w-4" />
                Clienti / Lead
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpiLoading ? "—" : kpi.clients ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Handshake className="h-4 w-4" />
                Trattative
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpiLoading ? "—" : kpi.requests ?? "—"}</p>
            </div>
          </div>
        )}

        {/* ── Welcome + link rapidi e azioni di flusso ──────────────────────── */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bentornato, <span className="font-medium text-foreground">{scopeEmail || "Utente"}</span>
          </p>
          {onNavigateToSection && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link rapidi</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("calendar")}>
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    Calendario
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("requests")}>
                    Trattative
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("clients")}>
                    Clienti
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("apartments")}>
                    <Home className="mr-1.5 h-3.5 w-3.5" />
                    Appartamenti
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("createApartment")}>
                    <Building2 className="mr-1.5 h-3.5 w-3.5" />
                    Crea appartamento
                  </Button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">Azioni rapide</h3>
                <p className="mb-2 text-xs text-muted-foreground">Avvia subito un flusso (form o pannello si apre in automatico).</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("calendar", { openNewEvent: true })}>
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    Fissa appuntamento
                  </Button>
                  {isAdmin && (
                    <Button size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("users", { openAddUser: true })}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Aggiungi utente
                    </Button>
                  )}
                  {isPriceAvailabilityRelevant(projects, projectIds) && (
                    <Button size="sm" variant="secondary" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("priceAvailability")}>
                      <Euro className="mr-1.5 h-3.5 w-3.5" />
                      Prezzi e disponibilità
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Oggi: appuntamenti | da fare | trattative in evidenza (BSS / adoption-first) ─ */}
        {workspaceId && projectIds.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
            <section
              className="flex min-h-[200px] flex-col rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              aria-labelledby="cockpit-appts-title"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id="cockpit-appts-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Appuntamenti
                </h2>
                {onNavigateToSection && canReadCalendar && (
                  <Button variant="ghost" size="sm" className="min-h-11 shrink-0 rounded-lg text-xs" onClick={() => onNavigateToSection("calendar")}>
                    Calendario
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Oggi e domani, in ordine di orario.</p>
              {!canReadCalendar ? (
                <p className="mt-3 text-sm text-muted-foreground">Non hai accesso al calendario per questo workspace.</p>
              ) : upcomingAppointments.length > 0 ? (
                <ul className="mt-2 flex-1 space-y-1">
                  {upcomingAppointments.map((ev) => {
                    const dayLabel = moment(ev.startsAt).isSame(moment(), "day") ? "Oggi" : "Domani";
                    return (
                      <li key={ev._id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                        <span className="shrink-0 tabular-nums text-xs font-medium uppercase text-muted-foreground">{dayLabel}</span>
                        <span className="tabular-nums">{moment(ev.startsAt).format("HH:mm")}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{ev.title}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
                  <p className="text-sm text-muted-foreground">Nessun appuntamento in programma per oggi e domani.</p>
                  {onNavigateToSection && canCreateCalendarEvent && (
                    <Button size="sm" className="min-h-11 w-fit rounded-lg" onClick={() => onNavigateToSection("calendar", { openNewEvent: true })}>
                      <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                      Nuovo appuntamento
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section
              className="flex min-h-[200px] flex-col rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              aria-labelledby="cockpit-todo-title"
            >
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 id="cockpit-todo-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Da fare
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Suggerimenti operativi e follow-up (anche senza LLM, se configurato).</p>
                  {aiConfigured === true && llmUsedForSuggestions === false && (
                    <p className="text-xs text-muted-foreground">Suggerimenti da regole interne. Verifica API key e limiti provider.</p>
                  )}
                  {aiConfigured === true && llmUsedForSuggestions === true && (
                    <p className="text-xs text-muted-foreground">Suggerimenti raffinati dal modello AI.</p>
                  )}
                </div>
                {aiConfigured === true && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0 rounded-lg"
                    disabled={suggestionsRefreshing}
                    onClick={() => void handleRefreshSuggestions()}
                  >
                    <RefreshCw className={cn("mr-2 h-4 w-4 shrink-0", suggestionsRefreshing && "animate-spin")} />
                    Aggiorna
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading ? (
                  <p className="rounded-lg border border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">Caricamento…</p>
                ) : suggestionsError ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">{suggestionsError}</p>
                    {isAdmin && showAiConfigCtaOnError && (
                      <Button className="mt-3 min-h-11" size="sm" onClick={() => navigate("/workspace")}>
                        Configura AI
                      </Button>
                    )}
                  </div>
                ) : aiConfigured === false ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">Nessun provider AI collegato al workspace.</p>
                    {isAdmin && (
                      <Button className="mt-3 min-h-11" size="sm" onClick={() => navigate("/workspace")}>
                        Collega provider
                      </Button>
                    )}
                  </div>
                ) : priorityActions.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">Nessun suggerimento in elenco.</p>
                    {aiConfigured === true && (
                      <p className="mt-2 text-xs text-muted-foreground">Usa «Aggiorna» per generarne di nuovi.</p>
                    )}
                  </div>
                ) : (
                  <PrioritySuggestionsList
                    items={priorityActions}
                    executingSuggestionId={executingSuggestionId}
                    scopeEmail={scopeEmail}
                    onExecuteWithAi={(item) => void handleExecuteWithAi(item)}
                    onNavigateToSection={
                      onNavigateToSection ? (section, state) => onNavigateToSection(section as SectionId, state) : undefined
                    }
                    getSectionForAction={getSectionForAction}
                  />
                )}
              </div>
              {actions.length > MAX_PRIORITY_GROUPS && onNavigateToSection && (
                <div className="mt-2 text-center">
                  <Button variant="outline" size="sm" className="min-h-11 rounded-lg" onClick={() => onNavigateToSection("requests")}>
                    Vedi tutte le trattative
                  </Button>
                </div>
              )}
            </section>

            <section
              className="flex min-h-[200px] flex-col rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              aria-labelledby="cockpit-hot-title"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id="cockpit-hot-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 shrink-0 text-orange-600" aria-hidden />
                  Trattative in evidenza
                </h2>
                {onNavigateToSection && canReadRequests && (
                  <Button variant="ghost" size="sm" className="min-h-11 shrink-0 rounded-lg text-xs" onClick={() => onNavigateToSection("requests")}>
                    Pipeline
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Preventivi in scadenza o trattative ferme da alcuni giorni.</p>
              {!canReadRequests ? (
                <p className="mt-3 text-sm text-muted-foreground">Non hai accesso alle trattative.</p>
              ) : urgentRequests.length > 0 ? (
                <ul className="mt-2 flex-1 space-y-1">
                  {urgentRequests.map((r) => (
                    <li key={r._id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToSection) {
                            trackProductEvent("cockpit.urgent_request.open", {
                              section: "cockpit",
                              workspace_id: workspaceId,
                              request_id: r._id,
                            });
                            onNavigateToSection("requests", { openRequestId: r._id });
                          }
                        }}
                        className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="w-full truncate font-medium text-foreground">{r.clientName ?? r._id}</span>
                        <span className="text-xs text-muted-foreground">{cockpitUrgentRowHint(r)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 flex flex-1 flex-col justify-end gap-2">
                  <p className="text-sm text-muted-foreground">Nessuna trattativa urgente al momento.</p>
                  {onNavigateToSection && canCreateRequest && (
                    <Button size="sm" className="min-h-11 w-fit rounded-lg" onClick={() => onNavigateToSection("requests", { openNewRequest: true })}>
                      Nuova trattativa
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Gestione asset (progetti) ─────────────────────────────────────── */}
        {displayProjects.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gestione asset</h2>
            <div className={cn("flex gap-3 pb-2", isMobile ? "flex-col" : "overflow-x-auto")}>
              {displayProjects.map((project) => {
                const heroUrl = BUCKET_BASEURL
                  ? `${BUCKET_BASEURL}/initiatives/${project.displayName || project.id}/businessplatform/hero-image.jpg?v=${new Date().getDate()}`
                  : null;
                return (
                  <div
                    key={project.id}
                    className={cn("overflow-hidden rounded-ui border border-border bg-card shadow-sm", !isMobile && "min-w-[200px] max-w-[240px] flex-shrink-0")}
                  >
                    {heroUrl && (
                      <div className="aspect-[16/10] bg-muted">
                        <img src={heroUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium text-foreground">{project.displayName || project.name || project.id}</p>
                      {onNavigateToSection && (
                        <Button variant="ghost" size="sm" className="mt-2 min-h-11 rounded-lg text-xs" onClick={() => onNavigateToSection("apartments")}>
                          Vai
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Clienti e trattative (widget 360) ───────────────────────────────── */}
        {(recentClients.length > 0 || recentRequests.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {recentClients.length > 0 && (
              <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ultimi clienti
                  </span>
                  {onNavigateToSection && (
                    <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => onNavigateToSection("clients")}>
                      Vedi tutti
                    </Button>
                  )}
                </div>
                <ul className="space-y-1">
                  {recentClients.map((c) => (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${c._id}`)}
                        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="font-medium text-foreground truncate">{c.fullName ?? c.email ?? c._id}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recentRequests.length > 0 && (
              <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trattative da seguire
                  </span>
                  {onNavigateToSection && (
                    <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => onNavigateToSection("requests")}>
                      Pipeline
                    </Button>
                  )}
                </div>
                <ul className="space-y-1">
                  {recentRequests.map((r) => (
                    <li key={r._id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToSection) {
                            trackProductEvent("cockpit.widget.request_open", {
                              section: "cockpit",
                              workspace_id: workspaceId,
                              request_id: r._id,
                            });
                            onNavigateToSection("requests", { openRequestId: r._id });
                          }
                        }}
                        className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="truncate text-foreground">{r.clientName ?? r._id}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <AgentExecutionResultSheet open={agentSheetOpen} onOpenChange={setAgentSheetOpen} result={lastAgentResult} />
    </div>
  );
};
