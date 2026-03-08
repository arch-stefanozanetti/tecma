/**
 * Contenuto del drawer filtri clienti — ispirato a fe-tecma-followup Drawer.Filters.
 * Sezioni: Intervallo di tempo (attività + date), Filtri (ricerca + accordion Tag, Azioni, Incaricati, Altre info).
 */
import { useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Accordion, AccordionItem } from "../../components/ui/accordion";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { STATUS_FILTER_OPTIONS } from "./constants";

const TIME_ACTIVITY_OPTIONS = [
  { value: "CREATED_ON", label: "Creato il" },
  { value: "UPDATED_ON", label: "Ultimo aggiornamento" },
  { value: "ACTIONS", label: "Azione intrapresa" },
] as const;

export interface TimeFrameDraft {
  activity: string;
  fromDate: string;
  toDate: string;
}

export interface ClientsFiltersDraft {
  status: string;
  timeFrame: TimeFrameDraft;
  filterSearch: string;
}

const defaultTimeFrame: TimeFrameDraft = {
  activity: "",
  fromDate: "",
  toDate: "",
};

export function getDefaultFiltersDraft(): ClientsFiltersDraft {
  return {
    status: "all",
    timeFrame: { ...defaultTimeFrame },
    filterSearch: "",
  };
}

interface ClientsFiltersDrawerContentProps {
  draft: ClientsFiltersDraft;
  onDraftChange: (draft: ClientsFiltersDraft) => void;
  onClearDates: () => void;
  onClearFilters: () => void;
}

export function ClientsFiltersDrawerContent({
  draft,
  onDraftChange,
  onClearDates,
  onClearFilters,
}: ClientsFiltersDrawerContentProps) {
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const { status, timeFrame, filterSearch } = draft;

  const updateDraft = (patch: Partial<ClientsFiltersDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const updateTimeFrame = (patch: Partial<TimeFrameDraft>) => {
    updateDraft({ timeFrame: { ...timeFrame, ...patch } });
  };

  const hasTimeFrame = timeFrame.activity && (timeFrame.fromDate || timeFrame.toDate);
  const hasAnyFilter = status !== "all" || hasTimeFrame;

  return (
    <div className="space-y-6">
      {/* Stato (sempre visibile in cima) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
        <Select value={status} onValueChange={(v) => updateDraft({ status: v })}>
          <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Intervallo di tempo ───────────────────────────────────── */}
      <section>
        <h4 className="mb-3 text-sm font-semibold text-foreground">Imposta un intervallo di tempo</h4>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Attività</label>
            <Select
              value={timeFrame.activity || "none"}
              onValueChange={(v) => updateTimeFrame({ activity: v === "none" ? "" : v })}
            >
              <SelectTrigger className="h-10 w-full rounded-lg border-border text-sm">
                <SelectValue placeholder="Scegli un'attività" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Scegli un'attività</SelectItem>
                {TIME_ACTIVITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data da</label>
              <Input
                type="date"
                className="h-10 w-full"
                value={timeFrame.fromDate}
                onChange={(e) => updateTimeFrame({ fromDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data a</label>
              <Input
                type="date"
                className="h-10 w-full"
                value={timeFrame.toDate}
                onChange={(e) => updateTimeFrame({ toDate: e.target.value })}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onClearDates}
            disabled={!timeFrame.activity && !timeFrame.fromDate && !timeFrame.toDate}
          >
            <RotateCcw className="h-4 w-4" />
            Cancella le date
          </Button>
        </div>
      </section>

      {/* ── Cerca e seleziona i filtri ────────────────────────────── */}
      <section>
        <h4 className="mb-3 text-sm font-semibold text-foreground">Cerca e seleziona i filtri</h4>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9 pr-9 text-sm"
              placeholder="Cerca un filtro"
              value={filterSearch}
              onChange={(e) => updateDraft({ filterSearch: e.target.value })}
            />
            {filterSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => updateDraft({ filterSearch: "" })}
                aria-label="Cancella ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 shrink-0 text-muted-foreground"
            onClick={onClearFilters}
            disabled={!hasAnyFilter}
          >
            <RotateCcw className="h-4 w-4" />
            Cancella filtri
          </Button>
        </div>
        <Accordion>
          <AccordionItem
            title="Tag"
            open={openAccordion === 0}
            onOpenChange={(open) => setOpenAccordion(open ? 0 : null)}
          >
            <p className="text-xs text-muted-foreground">I filtri per tag saranno disponibili quando il backend li supporterà.</p>
          </AccordionItem>
          <AccordionItem
            title="Azioni"
            open={openAccordion === 1}
            onOpenChange={(open) => setOpenAccordion(open ? 1 : null)}
          >
            <p className="text-xs text-muted-foreground">I filtri per azioni saranno disponibili quando il backend li supporterà.</p>
          </AccordionItem>
          <AccordionItem
            title="Incaricati"
            open={openAccordion === 2}
            onOpenChange={(open) => setOpenAccordion(open ? 2 : null)}
          >
            <p className="text-xs text-muted-foreground">I filtri per incaricati saranno disponibili quando il backend li supporterà.</p>
          </AccordionItem>
          <AccordionItem
            title="Altre informazioni"
            open={openAccordion === 3}
            onOpenChange={(open) => setOpenAccordion(open ? 3 : null)}
          >
            <p className="text-xs text-muted-foreground">I filtri per altre informazioni saranno disponibili quando il backend li supporterà.</p>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}
