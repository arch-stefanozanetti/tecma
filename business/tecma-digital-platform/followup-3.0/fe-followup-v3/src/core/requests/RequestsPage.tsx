import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Link2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import type {
  RequestRow,
  RequestStatus,
  RequestType,
  ClientRole,
  RequestTransitionRow,
  RequestActionRow,
} from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { useIsMobile } from "../shared/useIsMobile";
import { usePaginatedList } from "../shared/usePaginatedList";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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
import { useToast } from "../../contexts/ToastContext";
import {
  TYPE_LABEL,
  STATUS_LABEL,
  CLIENT_ROLE_LABEL,
  KANBAN_STATUS_ORDER,
  TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  ACTION_TYPE_LABEL,
  formatDate,
  REQUESTS_PER_PAGE,
  type ViewMode,
} from "./requestsPageConstants";
import { RequestsActionDrawer } from "./RequestsActionDrawer";
import { RequestsBoardSection } from "./RequestsBoardSection";

const permTitle = (id: string) => `Permesso richiesto: ${id}`;

export const RequestsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { workspaceId, selectedProjectIds, hasPermission } = useWorkspace();
  const canRequestsCreate = hasPermission("requests.create");
  const canRequestsUpdate = hasPermission("requests.update");
  const { toastError } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "kanban" : "table"));
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  useEffect(() => {
    if (isMobile && viewMode === "table") setViewMode("kanban");
  }, [isMobile]);
  const [statusDraft, setStatusDraft] = useState("all");
  const [typeDraft, setTypeDraft] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [showDetailMore, setShowDetailMore] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [formProjectId, setFormProjectId] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formApartmentId, setFormApartmentId] = useState("");
  const [formType, setFormType] = useState<RequestType>("sell");
  const [formStatus, setFormStatus] = useState<RequestStatus>("new");
  const [formClientRole, setFormClientRole] = useState<ClientRole | "">("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientsLite, setClientsLite] = useState<{ _id: string; fullName: string; email: string; projectId: string }[]>([]);
  const [apartmentsList, setApartmentsList] = useState<{ _id: string; code: string; name: string }[]>([]);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);
  const [requestTransitions, setRequestTransitions] = useState<RequestTransitionRow[]>([]);
  const [transitionsLoading, setTransitionsLoading] = useState(false);
  const [revertingTransitionId, setRevertingTransitionId] = useState<string | null>(null);
  const [requestActions, setRequestActions] = useState<RequestActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [actionDrawerMode, setActionDrawerMode] = useState<"create" | "edit">("create");
  const [editingAction, setEditingAction] = useState<RequestActionRow | null>(null);
  const [deletingActionId, setDeletingActionId] = useState<string | null>(null);

  useEffect(() => {
    if (filtersDrawerOpen) {
      setStatusDraft(statusFilter);
      setTypeDraft(typeFilter);
    }
  }, [filtersDrawerOpen, statusFilter, typeFilter]);

  useEffect(() => {
    if (!selectedRequest?._id) {
      setRequestTransitions([]);
      setRequestActions([]);
      return;
    }
    setTransitionsLoading(true);
    followupApi.requests
      .getRequestTransitions(selectedRequest._id)
      .then((r) => setRequestTransitions(r.transitions ?? []))
      .catch(() => setRequestTransitions([]))
      .finally(() => setTransitionsLoading(false));
  }, [selectedRequest?._id]);

  useEffect(() => {
    if (!workspaceId) {
      setRequestActions([]);
      return;
    }
    setActionsLoading(true);
    followupApi.requests
      .getRequestActions(workspaceId, selectedRequest?._id)
      .then((r) => setRequestActions(r.actions ?? []))
      .catch(() => setRequestActions([]))
      .finally(() => setActionsLoading(false));
  }, [workspaceId, selectedRequest?._id]);

  // Apri drawer dettaglio se arriviamo da scheda cliente con openRequestId
  useEffect(() => {
    const openRequestId = (location.state as { openRequestId?: string } | null)?.openRequestId;
    if (!openRequestId) return;
    followupApi.requests
      .getRequestById(openRequestId)
      .then((r) => {
        setSelectedRequest(r.request);
        navigate(location.pathname, { replace: true, state: {} });
      })
      .catch(() => {
        navigate(location.pathname, { replace: true, state: {} });
      });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!newRequestOpen || !workspaceId || selectedProjectIds.length === 0) return;
    setFormError(null);
    setFormProjectId(selectedProjectIds[0] ?? "");
    setFormClientId("");
    setFormApartmentId("");
    setFormType("sell");
    setFormStatus("new");
    setFormClientRole("");
    followupApi.requests
      .queryClientsLite(workspaceId, selectedProjectIds)
      .then((r) =>
        setClientsLite((r.data ?? []).map((c) => ({ ...c, email: c.email ?? "" })))
      );
    followupApi.requests
      .queryApartments({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 500,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 },
        filters: {},
      })
      .then((r) => setApartmentsList(r.data ?? []));
  }, [newRequestOpen, workspaceId, selectedProjectIds]);

  const handleOpenNewRequest = () => {
    if (!canRequestsCreate) return;
    setNewRequestOpen(true);
  };

  const handleNewRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRequestsCreate) return;
    if (!workspaceId || !formProjectId || !formClientId) {
      setFormError("Seleziona progetto e cliente.");
      return;
    }
    setFormError(null);
    setFormSaving(true);
    try {
      await followupApi.requests.createRequest({
        workspaceId,
        projectId: formProjectId,
        clientId: formClientId,
        apartmentId: formApartmentId || undefined,
        type: formType,
        status: formStatus,
        clientRole: formClientRole || undefined,
      });
      refetch();
      setNewRequestOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Errore durante la creazione.");
    } finally {
      setFormSaving(false);
    }
  };

  const filters = useMemo<Record<string, unknown>>(
    () => {
      const f: Record<string, unknown> = {};
      if (statusFilter !== "all") f.status = [statusFilter];
      if (typeFilter !== "all") f.type = [typeFilter];
      return f;
    },
    [statusFilter, typeFilter]
  );

  const {
    data: requests,
    total,
    page,
    setPage,
    searchText: committedSearch,
    setSearchText: setCommittedSearch,
    isLoading,
    error,
    refetch,
  } = usePaginatedList<RequestRow>({
    loader: followupApi.requests.queryRequests,
    workspaceId: workspaceId ?? "",
    projectIds: selectedProjectIds,
    defaultSortField: "updatedAt",
    defaultPerPage: REQUESTS_PER_PAGE,
    filters,
    enabled: !!(workspaceId && selectedProjectIds.length > 0),
  });

  const handleSearch = () => {
    setCommittedSearch(search);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCommittedSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  };

  const handleApplyFilters = () => {
    setStatusFilter(statusDraft);
    setTypeFilter(typeDraft);
    setPage(1);
  };

  const handleResetDrawerFilters = () => {
    setStatusDraft("all");
    setTypeDraft("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  };

  /** Per vista kanban: raggruppa le richieste della pagina corrente per stato. */
  const requestsByStatus = useMemo(() => {
    const map = new Map<RequestStatus, RequestRow[]>();
    for (const s of KANBAN_STATUS_ORDER) map.set(s, []);
    for (const req of requests) {
      const list = map.get(req.status) ?? [];
      list.push(req);
      map.set(req.status, list);
    }
    return map;
  }, [requests]);

  const totalPages = Math.max(1, Math.ceil(total / REQUESTS_PER_PAGE));
  const pageStart = total === 0 ? 0 : (page - 1) * REQUESTS_PER_PAGE + 1;
  const pageEnd = Math.min(total, page * REQUESTS_PER_PAGE);

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    if (!canRequestsUpdate) return;
    setStatusChangingId(requestId);
    try {
      await followupApi.requests.updateRequestStatus(requestId, { status: newStatus });
      refetch();
      setSelectedRequest((prev) => (prev?._id === requestId ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Errore durante l'aggiornamento dello stato.";
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (typeof parsed?.error === "string") msg = parsed.error;
      } catch {
        /* ignore */
      }
      if (msg.includes("già in uso") || msg.includes("altra trattativa")) {
        msg = "Appartamento già in uso da un'altra trattativa. Sblocca o porta a conclusione quella trattativa prima di cambiare stato.";
      }
      toastError(msg);
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleRevert = async (transitionId: string) => {
    if (!canRequestsUpdate || !selectedRequest) return;
    setRevertingTransitionId(transitionId);
    try {
      const { request } = await followupApi.requests.revertRequestStatus(selectedRequest._id, transitionId);
      setSelectedRequest(request);
      refetch();
      const { transitions } = await followupApi.requests.getRequestTransitions(selectedRequest._id);
      setRequestTransitions(transitions ?? []);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Errore durante il ripristino dello stato.");
    } finally {
      setRevertingTransitionId(null);
    }
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const openActionDrawerCreate = () => {
    if (!canRequestsUpdate) return;
    setEditingAction(null);
    setActionDrawerMode("create");
    setActionDrawerOpen(true);
  };

  const openActionDrawerEdit = (action: RequestActionRow) => {
    if (!canRequestsUpdate) return;
    setEditingAction(action);
    setActionDrawerMode("edit");
    setActionDrawerOpen(true);
  };

  const handleActionSaved = () => {
    if (!workspaceId) return;
    followupApi.requests
      .getRequestActions(workspaceId, selectedRequest?._id)
      .then((r) => setRequestActions(r.actions ?? []));
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!canRequestsUpdate) return;
    if (!window.confirm("Eliminare questa azione?")) return;
    setDeletingActionId(actionId);
    try {
      await followupApi.requests.deleteRequestAction(actionId);
      setRequestActions((prev) => prev.filter((a) => a._id !== actionId));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Errore durante l'eliminazione.");
    } finally {
      setDeletingActionId(null);
    }
  };

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <RequestsBoardSection
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenNewRequest={handleOpenNewRequest}
          newRequestDisabled={!canRequestsCreate}
          newRequestTitle={!canRequestsCreate ? permTitle("requests.create") : undefined}
          statusSelectDisabled={!canRequestsUpdate}
          statusSelectTitle={!canRequestsUpdate ? permTitle("requests.update") : undefined}
          search={search}
          onSearchChange={setSearch}
          onSearch={handleSearch}
          onOpenFilters={() => setFiltersDrawerOpen(true)}
          onResetFilters={handleResetFilters}
          onRefresh={() => refetch()}
          error={error}
          isLoading={isLoading}
          requests={requests}
          committedSearch={committedSearch}
          statusChangingId={statusChangingId}
          onStatusChange={handleStatusChange}
          onSelectRequest={setSelectedRequest}
          requestsByStatus={requestsByStatus}
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
        title="Filtri"
        onApply={handleApplyFilters}
        onReset={handleResetDrawerFilters}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo</label>
            <Select value={typeDraft} onValueChange={setTypeDraft}>
              <SelectTrigger className="min-h-11 w-full rounded-lg border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Stato</label>
            <Select value={statusDraft} onValueChange={setStatusDraft}>
              <SelectTrigger className="min-h-11 w-full rounded-lg border-border text-sm">
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
        </div>
      </FiltersDrawer>

      <Drawer
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setShowDetailMore(false);
          }
        }}
      >
        <DrawerContent side="right" size={isMobile ? "full" : "md"} className="flex flex-col">
          {selectedRequest && (
            <>
              <DrawerHeader actions={<DrawerCloseButton />}>
                <DrawerTitle>Dettaglio trattativa</DrawerTitle>
                <p className="mt-0.5 text-sm font-normal text-muted-foreground">
                  {TYPE_LABEL[selectedRequest.type]} · {STATUS_LABEL[selectedRequest.status]}
                </p>
              </DrawerHeader>
              <DrawerBody className="space-y-6">
                {/* Blocco 1 – Dati trattativa */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dati trattativa</h3>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-sm">
                    <div>
                      <span className="block text-xs text-muted-foreground mb-0.5">Cliente</span>
                      {selectedRequest.clientId ? (
                        <Link
                          to={`/clients/${selectedRequest.clientId}`}
                          className="font-medium text-primary hover:underline"
                          onClick={() => setSelectedRequest(null)}
                        >
                          {selectedRequest.clientName ?? selectedRequest.clientId}
                        </Link>
                      ) : (
                        <p className="font-medium text-foreground">{selectedRequest.clientName ?? "—"}</p>
                      )}
                    </div>
                    {selectedRequest.clientRole && (
                      <div>
                        <span className="block text-xs text-muted-foreground mb-0.5">Ruolo</span>
                        <p className="font-medium text-foreground">{CLIENT_ROLE_LABEL[selectedRequest.clientRole]}</p>
                      </div>
                    )}
                    <div>
                      <span className="block text-xs text-muted-foreground mb-0.5">Appartamento</span>
                      {selectedRequest.apartmentId ? (
                        <Link
                          to={`/apartments/${selectedRequest.apartmentId}`}
                          className="font-medium text-primary hover:underline"
                          onClick={() => setSelectedRequest(null)}
                        >
                          {selectedRequest.apartmentCode ?? selectedRequest.apartmentId}
                        </Link>
                      ) : (
                        <p className="text-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground mb-0.5">Progetto</span>
                      <p className="font-mono text-xs text-foreground">{selectedRequest.projectId}</p>
                    </div>
                    {(selectedRequest.quoteNumber ?? selectedRequest.quoteStatus ?? selectedRequest.quoteTotalPrice != null) && (
                      <div className="rounded-md border border-border bg-background p-3 space-y-1 mt-2">
                        <span className="text-xs font-medium text-muted-foreground">Preventivo</span>
                        {selectedRequest.quoteNumber && (
                          <p className="font-medium text-foreground">N° {selectedRequest.quoteNumber}</p>
                        )}
                        {selectedRequest.quoteStatus && (
                          <p className="text-sm text-muted-foreground">Stato: {selectedRequest.quoteStatus}</p>
                        )}
                        {selectedRequest.quoteTotalPrice != null && (
                          <p className="text-sm font-medium text-foreground">
                            {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(selectedRequest.quoteTotalPrice)}
                          </p>
                        )}
                        {selectedRequest.quoteExpiryOn && (
                          <p className="text-xs text-muted-foreground">Scadenza: {formatDate(selectedRequest.quoteExpiryOn)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Blocco 2 – Cronologia stati */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Storia stati</h3>
                  {transitionsLoading ? (
                    <p className="text-xs text-muted-foreground">Caricamento...</p>
                  ) : requestTransitions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nessun cambio stato registrato.</p>
                  ) : (
                    <ul className="space-y-2">
                      {requestTransitions.map((t) => {
                        const isLatestToCurrent =
                          requestTransitions[0]?._id === t._id && t.toState === selectedRequest.status;
                        const canRevert = isLatestToCurrent && t.event !== "REVERT";
                        return (
                          <li key={t._id} className="flex flex-col gap-0.5 text-sm border-l-2 border-muted pl-3 py-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-medium text-foreground">
                                {STATUS_LABEL[t.fromState]} → {STATUS_LABEL[t.toState]}
                              </span>
                              {canRevert && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 gap-1 h-6 text-xs"
                                  disabled={revertingTransitionId === t._id || !canRequestsUpdate}
                                  title={!canRequestsUpdate ? permTitle("requests.update") : undefined}
                                  onClick={() => handleRevert(t._id)}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  {revertingTransitionId === t._id ? "..." : `Reverti a ${STATUS_LABEL[t.fromState]}`}
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</p>
                            {t.reason && (
                              <p className="text-xs text-muted-foreground italic">&quot;{t.reason}&quot;</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Blocco 3 – Timeline azioni */}
                <section>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Azioni</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-xs gap-1"
                      disabled={!canRequestsUpdate}
                      title={!canRequestsUpdate ? permTitle("requests.update") : undefined}
                      onClick={openActionDrawerCreate}
                    >
                      <Plus className="h-3 w-3" />
                      Nuova azione
                    </Button>
                  </div>
                  {actionsLoading ? (
                    <p className="text-xs text-muted-foreground">Caricamento...</p>
                  ) : requestActions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nessuna azione. Aggiungine una dalla sezione sopra.</p>
                  ) : (
                    <ul className="space-y-2">
                      {requestActions.map((a) => (
                        <li key={a._id} className="flex flex-col gap-0.5 text-sm border-l-2 border-primary/40 pl-3 py-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {ACTION_TYPE_LABEL[a.type]}
                              {a.title ? `: ${a.title}` : ""}
                            </span>
                            <span className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!canRequestsUpdate}
                                title={!canRequestsUpdate ? permTitle("requests.update") : undefined}
                                onClick={() => openActionDrawerEdit(a)}
                                aria-label="Modifica azione"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={deletingActionId === a._id || !canRequestsUpdate}
                                title={!canRequestsUpdate ? permTitle("requests.update") : undefined}
                                onClick={() => handleDeleteAction(a._id)}
                                aria-label="Elimina azione"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground">{a.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                          {a.requestIds.length > 1 && (
                            <p className="text-xs text-muted-foreground">
                              Trattative collegate: {a.requestIds.length}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setShowDetailMore((v) => !v)}
                    className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  >
                    {showDetailMore ? "Mostra meno" : "Mostra altro"}
                  </button>
                  {showDetailMore && (
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p><span className="font-medium text-foreground">ID:</span> <span className="font-mono text-xs">{selectedRequest._id}</span></p>
                      <p><span className="font-medium text-foreground">Creato il:</span> {formatDate(selectedRequest.createdAt)}</p>
                      <p><span className="font-medium text-foreground">Aggiornato il:</span> {formatDate(selectedRequest.updatedAt)}</p>
                      <p><span className="font-medium text-foreground">Workspace:</span> {selectedRequest.workspaceId}</p>
                    </div>
                  )}
                </div>
              </DrawerBody>
              <DrawerFooter>
                {selectedRequest.status === "won" &&
                  selectedRequest.clientId &&
                  selectedRequest.apartmentId && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full min-h-11 gap-2"
                      disabled={!canRequestsUpdate}
                      title={!canRequestsUpdate ? permTitle("requests.update") : undefined}
                      onClick={() => {
                        navigate("/?section=associateAptClient", {
                          state: {
                            clientId: selectedRequest.clientId,
                            apartmentId: selectedRequest.apartmentId,
                            status: "proposta",
                          },
                        });
                        setSelectedRequest(null);
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                      Crea associazione proposta
                    </Button>
                  )}
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <RequestsActionDrawer
        open={actionDrawerOpen}
        onOpenChange={setActionDrawerOpen}
        mode={actionDrawerMode}
        editingAction={editingAction}
        initialRequestIds={selectedRequest ? [selectedRequest._id] : []}
        requests={requests}
        workspaceId={workspaceId ?? undefined}
        onSaved={handleActionSaved}
        isMobile={isMobile}
      />

      <Drawer open={newRequestOpen} onOpenChange={(o) => !o && setNewRequestOpen(false)}>
        <DrawerContent side="right" size={isMobile ? "full" : "md"}>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Nuova trattativa</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleNewRequestSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="flex flex-col gap-4">
              {formError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Progetto</label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona progetto" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProjectIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Cliente *</label>
                <Select value={formClientId} onValueChange={setFormClientId} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsLite.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.fullName} {c.email ? `(${c.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Appartamento (opzionale)</label>
                <Select value={formApartmentId || "_none"} onValueChange={(v) => setFormApartmentId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nessuno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nessuno</SelectItem>
                    {apartmentsList.map((a) => (
                      <SelectItem key={a._id} value={a._id}>
                        {a.code} {a.name ? `— ${a.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Tipo</label>
                <Select value={formType} onValueChange={(v) => setFormType(v as RequestType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">{TYPE_LABEL.rent}</SelectItem>
                    <SelectItem value="sell">{TYPE_LABEL.sell}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Ruolo cliente (opzionale)</label>
                <Select value={formClientRole || "_none"} onValueChange={(v) => setFormClientRole(v === "_none" ? "" : (v as ClientRole))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nessuno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nessuno</SelectItem>
                    {(Object.entries(CLIENT_ROLE_LABEL) as [ClientRole, string][]).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Stato</label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as RequestStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button type="button" variant="outline" onClick={() => setNewRequestOpen(false)} className="min-h-11">
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={formSaving || !canRequestsCreate}
                title={!canRequestsCreate ? permTitle("requests.create") : undefined}
                className="min-h-11"
              >
                {formSaving ? "Creazione..." : "Crea trattativa"}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
