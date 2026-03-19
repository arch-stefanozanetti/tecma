import { useCallback, useEffect, useState } from "react";
import { Check, Inbox as InboxIcon } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { NotificationRow, NotificationType } from "../../types/domain";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { PageSimple } from "./PageSimple";

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  request_action_due: "Scadenza azione",
  calendar_reminder: "Promemoria",
  assignment: "Assegnazione",
  mention: "Menzione",
  other: "Notifica",
};

const NOTIFICATION_TYPES: (NotificationType | "all")[] = [
  "all",
  "request_action_due",
  "calendar_reminder",
  "assignment",
  "mention",
  "other",
];

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface InboxPageProps {
  workspaceId: string;
  onSectionChange: (section: string, state?: object) => void;
  navigate: (path: string) => void;
}

const PER_PAGE = 25;

export function InboxPage({ workspaceId, onSectionChange, navigate }: InboxPageProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    const params: Parameters<typeof followupApi.getNotifications>[1] = {
      page,
      perPage: PER_PAGE,
    };
    if (readFilter === "read") params.read = true;
    if (readFilter === "unread") params.read = false;
    if (typeFilter !== "all") params.type = typeFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    followupApi
      .getNotifications(workspaceId, params)
      .then((res) => {
        setNotifications(res.data ?? []);
        setTotal(res.pagination?.total ?? 0);
      })
      .catch(() => {
        setNotifications([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, page, readFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    const unsubscribe = followupApi.subscribeRealtimeEvents(
      workspaceId,
      { eventTypes: ["notification.created", "request.status_changed", "calendar.event.created"] },
      () => {
        load();
      }
    );
    return () => unsubscribe();
  }, [workspaceId, load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleRowClick = useCallback(
    (n: NotificationRow) => {
      const link = n.link;
      if (typeof link === "string") {
        navigate(link);
      } else if (link && typeof link === "object" && "section" in link) {
        onSectionChange(link.section, link.state);
      }
      if (!n.read) {
        followupApi.markNotificationRead(n._id).then(() => load()).catch(() => {});
      }
    },
    [navigate, onSectionChange, load]
  );

  const handleMarkRead = useCallback(
    (e: React.MouseEvent, n: NotificationRow) => {
      e.stopPropagation();
      if (n.read) return;
      followupApi.markNotificationRead(n._id).then(() => load()).catch(() => {});
    },
    [load]
  );

  const handleMarkAllRead = useCallback(() => {
    followupApi.markAllNotificationsRead(workspaceId).then(() => load()).catch(() => {});
  }, [workspaceId, load]);

  const unreadInList = notifications.filter((n) => !n.read).length;

  return (
    <PageSimple
      title="Inbox"
      description="Notifiche e promemoria. Filtra per tipo, stato e intervallo date."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={readFilter} onValueChange={(v) => setReadFilter(v as typeof readFilter)}>
            <SelectTrigger className="min-h-11 w-[140px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="unread">Non lette</SelectItem>
              <SelectItem value="read">Lette</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="min-h-11 w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "Tutti i tipi" : NOTIFICATION_TYPE_LABEL[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Da</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[140px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">A</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[140px]"
            />
          </div>
          {unreadInList > 0 && (
            <Button variant="outline" size="sm" className="min-h-11" onClick={handleMarkAllRead}>
              Segna tutte come lette
            </Button>
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        )}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-chrome border border-border bg-muted/30 py-12">
            <InboxIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessuna notifica con i filtri selezionati.</p>
          </div>
        )}
        {!loading && notifications.length > 0 && (
          <>
            <ul className="rounded-chrome border border-border divide-y divide-border overflow-hidden bg-card">
              {notifications.map((n) => (
                <li key={n._id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(n);
                      }
                    }}
                    className={cn(
                      "flex min-h-11 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer",
                      !n.read && "bg-muted/30"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">
                        {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                      </span>
                      <p className="font-medium text-foreground mt-0.5">{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{formatNotificationDate(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 min-w-11 shrink-0"
                        onClick={(e) => handleMarkRead(e, n)}
                        title="Segna come letto"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {total} notifiche · pagina {page} di {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Precedente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Successiva
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageSimple>
  );
}
