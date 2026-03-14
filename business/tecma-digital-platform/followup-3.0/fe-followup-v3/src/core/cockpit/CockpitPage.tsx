import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Euro, Building2, Users, CalendarDays, Home, Handshake, UserPlus, CalendarPlus, ChevronRight } from "lucide-react";
import moment from "moment";
import "moment/locale/it";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { isPriceAvailabilityRelevant } from "../features";
import type { CalendarEvent, ClientRow, RequestRow } from "../../types/domain";
import type { AiSuggestion, ProjectAccessProject } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

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

type Urgency = "risk" | "opportunity" | "followup";

interface ActionCard {
  id: string;
  suggestionId?: string;
  clientName: string;
  urgency: Urgency;
  context: string;
  action: string;
  apartment?: string;
  daysSinceContact?: number;
  dealValue?: number;
}

const INITIAL_ACTIONS: ActionCard[] = [
  { id: "1", clientName: "Bianchi Mario", urgency: "risk", context: "Nessuna risposta alla proposta inviata 5 giorni fa.", action: "Chiama adesso", apartment: "Apt A-12 · Via Roma 14", daysSinceContact: 5, dealValue: 380_000 },
  { id: "2", clientName: "Ferrari Luca", urgency: "opportunity", context: "Ha richiesto un preventivo questa mattina.", action: "Crea proposta", apartment: "Apt B-04 · Via Dante 3", dealValue: 290_000 },
  { id: "3", clientName: "Mancini Paolo", urgency: "risk", context: "Compromesso da firmare entro venerdì.", action: "Invia reminder", apartment: "Apt F-09 · Via Torino 22", dealValue: 520_000 },
  { id: "4", clientName: "Conti Sara", urgency: "followup", context: "Visita confermata per giovedì alle 15:00.", action: "Conferma appuntamento", apartment: "Apt C-01 · Via Garibaldi 8" },
  { id: "5", clientName: "Ricci Elena", urgency: "opportunity", context: "Apt A-12 corrisponde al suo profilo.", action: "Proponi visita", apartment: "Apt A-12 · Via Roma 14", dealValue: 380_000 },
  { id: "6", clientName: "Rossi Anna", urgency: "risk", context: "Proposta inviata 7 giorni fa. Sollecita.", action: "Sollecita risposta", apartment: "Apt D-07 · Via Milano 5", daysSinceContact: 7, dealValue: 320_000 },
  { id: "7", clientName: "Verdi Marco", urgency: "followup", context: "Ha visitato l'annuncio 3 volte questa settimana.", action: "Invia proposta personalizzata", apartment: "Apt E-03 · Via Napoli 17" },
];

const URGENCY_CFG: Record<Urgency, { label: string; badgeBg: string; badgeText: string }> = {
  risk: { label: "Urgente", badgeBg: "bg-red-50", badgeText: "text-red-600" },
  opportunity: { label: "Opportunità", badgeBg: "bg-indigo-50", badgeText: "text-indigo-600" },
  followup: { label: "Follow-up", badgeBg: "bg-emerald-50", badgeText: "text-emerald-600" },
};

const suggestionToCard = (s: AiSuggestion): ActionCard => ({
  id: s._id,
  suggestionId: s._id,
  clientName: s.title,
  urgency: s.risk === "high" ? "risk" : s.risk === "medium" ? "opportunity" : "followup",
  context: s.reason,
  action: s.recommendedAction,
  dealValue: undefined,
  daysSinceContact: undefined,
});

const MAX_PRIORITY_TILES = 8;

