import { ArrowLeftRight, ChevronDown, Download, ExternalLink, Filter, MoreHorizontal, RefreshCcw, RotateCcw, Search, Upload } from "lucide-react";
import type { MutableRefObject } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { cn } from "../../lib/utils";
import type { ClientRow } from "../../types/domain";
import { TABLE_TYPE_OPTIONS, type ClientTableType } from "./constants";
import { formatDate, statusLabel } from "./ClientsPage.utils";

interface ClientsListSectionProps {
  onOpenCreateClient: () => void;
  otherOptionsOpen: boolean;
  onToggleOtherOptions: () => void;
  otherOptionsRef: MutableRefObject<HTMLDivElement | null>;
  tableType: ClientTableType;
  onTableTypeChange: (value: ClientTableType) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  error: string | null;
  isLoading: boolean;
  clients: ClientRow[];
  committedSearch: string;
  onOpenClient: (id: string) => void;
  total: number;
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
}

export const ClientsListSection = ({
  onOpenCreateClient,
  otherOptionsOpen,
  onToggleOtherOptions,
  otherOptionsRef,
  tableType,
  onTableTypeChange,
  search,
  onSearchChange,
  onSearch,
  onOpenFilters,
  onResetFilters,
  onRefresh,
  error,
  isLoading,
  clients,
  committedSearch,
  onOpenClient,
  total,
  page,
  totalPages,
  pageStart,
  pageEnd,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
}: ClientsListSectionProps) => {
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Clienti</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cerca e filtra per nome, email, telefono o stato. Clicca su un cliente per i dettagli.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button className="h-10 rounded-lg" onClick={onOpenCreateClient}>
            Aggiungi cliente
          </Button>

          <div className="relative" ref={otherOptionsRef}>
            <Button variant="outline" className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted" onClick={onToggleOtherOptions}>
              Altro
              <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", otherOptionsOpen && "rotate-180")} />
            </Button>
            {otherOptionsOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-ui border border-border bg-background shadow-dropdown">
                {[
                  { icon: Upload, label: "Importa Excel" },
                  { icon: Download, label: "Esporta Excel" },
                  { icon: ArrowLeftRight, label: "Vai alla vecchia interfaccia" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} type="button" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="overflow-hidden rounded-ui border border-border bg-background shadow-panel">
          <div className="rounded-t-ui border-b border-border px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-3">
                <div className="w-full shrink-0 sm:w-[200px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipologia tabella</label>
                  <Select value={tableType} onValueChange={(v) => onTableTypeChange(v as ClientTableType)}>
                    <SelectTrigger className="h-10 rounded-lg border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TABLE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Cerca</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-10 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground" placeholder="Nome, telefono o email..." value={search} onChange={(e) => onSearchChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-10 gap-1.5 rounded-lg border-border px-3 text-sm text-foreground hover:bg-muted" onClick={onOpenFilters}>
                    <Filter className="h-4 w-4" />
                    Filtri
                  </Button>
                  <Button className="h-10 rounded-lg px-4" onClick={onSearch}>Cerca</Button>
                  <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onResetFilters}>
                    <RotateCcw className="h-4 w-4" />
                    Azzera
                  </Button>
                </div>
              </div>
              <div className="shrink-0">
                <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={onRefresh}>
                  <RefreshCcw className="h-4 w-4" />
                  Aggiorna
                </Button>
              </div>
            </div>
          </div>

          {error && <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                  <th className="w-10 px-4 py-4 font-normal" />
                  <th className="px-4 py-4 font-normal">Nome</th>
                  <th className="px-4 py-4 font-normal">Creato il</th>
                  <th className="px-4 py-4 font-normal">Aggiornato il</th>
                  <th className="px-4 py-4 font-normal">Telefono</th>
                  <th className="px-4 py-4 font-normal">Email</th>
                  <th className="px-4 py-4 font-normal">Stato</th>
                  <th className="w-10 px-4 py-4 font-normal" />
                </tr>
              </thead>
              <tbody>
                {isLoading && clients.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">Loading clients...</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">{committedSearch ? "No results for this search" : "No clients found"}</td></tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client._id} role="button" tabIndex={0} className="group cursor-pointer border-b border-border text-sm text-foreground hover:bg-muted" onClick={() => onOpenClient(client._id)} onKeyDown={(e) => e.key === "Enter" && onOpenClient(client._id)}>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}><span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-40"><ExternalLink className="h-3.5 w-3.5" /></span></td>
                      <td className="px-4 py-4"><span className="text-left font-medium text-primary group-hover:underline">{client.fullName}</span>{client.city && <div className="text-xs text-muted-foreground">{client.city}</div>}</td>
                      <td className="px-4 py-4 text-foreground">{formatDate(client.createdAt)}</td>
                      <td className="px-4 py-4 text-foreground">{formatDate(client.updatedAt)}</td>
                      <td className="px-4 py-4">{client.phone ?? "—"}</td>
                      <td className="px-4 py-4">{client.email ?? "—"}</td>
                      <td className="px-4 py-4">{statusLabel(client.status)}</td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}><button type="button" className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-label="Altre opzioni"><MoreHorizontal className="h-4 w-4" /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <span className="text-sm text-muted-foreground">{total === 0 ? "Nessun cliente" : `${pageStart}–${pageEnd} di ${total} clienti`}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onFirstPage} disabled={page === 1} aria-label="First page"><span className="text-xs">{"<<"}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onPrevPage} disabled={page === 1} aria-label="Previous page"><span className="text-xs">{"<"}</span></Button>
              <span className="px-2 text-sm text-foreground"><strong>{page}</strong> / <strong>{totalPages}</strong></span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onNextPage} disabled={page === totalPages} aria-label="Next page"><span className="text-xs">{">"}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-foreground hover:bg-muted" onClick={onLastPage} disabled={page === totalPages} aria-label="Last page"><span className="text-xs">{">>"}</span></Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
