import {
  ArrowLeftRight,
  Download,
  Euro,
  ExternalLink,
  Filter,
  KeyRound,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import type { ApartmentRow } from "../../types/domain";
import { useIsMobile } from "../shared/useIsMobile";
import { availabilityInfo, formatDate, MODE_TABS, pseudoFloor, roomLabel, statusInfo, type ModeFilter } from "./ApartmentsPage.utils";

const RENT_PIPELINE_STATUS_LABEL: Record<string, string> = {
  new: "Nuova",
  contacted: "Contattato",
  viewing: "Visita",
  quote: "Preventivo",
  offer: "Offerta",
};

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
  /** Gate JWT: apartments.create */
  createApartmentDisabled?: boolean;
  createApartmentTitle?: string;
  /** Gate JWT: apartments.update (import) */
  importExcelDisabled?: boolean;
  importExcelTitle?: string;
  /** Gate JWT: apartments.export */
  exportExcelDisabled?: boolean;
  exportExcelTitle?: string;
  /** Se true, mostra la colonna progetto (utile con più progetti in scope). */
  showProjectColumn?: boolean;
  /** Risolve projectId → nome visualizzato. */
  projectNameById: (projectId: string) => string;
  /** Tab secondarie Lista | Calendario (solo affitto + contesto rent). */
  showRentAvailabilityTabs?: boolean;
  apartmentsViewTab?: "list" | "calendar";
  onApartmentsViewTabChange?: (tab: "list" | "calendar") => void;
  /** Contenuto calendario (matrice) quando tab Calendario è attiva. */
  rentCalendarSlot?: ReactNode;
  /** Badge trattativa affitto aperta per apartmentId (da GET rent-open-request-badges). */
  rentOpenBadges?: Record<string, { requestId: string; status: string; clientLabel?: string }>;
  onRentBadgeClick?: (requestId: string) => void;
  canReadRequests?: boolean;
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
  createApartmentDisabled = false,
  createApartmentTitle,
  importExcelDisabled = false,
  importExcelTitle,
  exportExcelDisabled = false,
  exportExcelTitle,
  showProjectColumn = false,
  projectNameById,
  showRentAvailabilityTabs = false,
  apartmentsViewTab = "list",
  onApartmentsViewTabChange,
  rentCalendarSlot,
  rentOpenBadges,
  onRentBadgeClick,
  canReadRequests = false,
}: ApartmentsListSectionProps) => {
  const isMobile = useIsMobile();
  const tableColSpan = showProjectColumn ? 12 : 11;
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
          <Button
            className="min-h-11 rounded-lg px-4 text-sm font-medium"
            onClick={() => onOpenApartment("create")}
            disabled={createApartmentDisabled}
            title={createApartmentTitle}
          >
            Crea appartamento
          </Button>
          <Button variant="outline" className="min-h-11 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted">
            Verifica dati
          </Button>

          <div className="relative" ref={otherOptionsRef}>
            <Button
              variant="outline"
              className="min-h-11 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
              onClick={onToggleOtherOptions}
            >
              Altro
              <span className={cn("ml-1 inline-block text-xs transition-transform", otherOptionsOpen && "rotate-180")}>▾</span>
            </Button>
            {otherOptionsOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-ui border border-border bg-background shadow-dropdown">
                {[
                  { icon: Upload, label: "Importa Excel", disabled: importExcelDisabled, title: importExcelTitle },
                  { icon: Download, label: "Esporta Excel", disabled: exportExcelDisabled, title: exportExcelTitle },
                  { icon: ArrowLeftRight, label: "Vai alla vecchia interfaccia" },
                ].map(({ icon: Icon, label, disabled, title }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    title={title}
                    className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
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

      {showRentAvailabilityTabs && onApartmentsViewTabChange && (
        <div
          className="mt-4 inline-flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
          role="tablist"
          aria-label="Vista appartamenti affitto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={apartmentsViewTab === "list"}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              apartmentsViewTab === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onApartmentsViewTabChange("list")}
          >
            Lista
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={apartmentsViewTab === "calendar"}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              apartmentsViewTab === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onApartmentsViewTabChange("calendar")}
          >
            Calendario disponibilità
          </button>
        </div>
      )}

      <div className="mt-6">
        {apartmentsViewTab === "calendar" && showRentAvailabilityTabs ? (
          <div className="overflow-hidden rounded-ui border border-border bg-background p-4 shadow-panel lg:p-6">
            {rentCalendarSlot}
          </div>
        ) : (
          <>
        <h2 className="mb-4 text-base font-semibold text-foreground">Elenco appartamenti</h2>

        <div className="overflow-hidden rounded-ui border border-border bg-background shadow-panel">
          <div className="rounded-t-ui border-b border-border px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="min-h-11 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground"
                  placeholder="Cerca per codice o nome..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSubmitSearch()}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="min-h-11 gap-1.5 rounded-lg border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted" onClick={onOpenFilters}>
                  <Filter className="h-4 w-4" />
                  Filtri
                </Button>
                <Button variant="outline" className="min-h-11 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted" onClick={onSubmitSearch}>
                  Cerca
                </Button>
                <Button variant="ghost" className="min-h-11 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onResetFilters}>
                  <RotateCcw className="h-4 w-4" />
                  Azzera
                </Button>
                <Button variant="outline" className="min-h-11 rounded-lg border-border bg-background px-3 text-sm text-foreground hover:bg-muted" onClick={onRefresh}>
                  <RefreshCcw className="h-4 w-4" />
                  Aggiorna
                </Button>
              </div>
            </div>
          </div>

          {error && <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>}

          {/* Vista card su mobile (viewport <768px) */}
          <div className="md:hidden p-4 space-y-3">
            {isLoading && apartments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Caricamento...</p>
            ) : apartments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{committedSearch ? "Nessun risultato per questa ricerca" : "Nessun appartamento trovato"}</p>
            ) : (
              apartments.map((apt) => {
                const availability = availabilityInfo(apt.status);
                const status = statusInfo(apt);
                return (
                  <button
                    key={apt._id}
                    type="button"
                    onClick={() => onOpenApartment(apt._id)}
                    className="glass-panel rounded-ui w-full border border-border bg-card p-4 text-left shadow-panel transition-colors hover:bg-muted/50 min-h-11"
                  >
                    <div className="font-medium text-foreground">{apt.code}</div>
                    {apt.name && apt.name !== apt.code && <div className="mt-0.5 truncate text-sm text-muted-foreground">{apt.name}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title={apt.mode === "RENT" ? "Affitto" : "Vendita"}>
                        {apt.mode === "RENT" ? <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <Euro className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        <span className="sr-only">{apt.mode === "RENT" ? "Affitto" : "Vendita"}</span>
                      </span>
                      {showProjectColumn && (
                        <span className="truncate max-w-[min(100%,12rem)]" title={projectNameById(apt.projectId)}>
                          {projectNameById(apt.projectId)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{apt.normalizedPrice?.display ?? "—"}</span>
                      <span className={cn("text-xs", availability.className)}>{availability.label}</span>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden />
                        {status.label}
                      </span>
                    </div>
                    {showRentAvailabilityTabs && apt.mode === "RENT" && rentOpenBadges?.[apt._id] && onRentBadgeClick && canReadRequests && (
                      <button
                        type="button"
                        className="mt-2 w-full truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-left text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                        title={rentOpenBadges[apt._id].clientLabel ?? "Apri trattativa"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRentBadgeClick(rentOpenBadges[apt._id].requestId);
                        }}
                      >
                        Trattativa: {RENT_PIPELINE_STATUS_LABEL[rentOpenBadges[apt._id].status] ?? rentOpenBadges[apt._id].status}
                      </button>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                  <th className="w-10 px-4 py-4 font-normal" />
                  <th className="w-11 px-2 py-4 text-center font-normal" title="Vendita o affitto">
                    <span className="sr-only">Modalità</span>
                  </th>
                  {showProjectColumn && <th className="max-w-[160px] px-3 py-4 font-normal">Progetto</th>}
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
                  <tr><td colSpan={tableColSpan} className="px-4 py-16 text-center text-sm text-muted-foreground">Caricamento...</td></tr>
                ) : apartments.length === 0 ? (
                  <tr><td colSpan={tableColSpan} className="px-4 py-16 text-center text-sm text-muted-foreground">{committedSearch ? "Nessun risultato per questa ricerca" : "Nessun appartamento trovato"}</td></tr>
                ) : (
                  apartments.map((apt) => {
                    const availability = availabilityInfo(apt.status);
                    const status = statusInfo(apt);
                    return (
                      <tr key={apt._id} role="button" tabIndex={0} onClick={() => onOpenApartment(apt._id)} onKeyDown={(e) => e.key === "Enter" && onOpenApartment(apt._id)} className="group border-b border-border text-sm text-foreground hover:bg-muted cursor-pointer">
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center text-primary opacity-50 transition-opacity hover:opacity-100" aria-label="Apri scheda appartamento" onClick={() => onOpenApartment(apt._id)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="w-11 px-2 py-4 text-center align-middle">
                          <span
                            className="inline-flex items-center justify-center text-muted-foreground"
                            title={apt.mode === "RENT" ? "Affitto" : "Vendita"}
                            aria-label={apt.mode === "RENT" ? "Affitto" : "Vendita"}
                          >
                            {apt.mode === "RENT" ? <KeyRound className="h-3.5 w-3.5" /> : <Euro className="h-3.5 w-3.5" />}
                          </span>
                        </td>
                        {showProjectColumn && (
                          <td className="max-w-[160px] px-3 py-4 align-middle">
                            <span className="block truncate text-xs text-muted-foreground" title={projectNameById(apt.projectId)}>
                              {projectNameById(apt.projectId)}
                            </span>
                          </td>
                        )}
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
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />
                              {status.label}
                            </span>
                            {showRentAvailabilityTabs && apt.mode === "RENT" && rentOpenBadges?.[apt._id] && onRentBadgeClick && canReadRequests && (
                              <button
                                type="button"
                                className="w-fit max-w-full truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-left text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                                title={rentOpenBadges[apt._id].clientLabel ?? "Apri trattativa"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRentBadgeClick(rentOpenBadges[apt._id].requestId);
                                }}
                              >
                                Trattativa: {RENT_PIPELINE_STATUS_LABEL[rentOpenBadges[apt._id].status] ?? rentOpenBadges[apt._id].status}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4"><button type="button" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></button></td>
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
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-lg text-foreground hover:bg-muted" onClick={onFirstPage} disabled={page === 1} aria-label="First page"><span className="text-xs font-bold">{`«`}</span></Button>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-lg text-foreground hover:bg-muted" onClick={onPrevPage} disabled={page === 1} aria-label="Previous page"><span className="text-xs font-bold">{`‹`}</span></Button>
              <div className="px-2 text-sm text-foreground"><strong>{page}</strong> / <strong>{totalPages}</strong></div>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-lg text-foreground hover:bg-muted" onClick={onNextPage} disabled={page === totalPages} aria-label="Next page"><span className="text-xs font-bold">{`›`}</span></Button>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-lg text-foreground hover:bg-muted" onClick={onLastPage} disabled={page === totalPages} aria-label="Last page"><span className="text-xs font-bold">{`»`}</span></Button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </>
  );
};
