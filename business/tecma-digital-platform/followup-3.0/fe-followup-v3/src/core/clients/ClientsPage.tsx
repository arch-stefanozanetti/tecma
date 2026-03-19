import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
} from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type { AdditionalInfoRow, ClientRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { useIsMobile } from "../shared/useIsMobile";
import { usePaginatedList } from "../shared/usePaginatedList";
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
import { STATUS_FILTER_OPTIONS, type ClientTableType } from "./constants";
import {
  ClientsFiltersDrawerContent,
  getDefaultFiltersDraft,
  type ClientsFiltersDraft,
  type TimeFrameDraft,
} from "./ClientsFiltersDrawerContent";
import { clientDisplayName, formatDate, statusLabel } from "./ClientsPage.utils";
import { ClientsListSection } from "./ClientsListSection";

const CLIENTS_PER_PAGE = 50;

type ClientFormMode = "create" | "edit";

export const ClientsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
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
    followupApi.clients
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
      setFormFirstName(editingClient.firstName ?? "");
      setFormLastName(editingClient.lastName ?? "");
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
      setFormFirstName("");
      setFormLastName("");
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
        const res = await followupApi.clients.updateClient(editingClient._id, {
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
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
        await followupApi.clients.createClient({
          workspaceId,
          projectId: formProjectId,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
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
    loader: followupApi.clients.queryClients,
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
        <ClientsListSection
          onOpenCreateClient={handleOpenCreateClient}
          otherOptionsOpen={otherOptionsOpen}
          onToggleOtherOptions={() => setOtherOptionsOpen((v) => !v)}
          otherOptionsRef={otherOptionsRef}
          tableType={tableType}
          onTableTypeChange={(value) => {
            setTableType(value);
            setPage(1);
          }}
          search={search}
          onSearchChange={setSearch}
          onSearch={handleSearch}
          onOpenFilters={() => setFiltersDrawerOpen(true)}
          onResetFilters={handleResetFilters}
          onRefresh={() => refetch()}
          error={error}
          isLoading={isLoading}
          clients={clients}
          committedSearch={committedSearch}
          onOpenClient={(id) => navigate(`/clients/${id}`)}
          total={total}
          page={page}
          totalPages={totalPages}
          pageStart={pageStart}
          pageEnd={pageEnd}
          onFirstPage={() => setPage(1)}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
          onLastPage={() => setPage(totalPages)}
        />
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
                {(() => {
                  const dn = clientDisplayName(selectedClient);
                  return dn !== "—" ? dn : "Cliente";
                })()}
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
        <DrawerContent side="right" size={isMobile ? "full" : "md"}>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{clientFormMode === "edit" ? "Modifica cliente" : "Nuovo cliente"}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleClientFormSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
            {clientFormMode === "create" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Progetto</label>
                <Select value={formProjectId} onValueChange={setFormProjectId} required>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
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
                className="min-h-11 rounded-lg border-border"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                required
                placeholder="Nome"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Cognome *</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                required
                placeholder="Cognome"
                autoComplete="family-name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                className="min-h-11 rounded-lg border-border"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@esempio.it"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Telefono</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+39 ..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Città</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Città"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="min-h-11 rounded-lg border-border">
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
                      <SelectTrigger className="min-h-11 rounded-lg border-border">
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
                      className="min-h-11 rounded-lg border-border"
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
                <Button type="button" variant="outline" onClick={() => setClientFormOpen(false)} className="min-h-11">
                  Annulla
                </Button>
                <Button type="submit" disabled={formSaving} className="min-h-11">
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
