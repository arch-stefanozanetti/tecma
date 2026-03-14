import { useEffect, useState } from "react";
import { Users, CalendarDays, Handshake, Bell, ChevronRight } from "lucide-react";
import moment from "moment";
import "moment/locale/it";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type { ClientRow, CalendarEvent, RequestRow, NotificationRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { PageSimple } from "../shared/PageSimple";
import { cn } from "../../lib/utils";

moment.locale("it");

interface Customer360PageProps {
  workspaceId: string;
  projectIds: string[];
  onSectionChange: (section: string, state?: object) => void;
  navigate: (path: string) => void;
}

export function Customer360Page({ workspaceId, projectIds, onSectionChange, navigate }: Customer360PageProps) {
  const [recentClients, setRecentClients] = useState<ClientRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestRow[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || projectIds.length === 0) {
      setLoading(false);
      return;
    }
    const from = moment().startOf("day");
    const to = moment().add(7, "days").endOf("day");
    setLoading(true);
    Promise.all([
      followupApi.queryClients({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 5,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
      }).then((r) => setRecentClients(r.data ?? [])),
      followupApi.queryCalendar({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 10,
        searchText: "",
        sort: { field: "startsAt", direction: 1 },
        filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
      }).then((r) => setUpcomingEvents(r.data ?? [])),
      followupApi.queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 10,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
      }).then((r) => setRecentRequests(r.data ?? [])),
      followupApi.getNotifications(workspaceId, { page: 1, perPage: 5 }).then((r) => setRecentNotifications(r.data ?? [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId, projectIds]);

  if (loading) {
    return (
      <PageSimple title="Customer 360" description="Vista aggregata clienti, appuntamenti e trattative.">
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </PageSimple>
    );
  }

  return (
    <PageSimple
      title="Customer 360"
      description="Vista aggregata: clienti recenti, prossimi appuntamenti, trattative e notifiche."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-chrome border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              Clienti recenti
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSectionChange("clients")}>
              Vedi tutti
            </Button>
          </div>
          {recentClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cliente.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentClients.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${c._id}`)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                    )}
                  >
                    <span className="font-medium text-foreground truncate">{c.fullName ?? c.email ?? c._id}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-chrome border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Prossimi appuntamenti
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSectionChange("calendar")}>
              Calendario
            </Button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun appuntamento nei prossimi 7 giorni.</p>
          ) : (
            <ul className="space-y-1.5">
              {upcomingEvents.map((ev) => (
                <li key={ev._id}>
                  <button
                    type="button"
                    onClick={() => onSectionChange("calendar", { eventId: ev._id })}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {moment(ev.startsAt).format("DD MMM HH:mm")}
                    </span>
                    <span className="truncate text-foreground">{ev.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-chrome border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Handshake className="h-4 w-4 text-muted-foreground" />
              Trattative
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSectionChange("requests")}>
              Pipeline
            </Button>
          </div>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna trattativa.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentRequests.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => onSectionChange("requests", { requestId: r._id })}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="truncate text-foreground">{r.clientName ?? r._id}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{r.status}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-chrome border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Ultime notifiche
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSectionChange("inbox")}>
              Inbox
            </Button>
          </div>
          {recentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna notifica.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentNotifications.slice(0, 5).map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof n.link === "string") navigate(n.link);
                      else if (n.link && "section" in n.link) onSectionChange(n.link.section, n.link.state);
                      else onSectionChange("inbox");
                    }}
                    className={cn(
                      "flex w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      !n.read && "bg-muted/50"
                    )}
                  >
                    <span className="font-medium text-foreground line-clamp-1">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{moment(n.createdAt).fromNow()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageSimple>
  );
}
