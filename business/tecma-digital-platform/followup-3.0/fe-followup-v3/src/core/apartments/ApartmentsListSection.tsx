import { ArrowLeftRight, Download, ExternalLink, Filter, MoreHorizontal, RefreshCcw, RotateCcw, Search, Upload } from "lucide-react";
import type { MutableRefObject } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import type { ApartmentRow } from "../../types/domain";
import { availabilityInfo, formatDate, MODE_TABS, pseudoFloor, roomLabel, statusInfo, type ModeFilter } from "./ApartmentsPage.utils";

interface ApartmentsListSectionProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSubmitSearch: () => void;
  onResetFilters: () => void;
  onOpenFilters: () => void;
  onRefresh: () => void;
  error: string | null;
  isLoading: boolean;
  apartments: ApartmentRow[];
  committedSearch: string;
  onOpenApartment: (id: string) => void;
  total: number;
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  modeFilter: ModeFilter;
  onModeChange: (value: ModeFilter) => void;
  otherOptionsOpen: boolean;
  onToggleOtherOptions: () => void;
  onOpenImportExcel: () => void;
  otherOptionsRef: MutableRefObject<HTMLDivElement | null>;
}

export const ApartmentsListSection = ({
  search,
  onSearchChange,
  onSubmitSearch,
  onResetFilters,
  onOpenFilters,
  onRefresh,
  error,
  isLoading,
  apartments,
  committedSearch,
  onOpenApartment,
  total,
  page,
  totalPages,
  pageStart,
  pageEnd,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
  modeFilter,
  onModeChange,
  otherOptionsOpen,
  onToggleOtherOptions,
  onOpenImportExcel,
  otherOptionsRef,
}: ApartmentsListSectionProps) => {
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-normal text-muted-foreground">Appartamenti</h1>
          <p className="mt-1 text-sm font-semibold leading-snug text-card-foreground">
            Cerca e filtra per codice, nome o stato. Clicca su un appartamento per i dettagli.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button className="h-10 rounded-lg px-4 text-sm font-medium" onClick={() => onOpenApartment("create")}>Crea appartamento</Button>
          <Button variant="outline" className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted">
            Verifica dati
          </Button>

          <div className="relative" ref={otherOptionsRef}>
            <Button
              variant="outline"
              className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
              onClick={onToggleOtherOptions}
            >
              Altro
              <span className={cn("ml-1 inline-block text-xs transition-transform", otherOptionsOpen && "rotate-180")}>▾</span>
            </Button>
            {otherOptionsOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-ui border border-border bg-background shadow-dropdown">
                {[
                  { icon: Upload, label: "Importa Excel" },
                  { icon: Download, label: "Esporta Excel" },
                  { icon: ArrowLeftRight, label: "Vai alla vecchia interfaccia" },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                    onClick={() => {
                      if (label === "Importa Excel") onOpenImportExcel();
                    }}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs value={modeFilter} onValueChange={(v: string) => onModeChange(v as ModeFilter)} className="mt-6">
        <TabsList className="h-auto w-auto border-b border-border bg-transparent p-0">
          {MODE_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-t-lg">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Elenco appartamenti</h2>

        <div className="overflow-hidden rounded-ui border border-border bg-background shadow-panel">
          <div className="rounded-t-ui border-b border-border px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground"
                  placeholder="Cerca per codice o nome..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSubmitSearch()}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-10 gap-1.5 rounded-lg border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted" onClick={onOpenFilters}>
                  <Filter className="h-4 w-4" />
                  Filtri
                </Button>
                <Button variant="outline" className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted" onClick={onSubmitSearch}>
                  Cerca
                </Button>
                <Button variant="ghost" className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onResetFilters}>
                  <RotateCcw className="h-4 w-4" />
                  Azzera
                </Button>
                <Button variant="outline" className="h-10 rounded-lg border-border bg-background px-3 text-sm text-foreground hover:bg-muted" onClick={onRefresh}>
                  <RefreshCcw className="h-4 w-4" />
                  Aggiorna
                </Button>
              </div>
            </div>
          </div>

          {error && <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                  <th className="w-10 px-4 py-4 font-normal" />
                  <th className="px-4 py-4 font-normal">Appartamento</th>
                  <th className="px-4 py-4 font-normal">Aggiornato il</th>
                  <th className="px-4 py-4 font-normal">Tipologia</th>
                  <th className="px-4 py-4 font-normal"><span className="block">Superficie</span><span className="text-[10px] leading-3 text-muted-foreground">mq</span></th>
                  <th className="px-4 py-4 font-normal">Piano</th>
                  <th className="px-4 py-4 font-normal">Prezzo</th>
                  <th className="px-4 py-4 font-normal">Disponibilità</th>
                  <th className="px-4 py-4 font-normal">Stato</th>
                  <th className="w-10 px-4 py-4 font-normal" />
                </tr>
              </thead>
              <tbody>
                {isLoading && apartments.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-sm text-muted-foreground">Caricamento...</td></tr>
                ) : apartments.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-sm text-muted-foreground">{committedSearch ? "Nessun risultato per questa ricerca" : "Nessun appartamento trovato"}</td></tr>
                ) : (
                  apartments.map((apt) => {
                    const availability = availabilityInfo(apt.status);
                    const status = statusInfo(apt);
                    return (
                      <tr key={apt._id} role="button" tabIndex={0} onClick={() => onOpenApartment(apt._id)} onKeyDown={(e) => e.key === "Enter" && onOpenApartment(apt._id)} className="group border-b border-border text-sm text-foreground hover:bg-muted cursor-pointer">
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="inline-flex h-6 w-6 items-center justify-center text-primary opacity-50 transition-opacity hover:opacity-100" aria-label="Apri scheda appartamento" onClick={() => onOpenApartment(apt._id)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <button type="button" className="text-left font-normal text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onOpenApartment(apt._id); }}>
                            {apt.code}
                          </button>
                          {apt.name && apt.name !== apt.code && <div className="text-xs text-muted-foreground">{apt.name}</div>}
                        </td>
                        <td className="px-4 py-4">{formatDate(apt.updatedAt)}</td>
                        <td className="px-4 py-4">{roomLabel(apt.surfaceMq)}</td>
                        <td className="px-4 py-4">{apt.surfaceMq}</td>
                        <td className="px-4 py-4">{pseudoFloor(apt.code)}</td>
                        <td className="px-4 py-4">{apt.normalizedPrice?.display ?? "—"}</td>
                        <td className="px-4 py-4"><span className={cn("text-sm", availability.className)}>{availability.label}</span></td>
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />{status.label}</span></td>
                        <td className="px-4 py-4"><button type="button" className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <span className="text-sm text-muted-foreground">{total === 0 ? "Nessun appartamento" : `${pageStart}–${pageEnd} di ${total} appartamenti`}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onFirstPage} disabled={page === 1} aria-label="First page"><span className="text-xs font-bold">{`«`}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onPrevPage} disabled={page === 1} aria-label="Previous page"><span className="text-xs font-bold">{`‹`}</span></Button>
              <div className="px-2 text-sm text-foreground"><strong>{page}</strong> / <strong>{totalPages}</strong></div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onNextPage} disabled={page === totalPages} aria-label="Next page"><span className="text-xs font-bold">{`›`}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onLastPage} disabled={page === totalPages} aria-label="Last page"><span className="text-xs font-bold">{`»`}</span></Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
