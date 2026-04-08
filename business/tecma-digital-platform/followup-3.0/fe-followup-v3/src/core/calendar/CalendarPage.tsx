import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/it";
import {
  Bell,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Plus,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { CalendarEvent, WorkspaceUserRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { useIsMobile } from "../shared/useIsMobile";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
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
import { CalendarEventFormDrawer, type CalendarEventFormPrefill } from "./CalendarEventFormDrawer";
import { useToast } from "../../contexts/ToastContext";
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  CALENDAR_ACTIVITY_STATUSES,
  CALENDAR_ACTIVITY_TYPES,
  OUTCOME_LABELS,
} from "./calendarConstants";
import { Checkbox } from "../../components/ui/checkbox";

moment.locale("it");
moment.updateLocale("it", { week: { dow: 1, doy: 4 } });

const HOUR_HEIGHT = 46;
const TIME_COL_WIDTH = 50;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
/** Allineamento click sulla griglia (minuti da mezzanotte). */
const SLOT_SNAP_MINUTES = 30;

type ViewType = "day" | "week" | "month";

const VIEW_LABELS: Record<ViewType, string> = {
  day: "Giorno",
  week: "Settimana",
  month: "Mese",
};

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

function statusAccentColor(status: CalendarEvent["activityStatus"] | undefined): string {
  switch (status) {
    case "confirmed":
      return "#2e872b";
    case "pending":
      return "#ff7e21";
    case "lowReliability":
    case "canceled":
      return "#ca4a46";
    default:
      return "transparent";
  }
}

/** Barra sinistra: stato (se presente) o colore vendor o canale `source`. */
function mergeEventCardColors(
  event: CalendarEvent,
  vendorHex: string | undefined
): Pick<CSSProperties, "background" | "borderLeft" | "color"> {
  const { border, bg, text } = sourceColor(event.source);
  const st = statusAccentColor(event.activityStatus);
  const hasStatus = event.activityStatus && event.activityStatus !== "none" && st !== "transparent";
  const leftColor = hasStatus ? st : vendorHex || border;
  const bgStyle =
    vendorHex && !hasStatus
      ? (`linear-gradient(90deg, ${vendorHex} 0, ${vendorHex} 3px, ${bg} 3px)` as const)
      : bg;
  return {
    borderLeft: `4px solid ${leftColor}`,
    background: bgStyle,
    color: text,
  };
}

function capitalizeFirstIt(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase("it-IT") + s.slice(1);
}

function activityStatusBadgeVariant(
  status: NonNullable<CalendarEvent["activityStatus"]> | undefined
): "success" | "warning" | "destructive" | "secondary" {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "lowReliability":
    case "canceled":
      return "destructive";
    default:
      return "secondary";
  }
}

interface CalendarPageProps {
  workspaceId?: string;
  projectIds?: string[];
}

const EventDrawerDetailRow = ({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: ReactNode;
}) => (
  <div className="flex gap-3 text-sm">
    {icon != null ? <span className="mt-0.5 flex-shrink-0 text-muted-foreground">{icon}</span> : null}
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  </div>
);

