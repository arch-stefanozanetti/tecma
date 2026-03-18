import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings2,
  Upload,
  Download,
  ArrowLeftRight,
} from "lucide-react";
import { clientsApi } from "../../api/domains/clientsApi";
import type { AdditionalInfoRow, ClientRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { usePaginatedList } from "../shared/usePaginatedList";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { FiltersDrawer } from "../../components/ui/filters-drawer";
import type { ClientCreateInput } from "../../types/domain";
import { STATUS_FILTER_OPTIONS, TABLE_TYPE_OPTIONS, type ClientTableType } from "./constants";
import {
  ClientsFiltersDrawerContent,
  getDefaultFiltersDraft,
  type ClientsFiltersDraft,
  type TimeFrameDraft,
} from "./ClientsFiltersDrawerContent";
import { formatDate, statusLabel } from "./ClientsPage.utils";

const CLIENTS_PER_PAGE = 50;

type ClientFormMode = "create" | "edit";

export const ClientsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, projects } = useWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [showDetailMore, setShowDetailMore] = useState(false);
  const [otherOptionsOpen, setOtherOptionsOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<ClientsFiltersDraft>(getDefaultFiltersDraft);
  const [appliedTimeFrame, setAppliedTimeFrame] = useState<TimeFrameDraft>({ activity: "", fromDate: "", toDate: "" });
  const [tableType, setTableType] = useState<ClientTableType>("contacts");
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientFormMode, setClientFormMode] = useState<ClientFormMode>("create");
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState("lead");
  const [formProjectId, setFormProjectId] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formAdditionalInfo, setFormAdditionalInfo] = useState<Record<string, unknown>>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [additionalInfos, setAdditionalInfos] = useState<AdditionalInfoRow[]>([]);
  const otherOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceId) return;
    clientsApi
      .listAdditionalInfos(workspaceId)
      .then((r) => setAdditionalInfos(r.data ?? []))
      .catch(() => setAdditionalInfos([]));
  }, [workspaceId]);

  // Sincronizza draft filtri quando si apre il drawer
  useEffect(() => {
    if (filtersDrawerOpen) {
      setFiltersDraft({
        status: statusFilter,
        timeFrame: { ...appliedTimeFrame },
        filterSearch: "",
      });
    }
  }, [filtersDrawerOpen]);

  // Inizializza form quando si apre il dialog
  useEffect(() => {
    if (!clientFormOpen) return;
    setFormSubmitError(null);
    const customInfos = additionalInfos.filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo");
    if (clientFormMode === "edit" && editingClient) {
      setFormFullName(editingClient.fullName ?? "");
      setFormEmail(editingClient.email ?? "");
      setFormPhone(editingClient.phone ?? "");
      setFormStatus(editingClient.status ?? "lead");
      setFormCity(editingClient.city ?? "");
      setFormAdditionalInfo(
        customInfos.length > 0
          ? Object.fromEntries(customInfos.map((ai) => [ai.name, editingClient.additionalInfo?.[ai.name] ?? ""]))
          : editingClient.additionalInfo && typeof editingClient.additionalInfo === "object"
            ? { ...editingClient.additionalInfo }
            : {}
      );
    } else {
      setFormFullName("");
      setFormEmail("");
      setFormPhone("");
      setFormStatus("lead");
      setFormCity("");
      setFormProjectId(selectedProjectIds[0] ?? "");
      setFormAdditionalInfo(customInfos.length > 0 ? Object.fromEntries(customInfos.map((ai) => [ai.name, ""])) : {});
    }
  }, [clientFormOpen, clientFormMode, editingClient, selectedProjectIds, additionalInfos]);

  const handleOpenCreateClient = () => {
    setClientFormMode("create");
    setEditingClient(null);
    setClientFormOpen(true);
  };

  const handleOpenEditClient = (client: ClientRow) => {
    setEditingClient(client);
    setClientFormMode("edit");
    setSelectedClient(null);
    setClientFormOpen(true);
  };

  const handleClientFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    setFormSaving(true);
    try {
      const additionalInfoPayload = Object.keys(formAdditionalInfo).length > 0
        ? Object.fromEntries(Object.entries(formAdditionalInfo).filter(([, v]) => v != null && String(v).trim() !== ""))
        : undefined;
      if (clientFormMode === "edit" && editingClient) {
        const res = await clientsApi.updateClient(editingClient._id, {
          fullName: formFullName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          status: formStatus,
          city: formCity.trim() || undefined,
          additionalInfo: additionalInfoPayload,
        });
        refetch();
        setSelectedClient(res.client);
        setClientFormOpen(false);
      } else {
        if (!formProjectId || !workspaceId) {
          setFormSubmitError("Seleziona un progetto.");
          return;
        }
        await clientsApi.createClient({
          workspaceId,
          projectId: formProjectId,
          fullName: formFullName.trim(),
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          status: formStatus,
          city: formCity.trim() || undefined,
          additionalInfo: additionalInfoPayload,
        } as ClientCreateInput);
        refetch();
        setClientFormOpen(false);
      }
    } catch (err) {
      setFormSubmitError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setFormSaving(false);
    }
  };

  const filters = useMemo<Record<string, unknown>>(() => {
    const f: Record<string, unknown> = {};
    if (statusFilter !== "all") f.status = [statusFilter];
    if (appliedTimeFrame.activity && appliedTimeFrame.fromDate && appliedTimeFrame.toDate) {
      f.dateRange = [
        {
          field: appliedTimeFrame.activity,
          fromDate: appliedTimeFrame.fromDate,
          toDate: appliedTimeFrame.toDate,
        },
      ];
    }
    return f;
  }, [statusFilter, appliedTimeFrame]);

  const {
    data: clients,
    total,
    page,
    setPage,
    searchText: committedSearch,
    setSearchText: setCommittedSearch,
    isLoading,
    error,
    refetch,
  } = usePaginatedList<ClientRow>({
    loader: clientsApi.queryClients,
    workspaceId: workspaceId ?? "",
    projectIds: selectedProjectIds,
    defaultSortField: "updatedAt",
    defaultPerPage: CLIENTS_PER_PAGE,
    filters,
    enabled: !!(workspaceId && selectedProjectIds.length > 0),
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (otherOptionsRef.current && !otherOptionsRef.current.contains(e.target as Node)) {
        setOtherOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = () => {
    setCommittedSearch(search);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCommittedSearch("");
    setStatusFilter("all");
    setAppliedTimeFrame({ activity: "", fromDate: "", toDate: "" });
    setFiltersDraft(getDefaultFiltersDraft());
    setPage(1);
  };

  const handleApplyFilters = () => {
    setStatusFilter(filtersDraft.status);
    setAppliedTimeFrame({ ...filtersDraft.timeFrame });
    setPage(1);
  };

  const handleResetDrawerFilters = () => {
    setFiltersDraft(getDefaultFiltersDraft());
    setStatusFilter("all");
    setAppliedTimeFrame({ activity: "", fromDate: "", toDate: "" });
    setPage(1);
  };

  const handleClearDates = () => {
    setFiltersDraft((prev) => ({
      ...prev,
      timeFrame: { activity: "", fromDate: "", toDate: "" },
    }));
  };

  const handleClearDrawerFilters = () => {
    setFiltersDraft(getDefaultFiltersDraft());
  };

  const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PER_PAGE));
  const pageStart = total === 0 ? 0 : (page - 1) * CLIENTS_PER_PAGE + 1;
  const pageEnd = Math.min(total, page * CLIENTS_PER_PAGE);

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">

        {/* ── Page header ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">Clienti</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cerca e filtra per nome, email, telefono o stato. Clicca su un cliente per i dettagli.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button className="h-10 rounded-lg" onClick={handleOpenCreateClient}>
              <Plus className="h-4 w-4" />
              Aggiungi cliente
            </Button>

            {/* Other options dropdown */}
            <div className="relative" ref={otherOptionsRef}>
              <Button
                variant="outline"
                className="h-10 rounded-lg border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => setOtherOptionsOpen((v) => !v)}
              >
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
                    <button
                      key={label}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
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

        {/* ── Lista clienti ─────────────────────────────────────── */}
        <div className="mt-6">
          <div className="overflow-hidden rounded-ui border border-border bg-background shadow-panel">

            {/* Tipologia tabella + Ricerca e filtri */}
            <div className="rounded-t-ui border-b border-border px-4 py-4 lg:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-3">
                  <div className="w-full sm:w-[200px] shrink-0">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipologia tabella</label>
                    <Select value={tableType} onValueChange={(v) => { setTableType(v as ClientTableType); setPage(1); }}>
                      <SelectTrigger className="h-10 rounded-lg border-border text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Cerca</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-10 w-full rounded-lg border-border pl-10 text-sm shadow-none placeholder:text-muted-foreground"
                        placeholder="Nome, telefono o email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 gap-1.5 rounded-lg border-border px-3 text-sm text-foreground hover:bg-muted"
                      onClick={() => setFiltersDrawerOpen(true)}
                    >
                      <Filter className="h-4 w-4" />
                      Filtri
                    </Button>
                    <Button className="h-10 rounded-lg px-4" onClick={handleSearch}>
                      Cerca
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={handleResetFilters}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Azzera
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => refetch()}>
                    <RefreshCcw className="h-4 w-4" />
                    Aggiorna
                  </Button>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="border-b border-border bg-destructive/5 px-6 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Table */}
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
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        Loading clients...
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        {committedSearch ? "No results for this search" : "No clients found"}
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr
                        key={client._id}
                        role="button"
                        tabIndex={0}
                        className="group cursor-pointer border-b border-border text-sm text-foreground hover:bg-muted"
                        onClick={() => navigate(`/clients/${client._id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/clients/${client._id}`)}
                      >
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-40">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-left font-medium text-primary group-hover:underline">
                            {client.fullName}
                          </span>
                          {client.city && (
                            <div className="text-xs text-muted-foreground">{client.city}</div>
                          )}
                        </td>

                        {/* Created on */}
                        <td className="px-4 py-4 text-foreground">
                          {formatDate(client.createdAt)}
                        </td>

                        {/* Updated on */}
                        <td className="px-4 py-4 text-foreground">
                          {formatDate(client.updatedAt)}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-4">
                          {client.phone ?? "—"}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-4">
                          {client.email ?? "—"}
                        </td>

                        {/* Status — plain text, no badge */}
                        <td className="px-4 py-4">
                          {statusLabel(client.status)}
                        </td>

                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Altre opzioni"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <span className="text-sm text-muted-foreground">
                {total === 0 ? "Nessun cliente" : `${pageStart}–${pageEnd} di ${total} clienti`}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  aria-label="First page"
                >
                  <span className="text-xs">{"<<"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <span className="text-xs">{"<"}</span>
                </Button>
                <span className="px-2 text-sm text-foreground">
                  <strong>{page}</strong> / <strong>{totalPages}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <span className="text-xs">{">"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  aria-label="Last page"
                >
                  <span className="text-xs">{">>"}</span>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <FiltersDrawer
        open={filtersDrawerOpen}
        onOpenChange={setFiltersDrawerOpen}
        title="Intervallo di tempo e filtri"
        applyLabel="Salva"
        onApply={handleApplyFilters}
        onReset={handleResetDrawerFilters}
      >
        <ClientsFiltersDrawerContent
          draft={filtersDraft}
          onDraftChange={setFiltersDraft}
          onClearDates={handleClearDates}
          onClearFilters={handleClearDrawerFilters}
        />
      </FiltersDrawer>

      {/* Scheda dettaglio cliente (progressive disclosure) */}
      <Sheet
        open={selectedClient !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClient(null);
            setShowDetailMore(false);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          {selectedClient && (
            <>
              <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">
                {selectedClient.fullName || "Cliente"}
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium text-foreground">{selectedClient.email || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefono</span>
                  <p className="font-medium text-foreground">{selectedClient.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Città</span>
                  <p className="font-medium text-foreground">{selectedClient.city || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stato</span>
                  <p className="font-medium text-foreground">{statusLabel(selectedClient.status)}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex flex-col gap-3">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full rounded-lg gap-2"
                  onClick={() => navigate(`/clients/${selectedClient._id}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Apri scheda
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={() => handleOpenEditClient(selectedClient)}
                >
                  Modifica
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDetailMore((v) => !v)}
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded text-left"
                >
                  {showDetailMore ? "Mostra meno" : "Mostra altro"}
                </button>
                {showDetailMore && (
                  <div className="mt-0 space-y-2 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Creato il:</span> {formatDate(selectedClient.createdAt)}</p>
                    <p><span className="font-medium text-foreground">Aggiornato il:</span> {formatDate(selectedClient.updatedAt)}</p>
                    {selectedClient.source != null && <p><span className="font-medium text-foreground">Fonte:</span> {selectedClient.source}</p>}
                    {selectedClient.projectId != null && <p><span className="font-medium text-foreground">Progetto:</span> {selectedClient.projectId}</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Drawer Crea/Modifica cliente */}
      <Drawer open={clientFormOpen} onOpenChange={setClientFormOpen}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{clientFormMode === "edit" ? "Modifica cliente" : "Nuovo cliente"}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleClientFormSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
            {clientFormMode === "create" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Progetto</label>
                <Select value={formProjectId} onValueChange={setFormProjectId} required>
                  <SelectTrigger className="h-10 rounded-lg border-border">
                    <SelectValue placeholder="Seleziona progetto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects
                      .filter((p) => selectedProjectIds.includes(p.id))
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.displayName || p.name || p.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Nome *</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
                placeholder="Nome e cognome"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                className="h-10 rounded-lg border-border"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@esempio.it"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Telefono</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+39 ..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Città</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Città"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="h-10 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.filter((o) => o.value !== "all").map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {additionalInfos
              .filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo" && ai.active !== false)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((ai) => (
                <div key={ai._id}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {ai.label}
                    {ai.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  {ai.type === "radio" && ai.options && ai.options.length > 0 ? (
                    <Select
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onValueChange={(v) => setFormAdditionalInfo((prev) => ({ ...prev, [ai.name]: v }))}
                    >
                      <SelectTrigger className="h-10 rounded-lg border-border">
                        <SelectValue placeholder={`Seleziona ${ai.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {ai.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-10 rounded-lg border-border"
                      type={ai.type === "number" ? "number" : "text"}
                      value={String(formAdditionalInfo[ai.name] ?? "")}
                      onChange={(e) =>
                        setFormAdditionalInfo((prev) => ({
                          ...prev,
                          [ai.name]: ai.type === "number" ? (e.target.value ? Number(e.target.value) : "") : e.target.value,
                        }))
                      }
                      placeholder={ai.label}
                    />
                  )}
                </div>
              ))}
            {formSubmitError && (
              <p className="text-sm text-destructive">{formSubmitError}</p>
            )}
            </DrawerBody>
            <DrawerFooter>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setClientFormOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={formSaving}>
                  {formSaving ? "Salvataggio..." : clientFormMode === "edit" ? "Salva" : "Crea"}
                </Button>
              </div>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
