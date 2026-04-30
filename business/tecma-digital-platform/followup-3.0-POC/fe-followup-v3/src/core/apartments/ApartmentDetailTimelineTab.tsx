import { History } from "lucide-react";
import { formatDate } from "../../lib/formatDate";

export interface ApartmentDetailTimelineTabProps {
  auditEvents: Array<{ _id: string; at: string; action: string; actor?: { email?: string } }>;
}

export function ApartmentDetailTimelineTab({ auditEvents }: ApartmentDetailTimelineTabProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <History className="h-4 w-4" />
        Ultime attività
      </h2>
      {auditEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>
      ) : (
        <ul className="space-y-2">
          {auditEvents.map((ev) => (
            <li key={ev._id} className="flex gap-3 py-2 border-b border-border/50 last:border-0 text-sm">
              <span className="text-muted-foreground shrink-0">{formatDate(ev.at)}</span>
              <span className="font-medium text-foreground">
                {ev.action.replace(/\./g, " ")}
                {ev.actor?.email && (
                  <span className="text-muted-foreground font-normal ml-1">— {ev.actor.email}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
