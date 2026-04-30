import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/formatDate";
import type { RequestRow } from "../../types/domain";

export interface ApartmentDetailTrattativeTabProps {
  requestsLoading: boolean;
  requestsSorted: RequestRow[];
  getWorkflowConfig: (type: "rent" | "sell") => { statusLabelByCode: Record<string, string> };
}

export function ApartmentDetailTrattativeTab({
  requestsLoading,
  requestsSorted,
  getWorkflowConfig,
}: ApartmentDetailTrattativeTabProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Clienti e trattative
      </h2>
      {requestsLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : requestsSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna trattativa associata a questo appartamento. Le trattative con questo immobile appariranno qui.
        </p>
      ) : (
        <ul className="space-y-0">
          {requestsSorted.map((req) => (
            <li key={req._id} className="flex gap-3 py-3">
              <div
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  req.status === "won"
                    ? "bg-green-500"
                    : req.status === "lost"
                      ? "bg-muted-foreground/50"
                      : "bg-primary"
                )}
              />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {req.clientId ? (
                    <Link
                      to={`/clients/${req.clientId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {req.clientName ?? req.clientId}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {req.clientName ?? req.clientId ?? "—"}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {getWorkflowConfig(req.type).statusLabelByCode[req.status] ?? req.status}
                  </span>
                  <span className="text-muted-foreground">
                    — {req.type === "sell" ? "Vendita" : "Affitto"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(req.updatedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
