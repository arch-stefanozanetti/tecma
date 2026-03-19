import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/it";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Building2, Plus, SlidersHorizontal } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { CalendarEvent } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "../../components/ui/side-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { CalendarEventFormDrawer } from "./CalendarEventFormDrawer";
import { useToast } from "../../contexts/ToastContext";

moment.locale("it");
moment.updateLocale("it", { week: { dow: 1, doy: 4 } });

const HOUR_HEIGHT = 46;
const TIME_COL_WIDTH = 50;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type ViewType = "day" | "week" | "month";

const sourceColor = (source: CalendarEvent["source"]) => {
  if (source === "FOLLOWUP_SELL") return { border: "#6266ef", bg: "#eef0ff", text: "#4347c4" };
  if (source === "FOLLOWUP_RENT") return { border: "#1bc47d", bg: "#e8fbf2", text: "#0d8e58" };
  return { border: "#f59e0b", bg: "#fffbeb", text: "#b45309" };
};

const sourceLabel: Record<CalendarEvent["source"], string> = {
  FOLLOWUP_SELL: "Vendita",
  FOLLOWUP_RENT: "Affitto",
  CUSTOM_SERVICE: "Servizio",
};

const SOURCE_OPTIONS: { value: CalendarEvent["source"]; label: string }[] = [
  { value: "FOLLOWUP_SELL", label: "Vendita" },
  { value: "FOLLOWUP_RENT", label: "Affitto" },
  { value: "CUSTOM_SERVICE", label: "Servizio" },
];

interface CalendarPageProps {
  workspaceId?: string;
  projectIds?: string[];
}

// ─── Event Drawer (solo lettura + Modifica + Elimina) ─────────────────────────
const EventDrawer = ({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  const [deleting, setDeleting] = useState(false);
  const { toastError } = useToast();
  if (!event) return null;
  const startM = moment(event.startsAt);
  const endM = moment(event.endsAt);
  const { border, bg } = sourceColor(event.source);
  const canDelete = event.workspaceId !== "legacy";

  const handleDelete = async () => {
    if (!canDelete || !onDelete) return;
    if (!window.confirm("Eliminare questo evento?")) return;
    setDeleting(true);
    try {
      await followupApi.deleteCalendarEvent(event._id);
      onDelete();
      onClose();
    } catch {
      toastError("Impossibile eliminare l'evento (potrebbe essere di sola lettura).");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SidePanel variant="operational" open={open} onOpenChange={(o) => !o && onClose()}>
      <SidePanelContent side="right" size="md">
        <SidePanelHeader actions={<SidePanelClose />}>
          <SidePanelTitle className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ background: border }} />
            {event.title}
          </SidePanelTitle>
        </SidePanelHeader>
        <SidePanelBody className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="capitalize">{startM.format("dddd D MMMM YYYY")}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{startM.format("HH:mm")} – {endM.format("HH:mm")}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-mono text-xs">{event.projectId}</span>
          </div>
          <div className="pt-1">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: bg, color: border, border: `1px solid ${border}` }}
            >
              {sourceLabel[event.source]}
            </span>
          </div>
        </SidePanelBody>
        <SidePanelFooter>
          {onEdit && (
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onClose(); onEdit(); }}>
              Modifica
            </Button>
          )}
          {canDelete && onDelete && (
            <Button variant="outline" size="sm" className="flex-1 text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminazione..." : "Elimina"}
            </Button>
          )}
        </SidePanelFooter>
      </SidePanelContent>
    </SidePanel>
  );
};

// ─── Event Card ───────────────────────────────────────────────────────────────
const EventCard = ({
  event,
  style,
  onClick,
}: {
  event: CalendarEvent;
  style: React.CSSProperties;
  onClick: (ev: CalendarEvent) => void;
}) => {
  const { border, bg, text } = sourceColor(event.source);
  const startM = moment(event.startsAt);
  const endM = moment(event.endsAt);
  return (
    <button
      type="button"
      className="absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80"
      style={{ ...style, borderLeft: `2px solid ${border}`, background: bg, color: text }}
      onClick={() => onClick(event)}
    >
      <div className="truncate font-medium leading-tight">{event.title}</div>
      <div className="truncate opacity-70">{startM.format("HH:mm")}–{endM.format("HH:mm")}</div>
    </button>
  );
};