export const CockpitPage = ({ workspaceId, projectIds, projects: projectsProp, onNavigateToSection, isAdmin }: CockpitPageProps) => {
  const { email: scopeEmail, projects: scopeProjects } = useWorkspace();
  /** Usa progetti passati da App (filtrati per workspace) se disponibili, altrimenti scope */
  const projects = projectsProp ?? scopeProjects ?? [];
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    setKpiLoading(true);
    const base = { workspaceId, projectIds, page: 1, perPage: 1, searchText: "" };
    Promise.all([
      followupApi.queryApartments(base).then((r) => r.pagination.total),
      followupApi.queryApartments({ ...base, filters: { status: ["SOLD", "RENTED"] } }).then((r) => r.pagination.total),
      followupApi.queryCalendar({ ...base, filters: { dateFrom: moment().startOf("day").toISOString(), dateTo: moment().endOf("day").add(1, "year").toISOString() } }).then((r) => r.pagination.total),
      followupApi.queryClients(base).then((r) => r.pagination.total),
      followupApi.queryRequests(base).then((r) => r.pagination.total),
    ])
      .then(([apartments, soldOrRented, calendar, clients, requests]) => setKpi({ apartments, soldOrRented, calendar, clients, requests }))
      .catch(() => setKpi({ apartments: null, soldOrRented: null, calendar: null, clients: null, requests: null }))
      .finally(() => setKpiLoading(false));
  }, [workspaceId, projectIds]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    const dateFrom = moment().startOf("day").toISOString();
    const dateTo = moment().endOf("day").toISOString();
    followupApi
      .queryCalendar({ workspaceId, projectIds, page: 1, perPage: 20, searchText: "", sort: { field: "startsAt", direction: 1 }, filters: { dateFrom, dateTo } })
      .then((res) => setTodayEvents(res.data || []))
      .catch(() => setTodayEvents([]));
  }, [workspaceId, projectIds]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    followupApi
      .generateAiSuggestions(workspaceId, projectIds, 10)
      .then((res) => {
        const cards = (res.data || []).map(suggestionToCard);
        setActions(cards.length > 0 ? cards : [...INITIAL_ACTIONS]);
        setSuggestionsLoaded(true);
      })
      .catch(() => {
        setActions([...INITIAL_ACTIONS]);
        setSuggestionsLoaded(true);
      });
  }, [workspaceId, projectIds]);

  useEffect(() => {
    if (suggestionsLoaded && actions.length === 0) setActions([...INITIAL_ACTIONS]);
  }, [suggestionsLoaded, actions.length]);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) return;
    followupApi
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
  const nextEventsToday = useMemo(
    () =>
      [...todayEvents]
        .filter((e) => moment(e.startsAt).isSame(moment(), "day") && moment(e.startsAt).isSameOrAfter(moment()))
        .sort((a, b) => moment(a.startsAt).valueOf() - moment(b.startsAt).valueOf())
        .slice(0, 5),
    [todayEvents]
  );
  const priorityActions = useMemo(() => actions.slice(0, MAX_PRIORITY_TILES), [actions]);

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
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("calendar")}>
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    Calendario
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("requests")}>
                    Trattative
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("clients")}>
                    Clienti
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("apartments")}>
                    <Home className="mr-1.5 h-3.5 w-3.5" />
                    Appartamenti
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("createApartment")}>
                    <Building2 className="mr-1.5 h-3.5 w-3.5" />
                    Crea appartamento
                  </Button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">Azioni rapide</h3>
                <p className="mb-2 text-xs text-muted-foreground">Avvia subito un flusso (form o pannello si apre in automatico).</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-lg" onClick={() => onNavigateToSection("calendar", { openNewEvent: true })}>
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    Fissa appuntamento
                  </Button>
                  {isAdmin && (
                    <Button size="sm" className="rounded-lg" onClick={() => onNavigateToSection("users", { openAddUser: true })}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Aggiungi utente
                    </Button>
                  )}
                  {isPriceAvailabilityRelevant(projects, projectIds) && (
                    <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => onNavigateToSection("priceAvailability")}>
                      <Euro className="mr-1.5 h-3.5 w-3.5" />
                      Prezzi e disponibilità
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Gestione asset (progetti) ─────────────────────────────────────── */}
        {displayProjects.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gestione asset</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {displayProjects.map((project) => {
                const heroUrl = BUCKET_BASEURL
                  ? `${BUCKET_BASEURL}/initiatives/${project.displayName || project.id}/businessplatform/hero-image.jpg?v=${new Date().getDate()}`
                  : null;
                return (
                  <div
                    key={project.id}
                    className="min-w-[200px] max-w-[240px] flex-shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                  >
                    {heroUrl && (
                      <div className="aspect-[16/10] bg-muted">
                        <img src={heroUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium text-foreground">{project.displayName || project.name || project.id}</p>
                      {onNavigateToSection && (
                        <Button variant="ghost" size="sm" className="mt-2 h-8 rounded-lg text-xs" onClick={() => onNavigateToSection("apartments")}>
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigateToSection("clients")}>
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
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigateToSection("requests")}>
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
                          if (r.clientId && onNavigateToSection) {
                            navigate(`/clients/${r.clientId}`);
                          } else if (onNavigateToSection) {
                            onNavigateToSection("requests", { requestId: r._id });
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
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

        {/* ── Prossimi appuntamenti oggi ─────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Oggi
            </span>
            {onNavigateToSection && (
              <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={() => onNavigateToSection("calendar")}>
                Vai al Calendario
              </Button>
            )}
          </div>
          {nextEventsToday.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {nextEventsToday.map((ev) => (
                <li key={ev._id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3 flex-shrink-0 text-primary" />
                  <span className="tabular-nums">{moment(ev.startsAt).format("HH:mm")}</span>
                  <span className="truncate text-foreground">{ev.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">Nessun appuntamento in programma oggi.</p>
          )}
        </div>

        {/* ── Priorità operative (griglia di tile) ───────────────────────────── */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priorità operative</h2>
          {isLoading ? (
            <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Caricamento azioni suggerite...</p>
          ) : priorityActions.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nessuna azione suggerita al momento.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {priorityActions.map((item) => {
                const cfg = URGENCY_CFG[item.urgency];
                return (
                  <div
                    key={item.id}
                    className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cfg.badgeBg, cfg.badgeText)}>
                        {cfg.label}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-foreground">{item.clientName}</h3>
                    {item.apartment && <p className="mt-0.5 text-xs text-muted-foreground">{item.apartment}</p>}
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.context}</p>
                    {(item.daysSinceContact !== undefined || item.dealValue !== undefined) && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        {item.daysSinceContact !== undefined && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Clock className="h-3 w-3" />
                            {item.daysSinceContact} giorni
                          </span>
                        )}
                        {item.dealValue !== undefined && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Euro className="h-3 w-3" />
                            {item.dealValue.toLocaleString("it-IT")}
                          </span>
                        )}
                      </div>
                    )}
                    {onNavigateToSection && (
                      <Button
                        className="mt-4 w-full rounded-lg"
                        size="sm"
                        onClick={() => onNavigateToSection(getSectionForAction(item.action))}
                      >
                        {item.action}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {actions.length > MAX_PRIORITY_TILES && onNavigateToSection && (
            <div className="mt-3 text-center">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => onNavigateToSection("requests")}>
                Vedi tutte le trattative
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
