import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Euro,
  ExternalLink,
  ListTree,
  Loader2,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

export type PriorityUrgency = "risk" | "opportunity" | "followup";

/** Max righe elenco dettaglio aggregato prima del testo “… e altre M” (allineato al design Cockpit). */
export const MAX_AGGREGATED_DETAIL_VISIBLE = 10;

export interface PriorityAggregatedItemRef {
  label: string;
  clientId?: string;
  apartmentId?: string;
  associationId?: string;
}

export interface PriorityActionItem {
  id: string;
  suggestionId?: string;
  title: string;
  urgency: PriorityUrgency;
  context: string;
  action: string;
  apartment?: string;
  daysSinceContact?: number;
  dealValue?: number;
  aggregatedKind?: string;
  aggregatedItems?: PriorityAggregatedItemRef[];
}

const URGENCY_CFG: Record<
  PriorityUrgency,
  { label: string; rail: string; badgeBg: string; badgeText: string }
> = {
  risk: {
    label: "Urgente",
    rail: "bg-red-500",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
  },
  opportunity: {
    label: "Opportunità",
    rail: "bg-indigo-500",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
  },
  followup: {
    label: "Follow-up",
    rail: "bg-emerald-500",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
  },
};

const CONTEXT_COLLAPSE_AT = 220;

export interface PrioritySuggestionsListProps {
  items: PriorityActionItem[];
  executingSuggestionId: string | null;
  scopeEmail: string | null | undefined;
  onExecuteWithAi: (item: PriorityActionItem) => void;
  onNavigateToSection?: (section: string, state?: object) => void;
  getSectionForAction: (action: string) => string;
}

function PriorityRow({
  item,
  index,
  executingSuggestionId,
  scopeEmail,
  onExecuteWithAi,
  onNavigateToSection,
  getSectionForAction,
}: {
  item: PriorityActionItem;
  index: number;
  executingSuggestionId: string | null;
  scopeEmail: string | null | undefined;
  onExecuteWithAi: (item: PriorityActionItem) => void;
  onNavigateToSection?: (section: string, state?: object) => void;
  getSectionForAction: (action: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const cfg = URGENCY_CFG[item.urgency];
  const longContext = item.context.length > CONTEXT_COLLAPSE_AT;
  const contextDisplay =
    !longContext || expanded ? item.context : `${item.context.slice(0, CONTEXT_COLLAPSE_AT).trim()}…`;

  const staggerMs = Math.min(index, 5) * 55;

  return (
    <article
      className="flex overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both"
      style={{ animationDelay: `${staggerMs}ms` }}
      data-testid="priority-suggestion-row"
    >
      <div className={cn("w-1 shrink-0 self-stretch rounded-l-xl", cfg.rail)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                cfg.badgeBg,
                cfg.badgeText
              )}
            >
              {cfg.label}
            </span>
          </div>
          <h3 className="text-base font-semibold leading-snug text-foreground">{item.title}</h3>
          {item.apartment && <p className="text-xs text-muted-foreground">{item.apartment}</p>}
          <p className="text-sm leading-relaxed text-muted-foreground">{contextDisplay}</p>
          {longContext && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Mostra meno
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Mostra tutto
                </>
              )}
            </button>
          )}
          {(item.daysSinceContact !== undefined || item.dealValue !== undefined) && (
            <div className="flex flex-wrap gap-3 text-xs">
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
          {item.aggregatedItems && item.aggregatedItems.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                data-testid="priority-aggregated-toggle"
                onClick={() => setDetailsOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ListTree className="h-3.5 w-3.5 shrink-0" />
                {detailsOpen ? "Nascondi dettagli" : `Mostra dettagli (${item.aggregatedItems.length})`}
              </button>
              {detailsOpen && (
                <ul
                  data-testid="priority-aggregated-list"
                  className="list-inside list-disc space-y-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                >
                  {item.aggregatedItems.slice(0, MAX_AGGREGATED_DETAIL_VISIBLE).map((sub, si) => (
                    <li key={`${item.id}-agg-${si}`} className="leading-relaxed">
                      {sub.clientId ? (
                        <Link
                          to={`/clients/${sub.clientId}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {sub.label}
                        </Link>
                      ) : (
                        <span className="text-foreground/90">{sub.label}</span>
                      )}
                    </li>
                  ))}
                  {item.aggregatedItems.length > MAX_AGGREGATED_DETAIL_VISIBLE && (
                    <li
                      data-testid="priority-aggregated-more"
                      className="list-none pl-0 text-[11px] italic text-muted-foreground"
                    >
                      … e altre {item.aggregatedItems.length - MAX_AGGREGATED_DETAIL_VISIBLE}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Azione consigliata: </span>
            {item.action}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-[min(100%,11rem)] sm:items-stretch">
          {item.suggestionId && scopeEmail && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-11 w-full rounded-lg"
              disabled={executingSuggestionId === item.suggestionId}
              onClick={() => onExecuteWithAi(item)}
              title="L'AI usa tool sul workspace (lettura dati, calendario, task) secondo il suggerimento"
            >
              {executingSuggestionId === item.suggestionId ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4 shrink-0" />
              )}
              Esegui con AI
            </Button>
          )}
          {onNavigateToSection && (
            <Tooltip content="Apre la sezione in app" secondLine={item.action} side="left" className="w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 w-full rounded-lg"
                onClick={() => onNavigateToSection(getSectionForAction(item.action))}
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5 shrink-0" />
                Vai in app
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </article>
  );
}

export function PrioritySuggestionsList({
  items,
  executingSuggestionId,
  scopeEmail,
  onExecuteWithAi,
  onNavigateToSection,
  getSectionForAction,
}: PrioritySuggestionsListProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3" data-testid="priority-suggestions-list">
      {items.map((item, index) => (
        <PriorityRow
          key={item.id}
          item={item}
          index={index}
          executingSuggestionId={executingSuggestionId}
          scopeEmail={scopeEmail}
          onExecuteWithAi={onExecuteWithAi}
          onNavigateToSection={onNavigateToSection}
          getSectionForAction={getSectionForAction}
        />
      ))}
    </div>
  );
}
