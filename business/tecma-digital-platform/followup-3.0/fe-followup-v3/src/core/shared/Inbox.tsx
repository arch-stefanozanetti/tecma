import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { followupApi } from "../../api/followupApi";
import type { NotificationRow } from "../../types/domain";
import { cn } from "../../lib/utils";

const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  request_action_due: "Scadenza azione",
  calendar_reminder: "Promemoria",
  assignment: "Assegnazione",
  mention: "Menzione",
  other: "Notifica",
};

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(d);
  }
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface InboxProps {
  workspaceId: string;
  onSectionChange: (section: string, state?: object) => void;
  navigate: (path: string) => void;
}

export function Inbox({ workspaceId, onSectionChange, navigate }: InboxProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(
    (readFilter?: boolean) => {
      if (!workspaceId) return;
      setLoading(true);
      followupApi
        .getNotifications(workspaceId, { read: readFilter, page: 1, perPage: 50 })
        .then((res) => {
          setNotifications(res.data ?? []);
          if (readFilter === false && res.pagination) {
            setUnreadCount(res.pagination.total ?? res.data?.length ?? 0);
          }
        })
        .catch(() => {
          setNotifications([]);
          setUnreadCount(0);
        })
        .finally(() => setLoading(false));
    },
    [workspaceId]
  );

  const loadUnreadCount = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getNotifications(workspaceId, { read: false, page: 1, perPage: 1 })
      .then((res) => setUnreadCount(res.pagination?.total ?? 0))
      .catch(() => setUnreadCount(0));
  }, [workspaceId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  const handleSelect = useCallback(
    (n: NotificationRow) => {
      const link = n.link;
      if (typeof link === "string") {
        navigate(link);
      } else if (link && typeof link === "object" && "section" in link) {
        onSectionChange(link.section, link.state);
      }
      if (!n.read) {
        followupApi.markNotificationRead(n._id).catch(() => {}).finally(loadUnreadCount);
        setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setOpen(false);
    },
    [navigate, onSectionChange, loadUnreadCount]
  );

  const handleMarkAllRead = useCallback(() => {
    followupApi
      .markAllNotificationsRead(workspaceId)
      .then(() => {
        setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
        setUnreadCount(0);
      })
      .catch(() => {});
  }, [workspaceId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-chrome border border-border bg-background text-foreground hover:bg-muted"
        aria-label={unreadCount > 0 ? `${unreadCount} notifiche non lette` : "Apri inbox notifiche"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Inbox</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {loading && (
              <p className="text-center text-sm text-muted-foreground">Caricamento...</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Nessuna notifica.</p>
            )}
            {!loading &&
              notifications.length > 0 &&
              notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => handleSelect(n)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border px-2 py-3 text-left transition-colors hover:bg-muted",
                    !n.read && "bg-muted/50"
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="font-medium text-foreground">{n.title}</span>
                  {n.body && <span className="text-sm text-muted-foreground line-clamp-2">{n.body}</span>}
                  <span className="text-xs text-muted-foreground">{formatNotificationDate(n.createdAt)}</span>
                </button>
              ))}
          </div>
          {!loading && notifications.some((n) => !n.read) && (
            <div className="border-t border-border pt-3">
              <Button variant="outline" size="sm" className="w-full" onClick={handleMarkAllRead}>
                Segna tutti come letti
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