// ─── Event Drawer (solo lettura + Modifica + Elimina) ─────────────────────────
const EventDrawer = ({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
  canEditEvent,
  canDeleteEvent,
  projectLabelById,
  clientNameById,
  apartmentLabelById,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEditEvent: boolean;
  canDeleteEvent: boolean;
  projectLabelById: Map<string, string>;
  clientNameById: Map<string, string>;
  apartmentLabelById: Map<string, string>;
}) => {
  const [deleting, setDeleting] = useState(false);
  const { toastError } = useToast();
  if (!event) return null;
  const startM = moment(event.startsAt).locale("it");
  const endM = moment(event.endsAt).locale("it");
  const { border, bg } = sourceColor(event.source);
  const canDelete = event.workspaceId !== "legacy";
  const at = event.activityType ? ACTIVITY_TYPE_LABELS[event.activityType] : null;
  const statusKey = event.activityStatus ?? "none";
  const ast = ACTIVITY_STATUS_LABELS[statusKey];
  const oc = event.outcome ? OUTCOME_LABELS[event.outcome] : null;

  const aptIds = (event.apartmentIds?.length ? event.apartmentIds : event.apartmentId ? [event.apartmentId] : []).filter(
    Boolean
  ) as string[];
  const aptLines =
    aptIds.length > 0
      ? aptIds.map((id) => apartmentLabelById.get(id) ?? id)
      : [];

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

  const dateLine = capitalizeFirstIt(startM.format("dddd D MMMM YYYY"));

  return (
    <SidePanel variant="operational" open={open} onOpenChange={(o) => !o && onClose()}>
      <SidePanelContent side="right" size="lg" className="flex flex-col">
        <SidePanelHeader actions={<SidePanelClose />}>
          <div className="space-y-2 pr-2">
            <Badge
              variant="outline"
              className="border font-normal"
              style={{ borderColor: border, color: border, backgroundColor: bg }}
            >
              {sourceLabel[event.source]}
            </Badge>
            <SidePanelTitle className="text-left text-lg font-semibold leading-snug tracking-tight">
              {event.title}
            </SidePanelTitle>
          </div>
        </SidePanelHeader>
        <SidePanelBody className="flex-1 space-y-6 overflow-y-auto text-sm">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border">
                <Calendar className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium leading-tight text-foreground">{dateLine}</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" aria-hidden />
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {event.allDay ? "Tutto il giorno" : `${startM.format("HH:mm")} – ${endM.format("HH:mm")}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dettaglio attività</h3>
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <EventDrawerDetailRow label="Tipo di attività">{at ?? "—"}</EventDrawerDetailRow>
              <Separator className="my-1" />
              <EventDrawerDetailRow label="Status">
                <Badge variant={activityStatusBadgeVariant(event.activityStatus)} className="font-normal">
                  {ast}
                </Badge>
              </EventDrawerDetailRow>
              {oc != null ? (
                <>
                  <Separator className="my-1" />
                  <EventDrawerDetailRow label="Esito">{oc}</EventDrawerDetailRow>
                </>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collegamenti</h3>
            <div className="space-y-4 rounded-xl border border-border bg-background p-4">
              <EventDrawerDetailRow label="Progetto" icon={<Building2 className="h-4 w-4" />}>
                {projectLabelById.get(event.projectId) ?? event.projectId}
              </EventDrawerDetailRow>
              {event.clientId ? (
                <>
                  <Separator />
                  <EventDrawerDetailRow label="Cliente" icon={<User className="h-4 w-4" />}>
                    {clientNameById.get(event.clientId) ?? event.clientId}
                  </EventDrawerDetailRow>
                </>
              ) : null}
              {aptLines.length > 0 ? (
                <>
                  <Separator />
                  <EventDrawerDetailRow label="Immobili" icon={<MapPin className="h-4 w-4" />}>
                    <ul className="list-inside list-disc space-y-1">
                      {aptLines.map((line, i) => (
                        <li key={`${aptIds[i]}-${i}`} className="text-sm">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </EventDrawerDetailRow>
                </>
              ) : null}
              {event.assignedUserId ? (
                <>
                  <Separator />
                  <EventDrawerDetailRow label="Assegnatario" icon={<Mail className="h-4 w-4" />}>
                    <span className="break-all">{event.assignedUserId}</span>
                  </EventDrawerDetailRow>
                </>
              ) : null}
            </div>
          </section>

          {(event.notesInternal || event.notesClientVisible || event.additionalInfo) && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note e informazioni</h3>
              <div className="space-y-3">
                {event.notesInternal ? (
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Note interne</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{event.notesInternal}</p>
                  </div>
                ) : null}
                {event.notesClientVisible ? (
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Note visibili al cliente</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{event.notesClientVisible}</p>
                  </div>
                ) : null}
                {event.additionalInfo ? (
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Informazioni aggiuntive</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{event.additionalInfo}</p>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {event.notifyClientOnActivityUpdate ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <Bell className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>
                Notifiche aggiornamenti al cliente: <span className="font-medium text-foreground">attivate</span> (invio
                email in roadmap).
              </span>
            </div>
          ) : null}
        </SidePanelBody>
        <SidePanelFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto sm:min-w-[120px]" onClick={onClose}>
            Chiudi
          </Button>
          {onEdit && canEditEvent ? (
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto sm:min-w-[120px]"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              Modifica
            </Button>
          ) : null}
          {canDelete && onDelete && canDeleteEvent ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto sm:min-w-[120px]"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminazione..." : "Elimina"}
            </Button>
          ) : null}
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
  vendorColorByUserId,
}: {
  event: CalendarEvent;
  style: CSSProperties;
  onClick: (ev: CalendarEvent) => void;
  vendorColorByUserId: Map<string, string>;
}) => {
  const v =
    event.assignedUserId != null
      ? vendorColorByUserId.get(event.assignedUserId.toLowerCase())
      : undefined;
  const chroma = mergeEventCardColors(event, v);
  const startM = moment(event.startsAt);
  const endM = moment(event.endsAt);
  return (
    <button
      type="button"
      data-calendar-event-card
      className="absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80 z-20"
      style={{ ...style, ...chroma }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
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
  onEmptySlotClick,
  canCreate,
  vendorColorByUserId,
}: {
  days: moment.Moment[];
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
  onEmptySlotClick: (startLocal: moment.Moment) => void;
  canCreate: boolean;
  vendorColorByUserId: Map<string, string>;
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
            className={cn(
              "relative border-l border-border",
              isToday && "bg-blue-50/30",
              canCreate && "cursor-pointer"
            )}
            style={{
              gridColumn: colIdx + 2,
              gridRow: `1 / ${HOURS.length + 1}`,
              height: HOUR_HEIGHT * 24,
            }}
            title={canCreate ? "Clicca per creare un evento in questo orario" : undefined}
            onClick={(e) => {
              if (!canCreate) return;
              if ((e.target as HTMLElement).closest("[data-calendar-event-card]")) return;
              const col = e.currentTarget;
              const rect = col.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const dayHeight = HOUR_HEIGHT * 24;
              const clampedY = Math.max(0, Math.min(y, dayHeight - 0.001));
              const minutesFloat = (clampedY / dayHeight) * (24 * 60);
              const snapped = Math.min(
                24 * 60 - SLOT_SNAP_MINUTES,
                Math.round(minutesFloat / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES
              );
              const start = day.clone().startOf("day").add(snapped, "minutes");
              onEmptySlotClick(start);
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
                className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
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
                  vendorColorByUserId={vendorColorByUserId}
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
  onEmptyDayClick,
  canCreate,
  vendorColorByUserId,
}: {
  currentDate: moment.Moment;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
  onEmptyDayClick: (dayStart: moment.Moment) => void;
  canCreate: boolean;
  vendorColorByUserId: Map<string, string>;
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
                isToday && "bg-blue-50/40",
                canCreate && "cursor-pointer hover:bg-muted/40"
              )}
              title={canCreate ? "Clicca per creare un evento (ore 9:00)" : undefined}
              onClick={(e) => {
                if (!canCreate) return;
                if ((e.target as HTMLElement).closest("[data-calendar-event-pill]")) return;
                onEmptyDayClick(day.clone().hour(9).minute(0).second(0));
              }}
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
                  const v =
                    ev.assignedUserId != null
                      ? vendorColorByUserId.get(ev.assignedUserId.toLowerCase())
                      : undefined;
                  const chroma = mergeEventCardColors(ev, v);
                  return (
                    <button
                      key={ev._id}
                      type="button"
                      data-calendar-event-pill
                      className="w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80"
                      style={chroma}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
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
  const isMobile = useIsMobile();
  const { workspaceId, selectedProjectIds, projects, hasPermission, email: userEmail } = useWorkspace();
  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) {
      map.set(p.id, p.displayName?.trim() || p.name?.trim() || p.id);
    }
    return map;
  }, [projects]);
  const canCreateCalendar = hasPermission("calendar.create");
  const canUpdateCalendar = hasPermission("calendar.update");
  const canDeleteCalendar = hasPermission("calendar.delete");
  const canReadAllVendors = hasPermission("calendar.readAllVendors");
  const canAssignAny = hasPermission("calendar.assignAny");
  const [view, setView] = useState<ViewType>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "day" : "week"));
  const [currentDate, setCurrentDate] = useState(moment());
  useEffect(() => {
    if (isMobile && view !== "day") setView("day");
  }, [isMobile]);
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
  /** Orario scelto da click su griglia / giorno (create). */
  const [createPrefill, setCreatePrefill] = useState<CalendarEventFormPrefill | undefined>(undefined);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserRow[]>([]);
  const [clientsLiteRows, setClientsLiteRows] = useState<Array<{ _id: string; fullName: string }>>([]);
  const [agendaMode, setAgendaMode] = useState<"me" | "all" | "users">("me");
  const [agendaPickUsers, setAgendaPickUsers] = useState<string[]>([]);
  const [filterActivityKind, setFilterActivityKind] = useState<"all" | NonNullable<CalendarEvent["activityType"]>>("all");
  const [filterActivityState, setFilterActivityState] = useState<"all" | NonNullable<CalendarEvent["activityStatus"]>>("all");
  const [eventDrawerApartmentLabels, setEventDrawerApartmentLabels] = useState<Map<string, string>>(() => new Map());

  const hasScope = Boolean(workspaceId && selectedProjectIds.length > 0);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceUsers([]);
      return;
    }
    followupApi
      .listWorkspaceUsers(workspaceId)
      .then((r) => setWorkspaceUsers(r.data ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || selectedProjectIds.length === 0) {
      setClientsLiteRows([]);
      return;
    }
    followupApi
      .queryClientsLite(workspaceId, selectedProjectIds)
      .then((r) => setClientsLiteRows(r.data ?? []))
      .catch(() => setClientsLiteRows([]));
  }, [workspaceId, selectedProjectIds]);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientsLiteRows) {
      m.set(c._id, c.fullName);
    }
    return m;
  }, [clientsLiteRows]);

  const vendorColorByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of workspaceUsers) {
      const col = u.calendarDisplayColor?.trim();
      if (col && /^#[0-9A-Fa-f]{6}$/.test(col)) {
        m.set(u.userId.trim().toLowerCase(), col);
      }
    }
    return m;
  }, [workspaceUsers]);

  useEffect(() => {
    if (!dialogOpen || !selectedEvent || !workspaceId) {
      setEventDrawerApartmentLabels(new Map());
      return;
    }
    const aptIds = [
      ...(selectedEvent.apartmentIds ?? []),
      ...(selectedEvent.apartmentId ? [selectedEvent.apartmentId] : []),
    ].filter(Boolean) as string[];
    if (aptIds.length === 0) {
      setEventDrawerApartmentLabels(new Map());
      return;
    }
    let cancelled = false;
    followupApi.apartments
      .queryApartments({
        workspaceId,
        projectIds: [selectedEvent.projectId],
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "code", direction: 1 },
        filters: {},
      })
      .then((res) => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const a of res.data ?? []) {
          const label = [a.code, a.name].filter(Boolean).join(" — ") || a._id;
          m.set(a._id, label);
        }
        setEventDrawerApartmentLabels(m);
      })
      .catch(() => {
        if (!cancelled) setEventDrawerApartmentLabels(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, selectedEvent, workspaceId]);

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

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterSource !== "all" && ev.source !== filterSource) return false;
      if (filterProjectId !== "all" && ev.projectId !== filterProjectId) return false;
      return true;
    });
  }, [events, filterSource, filterProjectId]);

  const serverCalendarFilters = useMemo(() => {
    const dateFrom = queryDateRange.from.toISOString();
    const dateTo = queryDateRange.to.toISOString();
    const f: Record<string, unknown> = { dateFrom, dateTo };
    if (filterActivityKind !== "all") f.activityType = filterActivityKind;
    if (filterActivityState !== "all") f.activityStatus = filterActivityState;
    if (canReadAllVendors) {
      const em = userEmail.trim().toLowerCase();
      if (agendaMode === "me" && em) f.assignedUserIds = [em];
      else if (agendaMode === "users" && agendaPickUsers.length > 0) {
        f.assignedUserIds = agendaPickUsers.map((x) => x.trim().toLowerCase()).filter(Boolean);
      }
    }
    return f;
  }, [
    queryDateRange,
    canReadAllVendors,
    agendaMode,
    agendaPickUsers,
    userEmail,
    filterActivityKind,
    filterActivityState,
  ]);

  useEffect(() => {
    let ignore = false;
    if (!workspaceId || selectedProjectIds.length === 0) return;
    setIsLoading(true);
    setError(null);
    followupApi
      .queryCalendar({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "startsAt", direction: 1 },
        filters: serverCalendarFilters,
      })
      .then((res) => {
        const data = res?.data ?? [];
        if (!ignore) setEvents(data);
      })
      .catch((e) => { if (!ignore) setError(e instanceof Error ? e.message : "Errore caricamento eventi"); })
      .finally(() => { if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [workspaceId, selectedProjectIds, serverCalendarFilters, refreshKey]);

  const handleEventClick = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setDialogOpen(true);
  };

  const handleOpenNewEvent = () => {
    setCreatePrefill(undefined);
    setEventToEdit(null);
    setEventFormMode("create");
    setEventFormOpen(true);
  };

  const openCreateAtSlot = (start: moment.Moment) => {
    if (!canCreateCalendar) return;
    const end = start.clone().add(1, "hour");
    setEventToEdit(null);
    setEventFormMode("create");
    setCreatePrefill({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
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
    setCurrentDate((d) => d.clone().add(direction, view));
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
          <Button
            size="sm"
            className="min-h-11 min-w-[44px] gap-1.5"
            onClick={handleOpenNewEvent}
            disabled={!canCreateCalendar}
            title={!canCreateCalendar ? "Non hai il permesso di creare eventi" : undefined}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuovo evento
          </Button>
          <Button variant="outline" size="sm" className="min-h-11 min-w-[44px] gap-1.5" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtri
          </Button>
        </div>
      </div>

      {/* Nav header */}
      <div className="flex items-center justify-between border-b border-border bg-white px-6 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-11 min-w-[44px] text-xs" onClick={() => setCurrentDate(moment())}>
            Oggi
          </Button>
          <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-white hover:bg-muted transition-colors" onClick={() => navigatePeriod(-1)} aria-label="Periodo precedente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-white hover:bg-muted transition-colors" onClick={() => navigatePeriod(1)} aria-label="Periodo successivo">
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
                "border-r border-border px-3 py-1.5 min-h-11 text-xs font-medium last:border-r-0 transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              )}
              onClick={() => setView(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {hasScope && canReadAllVendors && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-white px-6 py-2">
          <span className="text-xs font-medium text-muted-foreground">Agenda</span>
          <Select
            value={agendaMode}
            onValueChange={(v) => setAgendaMode(v as "me" | "all" | "users")}
          >
            <SelectTrigger className="h-9 w-[220px] rounded-lg border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Solo i miei eventi</SelectItem>
              <SelectItem value="all">Tutti i vendor</SelectItem>
              <SelectItem value="users">Utenti selezionati…</SelectItem>
            </SelectContent>
          </Select>
          {agendaMode === "users" && (
            <div className="flex max-w-2xl flex-wrap gap-x-4 gap-y-2">
              {workspaceUsers.map((u) => {
                const id = u.userId.trim().toLowerCase();
                const checked = agendaPickUsers.includes(id);
                return (
                  <label key={u._id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        setAgendaPickUsers((prev) => {
                          if (c === true) return [...new Set([...prev, id])];
                          return prev.filter((x) => x !== id);
                        });
                      }}
                    />
                    <span className="max-w-[200px] truncate" title={u.userId}>
                      {u.userId}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

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
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onEventClick={handleEventClick}
          onEmptyDayClick={openCreateAtSlot}
          canCreate={canCreateCalendar}
          vendorColorByUserId={vendorColorByUserId}
        />
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
              onEmptySlotClick={openCreateAtSlot}
              canCreate={canCreateCalendar}
              vendorColorByUserId={vendorColorByUserId}
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
                <SelectTrigger className="min-h-11 rounded-lg border-border">
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
                <SelectTrigger className="min-h-11 rounded-lg border-border">
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo attività</label>
              <Select
                value={filterActivityKind}
                onValueChange={(v) =>
                  setFilterActivityKind(v as "all" | NonNullable<CalendarEvent["activityType"]>)
                }
              >
                <SelectTrigger className="min-h-11 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {CALENDAR_ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACTIVITY_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Status attività</label>
              <Select
                value={filterActivityState}
                onValueChange={(v) =>
                  setFilterActivityState(v as "all" | NonNullable<CalendarEvent["activityStatus"]>)
                }
              >
                <SelectTrigger className="min-h-11 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {CALENDAR_ACTIVITY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ACTIVITY_STATUS_LABELS[s]}
                    </SelectItem>
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
                setFilterActivityKind("all");
                setFilterActivityState("all");
                setAgendaMode("me");
                setAgendaPickUsers([]);
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
        canEditEvent={canUpdateCalendar}
        canDeleteEvent={canDeleteCalendar}
        projectLabelById={projectLabelById}
        clientNameById={clientNameById}
        apartmentLabelById={eventDrawerApartmentLabels}
      />
      <CalendarEventFormDrawer
        mode={eventFormMode}
        event={eventToEdit}
        defaultDate={currentDate}
        prefill={eventFormMode === "create" ? createPrefill : undefined}
        workspaceId={workspaceId ?? ""}
        projectIds={selectedProjectIds}
        projects={projects}
        workspaceUsers={workspaceUsers}
        currentUserEmail={userEmail}
        canAssignAny={canAssignAny}
        open={eventFormOpen}
        onClose={() => {
          setEventFormOpen(false);
          setCreatePrefill(undefined);
        }}
        onSaved={handleEventFormSaved}
      />
    </div>
  );
};