// ─── Time Grid ────────────────────────────────────────────────────────────────
const TimeGrid = ({
  days,
  events,
  onEventClick,
}: {
  days: moment.Moment[];
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
}) => {
  const nowRef = useRef<HTMLDivElement>(null);
  const now = moment();
  const todayIdx = days.findIndex((d) => d.isSame(now, "day"));

  useEffect(() => {
    if (nowRef.current) nowRef.current.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);

  const eventsByDay = useMemo(
    () => days.map((day) => events.filter((ev) => moment(ev.startsAt).isSame(day, "day"))),
    [days, events]
  );

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${days.length}, 1fr)`, minWidth: 0 }}
    >
      {/* Time labels */}
      {HOURS.map((h) => (
        <div
          key={`t${h}`}
          className="relative border-b border-border"
          style={{ gridRow: h + 1, gridColumn: 1, height: HOUR_HEIGHT }}
        >
          {h > 0 && (
            <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground">
              {String(h).padStart(2, "0")}:00
            </span>
          )}
        </div>
      ))}

      {/* Day columns */}
      {days.map((day, colIdx) => {
        const isToday = day.isSame(now, "day");
        return (
          <div
            key={colIdx}
            className={cn("relative border-l border-border", isToday && "bg-blue-50/30")}
            style={{
              gridColumn: colIdx + 2,
              gridRow: `1 / ${HOURS.length + 1}`,
              height: HOUR_HEIGHT * 24,
            }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full border-b border-border"
                style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              />
            ))}
            {isToday && (
              <div
                ref={todayIdx === colIdx ? nowRef : undefined}
                className="absolute left-0 right-0 z-10 flex items-center"
                style={{ top: ((now.hours() * 60 + now.minutes()) / 60) * HOUR_HEIGHT }}
              >
                <div className="h-2 w-2 rounded-full bg-primary -ml-1 flex-shrink-0" />
                <div className="h-px flex-1 bg-primary" />
              </div>
            )}
            {eventsByDay[colIdx].map((ev) => {
              const startM = moment(ev.startsAt);
              const endM = moment(ev.endsAt);
              const top = ((startM.hours() * 60 + startM.minutes()) / 60) * HOUR_HEIGHT;
              const duration = endM.diff(startM, "minutes");
              const height = Math.max(20, (duration / 60) * HOUR_HEIGHT);
              return (
                <EventCard
                  key={ev._id}
                  event={ev}
                  style={{ top, left: 2, right: 2, height }}
                  onClick={onEventClick}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ─── Month View ───────────────────────────────────────────────────────────────
const MonthView = ({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: moment.Moment;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
}) => {
  const today = moment().startOf("day");
  const gridStart = currentDate.clone().startOf("month").startOf("week");
  const cells: moment.Moment[] = Array.from({ length: 42 }, (_, i) => gridStart.clone().add(i, "days"));

  return (
    <div className="flex-1 overflow-auto">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const isCurrentMonth = day.month() === currentDate.month();
          const isToday = day.isSame(today, "day");
          const dayEvents = events.filter((ev) => moment(ev.startsAt).isSame(day, "day"));
          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-2",
                !isCurrentMonth && "bg-muted/50 opacity-50",
                isToday && "bg-blue-50/40"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                {day.format("D")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const { border, bg, text } = sourceColor(ev.source);
                  return (
                    <button
                      key={ev._id}
                      type="button"
                      className="w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80"
                      style={{ borderLeft: `2px solid ${border}`, background: bg, color: text }}
                      onClick={() => onEventClick(ev)}
                    >
                      {ev.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} altri</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export const CalendarPage = (_props: CalendarPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, projects } = useWorkspace();
  const [view, setView] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(moment());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState<"create" | "edit">("create");
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSource, setFilterSource] = useState<"all" | CalendarEvent["source"]>("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("all");

  const hasScope = Boolean(workspaceId && selectedProjectIds.length > 0);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterSource !== "all" && ev.source !== filterSource) return false;
      if (filterProjectId !== "all" && ev.projectId !== filterProjectId) return false;
      return true;
    });
  }, [events, filterSource, filterProjectId]);

  const queryDateRange = useMemo(() => {
    if (view === "day") {
      const from = currentDate.clone().startOf("day");
      const to = currentDate.clone().endOf("day");
      return { from, to };
    }
    if (view === "week") {
      const from = currentDate.clone().startOf("week");
      const to = currentDate.clone().endOf("week");
      return { from, to };
    }
    const from = currentDate.clone().startOf("month").startOf("week");
    const to = currentDate.clone().endOf("month").endOf("week");
    return { from, to };
  }, [currentDate, view]);

  useEffect(() => {
    let ignore = false;
    if (!workspaceId || selectedProjectIds.length === 0) return;
    setIsLoading(true);
    setError(null);
    const dateFrom = queryDateRange.from.toISOString();
    const dateTo = queryDateRange.to.toISOString();
    // #region agent log
    fetch("http://127.0.0.1:7857/ingest/45821bd5-f1c6-412c-97d1-2d1ee6a22e0e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "94c3ac" }, body: JSON.stringify({ sessionId: "94c3ac", location: "CalendarPage.tsx:effect", message: "calendar query start", data: { workspaceId, selectedProjectIds, dateFrom, dateTo, view }, hypothesisId: "H1_H2", timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    followupApi
      .queryCalendar({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "startsAt", direction: 1 },
        filters: { dateFrom, dateTo }
      })
      .then((res) => {
        const data = res?.data ?? [];
        // #region agent log
        fetch("http://127.0.0.1:7857/ingest/45821bd5-f1c6-412c-97d1-2d1ee6a22e0e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "94c3ac" }, body: JSON.stringify({ sessionId: "94c3ac", location: "CalendarPage.tsx:queryThen", message: "calendar query result", data: { dataLength: data.length, firstId: data[0]?._id, firstProjectId: data[0]?.projectId, firstStartsAt: data[0]?.startsAt }, hypothesisId: "H1_H2_H4", timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        if (!ignore) setEvents(data);
      })
      .catch((e) => { if (!ignore) setError(e instanceof Error ? e.message : "Errore caricamento eventi"); })
      .finally(() => { if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [workspaceId, selectedProjectIds, queryDateRange, refreshKey]);

  const handleEventClick = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setDialogOpen(true);
  };

  const handleOpenNewEvent = () => {
    setEventToEdit(null);
    setEventFormMode("create");
    setEventFormOpen(true);
  };

  useEffect(() => {
    const state = location.state as { openNewEvent?: boolean } | null;
    if (state?.openNewEvent) {
      handleOpenNewEvent();
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, []);

  const handleOpenEditEvent = () => {
    if (selectedEvent) {
      setEventToEdit(selectedEvent);
      setEventFormMode("edit");
      setDialogOpen(false);
      setEventFormOpen(true);
    }
  };

  const handleEventFormSaved = (createdEvent?: CalendarEvent) => {
    // #region agent log
    if (createdEvent) fetch("http://127.0.0.1:7857/ingest/45821bd5-f1c6-412c-97d1-2d1ee6a22e0e", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "94c3ac" }, body: JSON.stringify({ sessionId: "94c3ac", location: "CalendarPage.tsx:handleEventFormSaved", message: "optimistic add", data: { createdId: createdEvent._id, projectId: createdEvent.projectId, startsAt: createdEvent.startsAt, selectedProjectIds }, hypothesisId: "H1_H3", timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    if (createdEvent) {
      setEvents((prev) => {
        const exists = prev.some((e) => e._id === createdEvent._id);
        if (exists) return prev;
        return [...prev, createdEvent].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
      });
    }
    setRefreshKey((k) => k + 1);
  };

  const weekStart = useMemo(() => currentDate.clone().startOf("week"), [currentDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.clone().add(i, "days")),
    [weekStart]
  );

  const navigatePeriod = (direction: -1 | 1) => {
    const unit = view === "day" ? "day" : view === "week" ? "week" : "month";
    setCurrentDate((d) => d.clone().add(direction, unit));
  };

  const title = () => {
    if (view === "month") return currentDate.format("MMMM YYYY");
    if (view === "week") {
      const start = currentDate.clone().startOf("week");
      const end = currentDate.clone().endOf("week");
      if (start.month() === end.month()) return `${start.format("D")} – ${end.format("D MMMM YYYY")}`;
      return `${start.format("D MMM")} – ${end.format("D MMM YYYY")}`;
    }
    return currentDate.format("dddd D MMMM YYYY");
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-white px-6 py-3">
        <h1 className="text-base font-semibold text-foreground">Calendario</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 gap-1.5" onClick={handleOpenNewEvent}>
            <Plus className="h-3.5 w-3.5" />
            Nuovo evento
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtri
          </Button>
        </div>
      </div>

      {/* Nav header */}
      <div className="flex items-center justify-between border-b border-border bg-white px-6 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentDate(moment())}>
            Oggi
          </Button>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white hover:bg-muted transition-colors" onClick={() => navigatePeriod(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white hover:bg-muted transition-colors" onClick={() => navigatePeriod(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-semibold capitalize text-foreground">{title()}</span>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border">
          {(["day", "week", "month"] as ViewType[]).map((v) => (
            <button
              key={v}
              type="button"
              className={cn(
                "border-r border-border px-3 py-1.5 text-xs font-medium last:border-r-0 transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setView(v)}
            >
              {v === "day" ? "Giorno" : v === "week" ? "Settimana" : "Mese"}
            </button>
          ))}
        </div>
      </div>

      {!hasScope && (
        <div className="mx-6 mt-6 rounded-chrome border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
          <p className="text-sm font-medium text-amber-900">
            Per vedere gli eventi seleziona un workspace e almeno un progetto.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Vai alla pagina Progetti per scegliere l’ambito di lavoro.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-amber-300 bg-white hover:bg-amber-100"
            onClick={() => navigate("/projects")}
          >
            Vai a Progetti
          </Button>
        </div>
      )}

      {hasScope && isLoading && (
        <div className="border-b border-border bg-blue-50 px-6 py-2 text-xs text-[#585bd7]">
          Caricamento eventi...
        </div>
      )}
      {hasScope && error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">{error}</div>
      )}

      {/* Calendar body */}
      {hasScope && view === "month" && (
        <MonthView currentDate={currentDate} events={filteredEvents} onEventClick={handleEventClick} />
      )}
      {hasScope && view !== "month" && (
        <>
          {/* Days header */}
          <div
            className="grid flex-shrink-0 border-b border-border bg-white"
            style={{ gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(${view === "week" ? 7 : 1}, 1fr)` }}
          >
            <div />
            {(view === "week" ? weekDays : [currentDate]).map((day, i) => {
              const isToday = day.isSame(moment(), "day");
              return (
                <div key={i} className={cn("py-2 text-center", isToday && "bg-blue-50/50")}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {day.format("ddd")}
                  </div>
                  <div
                    className={cn(
                      "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    )}
                  >
                    {day.format("D")}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Scroll area */}
          <div className="flex-1 overflow-auto">
            <TimeGrid
              days={view === "week" ? weekDays : [currentDate]}
              events={filteredEvents}
              onEventClick={handleEventClick}
            />
          </div>
        </>
      )}

      {hasScope && !isLoading && !error && events.length === 0 && (
        <div className="mx-6 mt-4 rounded-chrome border border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
          Nessun evento in questo periodo. Prova a cambiare vista o data, oppure crea un nuovo evento.
        </div>
      )}

      <SidePanel variant="operational" open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SidePanelContent side="right" size="sm">
          <SidePanelHeader actions={<SidePanelClose />}>
            <SidePanelTitle>Filtri calendario</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo evento</label>
              <Select value={filterSource} onValueChange={(v) => setFilterSource(v as "all" | CalendarEvent["source"])}>
                <SelectTrigger className="h-10 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Progetto</label>
              <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                <SelectTrigger className="h-10 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {projects.filter((p) => selectedProjectIds.includes(p.id)).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.displayName || p.name || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SidePanelBody>
          <SidePanelFooter>
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>
              Chiudi
            </Button>
            <Button
              onClick={() => {
                setFilterSource("all");
                setFilterProjectId("all");
              }}
            >
              Reset filtri
            </Button>
          </SidePanelFooter>
        </SidePanelContent>
      </SidePanel>

      <EventDrawer
        event={selectedEvent}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onEdit={handleOpenEditEvent}
        onDelete={handleEventFormSaved}
      />
      <CalendarEventFormDrawer
        mode={eventFormMode}
        event={eventToEdit}
        defaultDate={currentDate}
        workspaceId={workspaceId ?? ""}
        projectIds={selectedProjectIds}
        projects={projects}
        open={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
        onSaved={handleEventFormSaved}
      />
    </div>
  );
};
