import { cn } from "../lib/utils";
import type { RequestStatus, RequestTransitionRow } from "../types/domain";

const ROADMAP_ORDER: RequestStatus[] = [
  "new",
  "contacted",
  "viewing",
  "quote",
  "offer",
  "won",
  "lost",
];

const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Nuova",
  contacted: "Contattato",
  viewing: "Visita",
  quote: "Preventivo",
  offer: "Offerta",
  won: "Vinto",
  lost: "Perso",
};

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

interface RequestStatusRoadmapProps {
  currentStatus: RequestStatus;
  transitions: RequestTransitionRow[];
}

/** Mappa toState -> { createdAt, reason } dalla prima transizione che raggiunge quello stato */
function buildReachedAt(transitions: RequestTransitionRow[]): Map<RequestStatus, { createdAt: string; reason?: string }> {
  const sorted = [...transitions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const map = new Map<RequestStatus, { createdAt: string; reason?: string }>();
  for (const t of sorted) {
    if (!map.has(t.toState)) {
      map.set(t.toState, { createdAt: t.createdAt, reason: t.reason });
    }
  }
  return map;
}

/** True se lo stato è stato raggiunto (stato iniziale "new" o c’è una transizione con toState === status) */
function wasReached(status: RequestStatus, reachedAt: Map<RequestStatus, { createdAt: string; reason?: string }>): boolean {
  if (status === "new") return true;
  return reachedAt.has(status);
}

export function RequestStatusRoadmap({ currentStatus, transitions }: RequestStatusRoadmapProps) {
  const reachedAt = buildReachedAt(transitions);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-3">Percorso della trattativa</p>
      <div className="flex flex-wrap items-center gap-0">
        {ROADMAP_ORDER.map((status, i) => {
          const reached = wasReached(status, reachedAt);
          const isCurrent = currentStatus === status;
          const info = reachedAt.get(status);
          const isLast = i === ROADMAP_ORDER.length - 1;

          return (
            <div key={status} className="flex items-center gap-0">
              <div
                className={cn(
                  "flex flex-col items-center min-w-[4.5rem]",
                  reached && "text-foreground",
                  isCurrent && "text-primary font-medium",
                  !reached && !isCurrent && "text-muted-foreground/70"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs",
                    isCurrent && "border-primary bg-primary/15 text-primary",
                    reached && !isCurrent && "border-primary/50 bg-primary/5",
                    !reached && !isCurrent && "border-border bg-muted/30"
                  )}
                >
                  {reached && !isCurrent ? (
                    <span className="text-primary text-[10px]" aria-hidden>✓</span>
                  ) : (
                    <span className="text-[10px] font-medium">{i + 1}</span>
                  )}
                </div>
                <span className="mt-1.5 text-[11px] text-center leading-tight">{STATUS_LABEL[status]}</span>
                {info && (
                  <span className="mt-0.5 text-[10px] text-muted-foreground text-center">
                    {formatDate(info.createdAt)}
                    {info.reason ? ` · ${info.reason}` : ""}
                  </span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 w-4 sm:w-6 shrink-0 rounded",
                    reached ? "bg-primary/40" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
