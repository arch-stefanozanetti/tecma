import { ExternalLink, Filter, MoreHorizontal, Plus, RefreshCcw, RotateCcw, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import type { RequestRow, RequestStatus } from "../../types/domain";
import { ALLOWED_NEXT_STATUSES, CLIENT_ROLE_LABEL, formatDate, KANBAN_STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type ViewMode } from "./requestsPageConstants";

interface RequestsBoardSectionProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenNewRequest: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  error: string | null;
  isLoading: boolean;
  requests: RequestRow[];
  committedSearch: string;
  statusChangingId: string | null;
  onStatusChange: (requestId: string, status: RequestStatus) => void;
  onSelectRequest: (request: RequestRow) => void;
  requestsByStatus: Map<RequestStatus, RequestRow[]>;
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

export const RequestsBoardSection = ({
  viewMode,
  onViewModeChange,
  onOpenNewRequest,
  search,
  onSearchChange,
  onSearch,
  onOpenFilters,
  onResetFilters,
  onRefresh,
  error,
  isLoading,
  requests,
  committedSearch,
  statusChangingId,
  onStatusChange,
  onSelectRequest,
  requestsByStatus,
  total,
  page,
  totalPages,
  pageStart,
  pageEnd,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
}: RequestsBoardSectionProps) => {
  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Trattative</h1>
          <p className="mt-1 text-sm text-muted-foreground">Richieste e trattative (affitto e vendita). Clicca su una riga o su una card per i dettagli.</p>
        </div>
        <Button className="h-10 rounded-lg" onClick={onOpenNewRequest}>
          <Plus className="h-4 w-4" />
          Nuova trattativa
        </Button>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)} className="mt-6">
        <TabsList className="h-auto w-auto border-b border-border bg-transparent p-0">
          <TabsTrigger value="table" className="rounded-t-lg">Lista</TabsTrigger>
          <TabsTrigger value="kanban" className="rounded-t-lg">Kanban</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        <div className="overflow-hidden rounded-ui border border-border bg-background shadow-panel">
          <div className="rounded-t-ui border-b border-border px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-wrap items-end gap-3">
                <div className="relative min-w-[200px] max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-10 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground" placeholder="Cerca per ID cliente..." value={search} onChange={(e) => onSearchChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch()} />
                </div>
                <Button variant="outline" className="h-10 gap-1.5 rounded-lg border-border px-3 text-sm text-foreground hover:bg-muted" onClick={onOpenFilters}>
                  <Filter className="h-4 w-4" />
                  Filtri
                </Button>
                <Button variant="outline" className="h-10 rounded-lg border-border px-4 text-sm font-medium hover:bg-muted" onClick={onSearch}>Cerca</Button>
                <Button variant="ghost" className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onResetFilters}>
                  <RotateCcw className="h-4 w-4" />
                  Azzera
                </Button>
              </div>
              <Button variant="outline" className="h-10 shrink-0 rounded-lg border-border px-3 text-sm hover:bg-muted" onClick={onRefresh}>
                <RefreshCcw className="h-4 w-4" />
                Aggiorna
              </Button>
            </div>
          </div>

          {error && <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">{error}</div>}

          {viewMode === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                    <th className="w-10 px-4 py-4 font-normal" />
                    <th className="px-4 py-4 font-normal">Cliente</th>
                    <th className="px-4 py-4 font-normal">Appartamento</th>
                    <th className="px-4 py-4 font-normal">Tipo</th>
                    <th className="px-4 py-4 font-normal">Ruolo</th>
                    <th className="px-4 py-4 font-normal">Stato</th>
                    <th className="px-4 py-4 font-normal">Aggiornato il</th>
                    <th className="w-10 px-4 py-4 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && requests.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">Caricamento...</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">{committedSearch ? "Nessun risultato" : "Nessuna trattativa trovata"}</td></tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req._id} role="button" tabIndex={0} onClick={() => onSelectRequest(req)} onKeyDown={(e) => e.key === "Enter" && onSelectRequest(req)} className="border-b border-border text-sm text-foreground hover:bg-muted cursor-pointer">
                        <td className="px-4 py-4">
                          <button type="button" className="inline-flex h-6 w-6 items-center justify-center text-primary opacity-50 hover:opacity-100" aria-label="Apri dettaglio" onClick={(e) => { e.stopPropagation(); onSelectRequest(req); }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-4 text-foreground">{req.clientName ?? req.clientId}</td>
                        <td className="px-4 py-4 text-muted-foreground">{req.apartmentCode ?? req.apartmentId ?? "—"}</td>
                        <td className="px-4 py-4">{TYPE_LABEL[req.type]}</td>
                        <td className="px-4 py-4 text-muted-foreground">{req.clientRole ? CLIENT_ROLE_LABEL[req.clientRole] : "—"}</td>
                        <td className="px-4 py-4">
                          <Select value={req.status} onValueChange={(v) => onStatusChange(req._id, v as RequestStatus)} disabled={statusChangingId === req._id}>
                            <SelectTrigger className="h-8 w-[140px] rounded-lg border-border text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={req.status}>{STATUS_LABEL[req.status]}</SelectItem>
                              {(ALLOWED_NEXT_STATUSES[req.status] ?? []).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-4">{formatDate(req.updatedAt)}</td>
                        <td className="px-4 py-4"><button type="button" className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-0 hover:opacity-100" aria-label="Altro"><MoreHorizontal className="h-4 w-4" /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="overflow-x-auto p-4">
              <div className="flex min-h-[400px] gap-4">
                {KANBAN_STATUS_ORDER.map((status) => {
                  const items = requestsByStatus.get(status) ?? [];
                  return (
                    <div key={status} className="flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-sm font-semibold text-foreground">{STATUS_LABEL[status]}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                      </div>
                      <div className="flex-1 space-y-2 overflow-y-auto p-2">
                        {items.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Nessuna</p>
                        ) : (
                          items.map((req) => (
                            <button key={req._id} type="button" onClick={() => onSelectRequest(req)} className={cn("w-full rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm", "hover:border-primary/50 hover:bg-muted/50 transition-colors")}>
                              <div className="truncate font-medium text-foreground">{req.clientName ?? req.clientId}</div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-foreground">{TYPE_LABEL[req.type]}</span>
                                <span className="text-[10px] text-muted-foreground">{formatDate(req.updatedAt)}</span>
                              </div>
                              {(req.apartmentCode ?? req.apartmentId) && <div className="mt-1 truncate text-[10px] text-muted-foreground">Apt: {req.apartmentCode ?? req.apartmentId}</div>}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 lg:px-6">
            <span className="text-sm text-muted-foreground">{total === 0 ? "Nessuna trattativa" : `${pageStart}–${pageEnd} di ${total}`}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onFirstPage} disabled={page === 1} aria-label="Prima pagina"><span className="text-xs">{"<<"}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onPrevPage} disabled={page === 1} aria-label="Precedente"><span className="text-xs">{"<"}</span></Button>
              <span className="px-2 text-sm"><strong>{page}</strong> / <strong>{totalPages}</strong></span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onNextPage} disabled={page === totalPages} aria-label="Successiva"><span className="text-xs">{">"}</span></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onLastPage} disabled={page === totalPages} aria-label="Ultima pagina"><span className="text-xs">{">>"}</span></Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
