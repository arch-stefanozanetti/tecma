import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Home, Calendar, FileText, User, ClipboardList, Pencil, History, UserPlus, Trash2, Mail, Phone, CalendarCheck, ExternalLink, TrendingUp, Upload, Link2, Loader2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type {
  AdditionalInfoRow,
  CalendarEvent,
  ClientDocumentRow,
  ClientRow,
  RequestRow,
  RequestStatus,
  RequestTransitionRow,
  RequestActionRow,
  RequestActionType,
} from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/formatDate";
import { STATUS_FILTER_OPTIONS } from "./constants";
import {
  ACTION_TYPE_LABEL,
  STATUS_LABEL,
  statusLabel,
} from "./clientDetailConstants";
import { Textarea } from "../../components/ui/textarea";
import { FileUpload } from "../../components/ui/file-upload";
import { MatchingCandidatesList } from "../../components/MatchingCandidatesList";
import { RequestStatusRoadmap } from "../../components/RequestStatusRoadmap";
import { useWorkflowConfig } from "../../hooks/useWorkflowConfig";
import { CalendarEventFormDrawer } from "../calendar/CalendarEventFormDrawer";
import { ClientProfilationCard } from "./ClientProfilationCard";
import { useClientDetailData } from "./useClientDetailData";
import { useToast } from "../../contexts/ToastContext";
import moment from "moment";

export const ClientDetailPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, projects, isAdmin } = useWorkspace();
  const workflowConfigRent = useWorkflowConfig(workspaceId, "rent");
  const workflowConfigSell = useWorkflowConfig(workspaceId, "sell");
  const getWorkflowConfig = (type: "rent" | "sell") => (type === "rent" ? workflowConfigRent : workflowConfigSell);
  const {
    client,
    setClient,
    loading,
    error,
    requests,
    setRequests,
    requestsLoading,
    reloadRequests,
  } = useClientDetailData(clientId, workspaceId, selectedProjectIds);
  const { toastError, toastSuccess } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState("lead");
  const [formCity, setFormCity] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [additionalInfos, setAdditionalInfos] = useState<AdditionalInfoRow[]>([]);
  const [formAdditionalInfo, setFormAdditionalInfo] = useState<Record<string, unknown>>({});
  const [auditEvents, setAuditEvents] = useState<Array<{ _id: string; at: string; action: string; actor?: { email?: string }; payload?: Record<string, unknown> }>>([]);
  const [assignments, setAssignments] = useState<Array<{ userId: string }>>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<Array<{ userId: string }>>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [actionLogging, setActionLogging] = useState<string | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<Array<{ item: { _id: string; code: string; name?: string; status: string; mode: string; surfaceMq: number }; score: number; reasons: string[] }>>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [requestStatusChangingId, setRequestStatusChangingId] = useState<string | null>(null);
  const [transitionsByRequestId, setTransitionsByRequestId] = useState<Record<string, RequestTransitionRow[]>>({});
  const [transitionsLoadingId, setTransitionsLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profilo");
  const [timelineActions, setTimelineActions] = useState<RequestActionRow[]>([]);
  const [timelineActionsLoading, setTimelineActionsLoading] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [actionDrawerMode, setActionDrawerMode] = useState<"create" | "edit">("create");
  const [editingAction, setEditingAction] = useState<RequestActionRow | null>(null);
  const [actionFormType, setActionFormType] = useState<RequestActionType>("note");
  const [actionFormTitle, setActionFormTitle] = useState("");
  const [actionFormDescription, setActionFormDescription] = useState("");
  const [actionFormRequestIds, setActionFormRequestIds] = useState<string[]>([]);
  const [actionFormSaving, setActionFormSaving] = useState(false);
  const [actionFormError, setActionFormError] = useState<string | null>(null);
  const [deletingActionId, setDeletingActionId] = useState<string | null>(null);
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [calendarDrawerPrefill, setCalendarDrawerPrefill] = useState<{
    title?: string;
    startsAt?: string;
    endsAt?: string;
    clientId?: string;
    projectId?: string;
  }>({});
  const [calendarEventsRefreshKey, setCalendarEventsRefreshKey] = useState(0);
  const [clientDocuments, setClientDocuments] = useState<ClientDocumentRow[]>([]);
  const [clientDocumentsLoading, setClientDocumentsLoading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [shareLinkDocId, setShareLinkDocId] = useState<string | null>(null);
  const [documentVisibility, setDocumentVisibility] = useState<"internal" | "client">("internal");

  useEffect(() => {
    if (!clientId || !client || !workspaceId || selectedProjectIds.length === 0) return;
    setMatchLoading(true);
    followupApi
      .getClientCandidates(clientId, workspaceId, [client.projectId])
      .then((r) => setMatchCandidates((r.data ?? []) as unknown as typeof matchCandidates))
      .catch(() => setMatchCandidates([]))
      .finally(() => setMatchLoading(false));
  }, [clientId, client?.projectId, workspaceId, selectedProjectIds.length]);

  const logAction = async (type: "mail_received" | "mail_sent" | "call_completed" | "meeting_scheduled") => {
    if (!clientId) return;
    setActionLogging(type);
    try {
      await followupApi.createClientAction(clientId, type);
      await followupApi.getAuditForEntity("client", clientId, workspaceId ?? "", 25).then((r) => setAuditEvents(r.data ?? []));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Errore durante la registrazione dell'azione.");
    } finally {
      setActionLogging(null);
    }
  };

  // Tab Timeline: carica azioni
  useEffect(() => {
    if (activeTab !== "timeline" || !workspaceId) return;
    setTimelineActionsLoading(true);
    followupApi
      .getRequestActions(workspaceId)
      .then((r) => setTimelineActions(r.actions ?? []))
      .catch(() => setTimelineActions([]))
      .finally(() => setTimelineActionsLoading(false));
  }, [activeTab, workspaceId]);

  // Tab Timeline: carica eventi calendario del progetto cliente (Customer 360), filtrati per clientId
  useEffect(() => {
    if (!workspaceId || !client?.projectId || selectedProjectIds.length === 0 || !clientId) return;
    const from = new Date();
    from.setDate(from.getDate() - 90);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    followupApi
      .queryCalendar({
        workspaceId,
        projectIds: selectedProjectIds.includes(client.projectId) ? [client.projectId] : selectedProjectIds,
        page: 1,
        perPage: 100,
        searchText: "",
        sort: { field: "startsAt", direction: -1 },
        filters: { dateFrom: from.toISOString(), dateTo: to.toISOString(), clientId },
      })
      .then((r) => setCalendarEvents(r.data ?? []))
      .catch(() => setCalendarEvents([]));
  }, [workspaceId, clientId, client?.projectId, selectedProjectIds, calendarEventsRefreshKey]);

  useEffect(() => {
    if ((activeTab !== "timeline" && activeTab !== "trattative") || requests.length === 0) return;
    const toLoad = requests.filter((r) => transitionsByRequestId[r._id] === undefined);
    if (toLoad.length === 0) return;
    Promise.all(toLoad.map((r) => followupApi.getRequestTransitions(r._id).then((res) => ({ requestId: r._id, transitions: res.transitions ?? [] }))))
      .then((arr) => {
        setTransitionsByRequestId((prev) => ({
          ...prev,
          ...Object.fromEntries(arr.map(({ requestId, transitions }) => [requestId, transitions])),
        }));
      })
      .catch(() => {});
  }, [activeTab, requests, transitionsByRequestId]);

  useEffect(() => {
    if (activeTab !== "documenti" || !clientId || !workspaceId) return;
    setClientDocumentsLoading(true);
    followupApi
      .listClientDocuments(workspaceId, clientId)
      .then((r) => setClientDocuments(r.data ?? []))
      .catch(() => setClientDocuments([]))
      .finally(() => setClientDocumentsLoading(false));
  }, [activeTab, clientId, workspaceId]);

  const loadClientDocuments = useCallback(() => {
    if (!clientId || !workspaceId) return;
    followupApi.listClientDocuments(workspaceId, clientId).then((r) => setClientDocuments(r.data ?? []));
  }, [clientId, workspaceId]);

  const handleDocumentFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !workspaceId || !clientId) return;
      setDocumentUploading(true);
      try {
        for (const file of Array.from(files)) {
          const { uploadUrl, key } = await followupApi.getClientDocumentUploadUrl(workspaceId, clientId, {
            name: file.name,
            mimeType: file.type || "application/pdf",
            fileSize: file.size,
            type: "altro",
          });
          await followupApi.uploadFileToPresignedUrl(uploadUrl, file);
          await followupApi.createClientDocument(workspaceId, clientId, {
            key,
            name: file.name,
            mimeType: file.type || "application/pdf",
            fileSize: file.size,
            type: "altro",
            visibility: documentVisibility,
          });
        }
        toastSuccess("Documento/i caricati");
        loadClientDocuments();
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Errore upload");
      } finally {
        setDocumentUploading(false);
      }
    },
    [workspaceId, clientId, documentVisibility, loadClientDocuments, toastSuccess, toastError]
  );

  const timelineSorted = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [requests]
  );

  const requestIdsSet = useMemo(() => new Set(requests.map((r) => r._id)), [requests]);
  const timelineActionsFiltered = useMemo(
    () => timelineActions.filter((a) => a.requestIds.some((id) => requestIdsSet.has(id))),
    [timelineActions, requestIdsSet]
  );
  type TimelineItem =
    | { kind: "transition"; id: string; createdAt: string; requestId: string; request: RequestRow; transition: RequestTransitionRow }
    | { kind: "action"; id: string; createdAt: string; action: RequestActionRow }
    | { kind: "calendar_event"; id: string; createdAt: string; event: CalendarEvent };
  const timelineUnified = useMemo(() => {
    const items: TimelineItem[] = [];
    requests.forEach((req) => {
      const transitions = transitionsByRequestId[req._id] ?? [];
      transitions.forEach((t) => {
        items.push({ kind: "transition", id: `t-${t._id}`, createdAt: t.createdAt, requestId: req._id, request: req, transition: t });
      });
    });
    timelineActionsFiltered.forEach((a) => {
      items.push({ kind: "action", id: `a-${a._id}`, createdAt: a.createdAt, action: a });
    });
    calendarEvents.forEach((ev) => {
      items.push({ kind: "calendar_event", id: `ev-${ev._id}`, createdAt: ev.startsAt, event: ev });
    });
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [requests, transitionsByRequestId, timelineActionsFiltered, calendarEvents]);

  /** Prossimi appuntamenti (solo futuri), max 5, per blocco in cima alla scheda */
  const upcomingCalendarEvents = useMemo(() => {
    const now = new Date().toISOString();
    return calendarEvents
      .filter((ev) => ev.startsAt >= now)
      .sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1))
      .slice(0, 5);
  }, [calendarEvents]);

  /** Riepilogo trattative per blocco in cima (conteggio per stato) */
  const requestsSummaryByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    requests.forEach((r) => {
      const s = r.status ?? "other";
      m[s] = (m[s] ?? 0) + 1;
    });
    return m;
  }, [requests]);

  const openActionDrawerCreate = useCallback(() => {
    setEditingAction(null);
    setActionDrawerMode("create");
    setActionFormType("note");
    setActionFormTitle("");
    setActionFormDescription("");
    setActionFormRequestIds(requests.length > 0 ? [requests[0]._id] : []);
    setActionFormError(null);
    setActionDrawerOpen(true);
  }, [requests]);

  const openCalendarDrawerFromTimelineItem = useCallback(
    (item: TimelineItem) => {
      const basePrefill = {
        clientId: clientId ?? undefined,
        projectId: client?.projectId ?? selectedProjectIds[0],
      };
      if (item.kind === "transition") {
        const toLabel = getWorkflowConfig(item.request.type).statusLabelByCode[item.transition.toState] ?? item.transition.toState;
        const start = moment().hour(9).minute(0).second(0);
        const end = start.clone().add(1, "hour");
        setCalendarDrawerPrefill({
          ...basePrefill,
          title: `Follow-up: ${toLabel}`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        });
      } else if (item.kind === "calendar_event") {
        setCalendarDrawerPrefill({
          clientId: item.event.clientId ?? basePrefill.clientId,
          projectId: item.event.projectId ?? basePrefill.projectId,
          title: item.event.title,
          startsAt: item.event.startsAt,
          endsAt: item.event.endsAt,
        });
      } else {
        const start = moment().hour(9).minute(0).second(0);
        const end = start.clone().add(1, "hour");
        setCalendarDrawerPrefill({
          ...basePrefill,
          title: item.action.title ?? undefined,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        });
      }
      setCalendarDrawerOpen(true);
    },
    [clientId, client?.projectId, selectedProjectIds, getWorkflowConfig]
  );

  const openActionDrawerEdit = useCallback((action: RequestActionRow) => {
    setEditingAction(action);
    setActionDrawerMode("edit");
    setActionFormType(action.type);
    setActionFormTitle(action.title ?? "");
    setActionFormDescription(action.description ?? "");
    setActionFormRequestIds([...action.requestIds].filter((id) => requestIdsSet.has(id)));
    setActionFormError(null);
    setActionDrawerOpen(true);
  }, [requestIdsSet]);

  const handleActionFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!workspaceId) return;
      if (actionFormRequestIds.length === 0) {
        setActionFormError("Seleziona almeno una trattativa.");
        return;
      }
      setActionFormError(null);
      setActionFormSaving(true);
      try {
        if (actionDrawerMode === "edit" && editingAction) {
          await followupApi.updateRequestAction(editingAction._id, {
            type: actionFormType,
            title: actionFormTitle.trim() || undefined,
            description: actionFormDescription.trim() || undefined,
            requestIds: actionFormRequestIds,
          });
        } else {
          await followupApi.createRequestAction({
            workspaceId,
            requestIds: actionFormRequestIds,
            type: actionFormType,
            title: actionFormTitle.trim() || undefined,
            description: actionFormDescription.trim() || undefined,
          });
        }
        setActionDrawerOpen(false);
        const { actions } = await followupApi.getRequestActions(workspaceId);
        setTimelineActions(actions ?? []);
      } catch (err) {
        setActionFormError(err instanceof Error ? err.message : "Errore nel salvataggio.");
      } finally {
        setActionFormSaving(false);
      }
    },
    [
      workspaceId,
      actionDrawerMode,
      editingAction,
      actionFormType,
      actionFormTitle,
      actionFormDescription,
      actionFormRequestIds,
    ]
  );

  const handleDeleteAction = useCallback(async (actionId: string) => {
    if (!window.confirm("Eliminare questa azione?")) return;
    setDeletingActionId(actionId);
    try {
      await followupApi.deleteRequestAction(actionId);
      setTimelineActions((prev) => prev.filter((a) => a._id !== actionId));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Errore durante l'eliminazione.");
    } finally {
      setDeletingActionId(null);
    }
  }, []);

  const addRequestIdToActionForm = useCallback((requestId: string) => {
    if (!actionFormRequestIds.includes(requestId)) {
      setActionFormRequestIds((prev) => [...prev, requestId]);
    }
  }, [actionFormRequestIds]);

  const removeRequestIdFromActionForm = useCallback((requestId: string) => {
    setActionFormRequestIds((prev) => (prev.length <= 1 ? prev : prev.filter((id) => id !== requestId)));
  }, []);

  const handleRequestStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    setRequestStatusChangingId(requestId);
    try {
      await followupApi.updateRequestStatus(requestId, { status: newStatus });
      reloadRequests();
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Errore durante l'aggiornamento dello stato della trattativa.";
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (typeof parsed?.error === "string") msg = parsed.error;
      } catch {
        // msg resta invariato
      }
      if (msg.includes("già in uso") || msg.includes("altra trattativa")) {
        msg = "Appartamento già in uso da un'altra trattativa. Sblocca o porta a conclusione quella trattativa prima di cambiare stato.";
      }
      toastError(msg);
    } finally {
      setRequestStatusChangingId(null);
    }
  };

  useEffect(() => {
    if (!workspaceId) return;
    followupApi
      .listAdditionalInfos(workspaceId)
      .then((r) => setAdditionalInfos(r.data ?? []))
      .catch(() => setAdditionalInfos([]));
  }, [workspaceId]);

  useEffect(() => {
    if (!clientId || !workspaceId) return;
    followupApi
      .getAuditForEntity("client", clientId, workspaceId, 25)
      .then((r) => setAuditEvents(r.data ?? []))
      .catch(() => setAuditEvents([]));
  }, [clientId, workspaceId]);

  useEffect(() => {
    if (!clientId || !workspaceId) return;
    followupApi
      .listEntityAssignments(workspaceId, "client", clientId)
      .then((r) => setAssignments(r.data ?? []))
      .catch(() => setAssignments([]));
  }, [clientId, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isAdmin) return;
    followupApi
      .listWorkspaceUsers(workspaceId)
      .then((r) => setWorkspaceUsers(r.data ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [workspaceId, isAdmin]);

  useEffect(() => {
    if (!editDialogOpen || !client) return;
    setFormFullName(client.fullName ?? "");
    setFormEmail(client.email ?? "");
    setFormPhone(client.phone ?? "");
    setFormStatus(client.status ?? "lead");
    setFormCity(client.city ?? "");
    const customInfos = additionalInfos.filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo");
    setFormAdditionalInfo(
      customInfos.length > 0
        ? Object.fromEntries(customInfos.map((ai) => [ai.name, client.additionalInfo?.[ai.name] ?? ""]))
        : client.additionalInfo && typeof client.additionalInfo === "object"
          ? { ...client.additionalInfo }
          : {}
    );
    setFormSubmitError(null);
  }, [editDialogOpen, client, additionalInfos]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setFormSubmitError(null);
    setFormSaving(true);
    try {
      const additionalInfoPayload =
        Object.keys(formAdditionalInfo).length > 0
          ? Object.fromEntries(
              Object.entries(formAdditionalInfo).filter(([, v]) => v != null && String(v).trim() !== "")
            )
          : undefined;
      const res = await followupApi.updateClient(client._id, {
        fullName: formFullName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        status: formStatus,
        city: formCity.trim() || undefined,
        additionalInfo: additionalInfoPayload,
      });
      setClient(res.client);
      setEditDialogOpen(false);
    } catch (err) {
      setFormSubmitError(err instanceof Error ? err.message : "Errore durante il salvataggio.");
    } finally {
      setFormSaving(false);
    }
  };

  const goBack = () => navigate("/?section=clients");

  const handleAssign = async () => {
    if (!clientId || !workspaceId || !assignUserId.trim()) return;
    try {
      await followupApi.assignEntity(workspaceId, "client", clientId, assignUserId.trim());
      setAssignments((prev) => [...prev, { userId: assignUserId.trim() }]);
      setAssignUserId("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore assegnazione");
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!clientId || !workspaceId) return;
    if (!window.confirm(`Rimuovere assegnazione a ${userId}?`)) return;
    try {
      await followupApi.unassignEntity(workspaceId, "client", clientId, userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-2" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" />
          Torna a Clienti
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditDialogOpen(true)}>
          <Pencil className="h-4 w-4" />
          Modifica
        </Button>
      </div>

      <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{client.fullName}</h1>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              "bg-muted text-muted-foreground"
            )}
          >
            {statusLabel(client.status)}
          </span>
        </div>
      </header>

      {/* Blocco Prossimi appuntamenti + Riepilogo trattative (Customer 360) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-chrome border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" />
              Prossimi appuntamenti
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setCalendarDrawerPrefill({ clientId: client._id, projectId: client.projectId ?? undefined });
                setCalendarDrawerOpen(true);
              }}
            >
              Fissa in calendario
            </Button>
          </div>
          {upcomingCalendarEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun appuntamento in programma.</p>
          ) : (
            <ul className="space-y-1">
              {upcomingCalendarEvents.map((ev) => (
                <li key={ev._id} className="flex items-center gap-2 text-sm">
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {moment(ev.startsAt).format("DD MMM HH:mm")}
                  </span>
                  <span className="truncate text-foreground">{ev.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-chrome border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Trattative
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("trattative")}>
              Vai alla tab
            </Button>
          </div>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna trattativa associata.</p>
          ) : (
            <p className="text-sm text-foreground">
              {requests.length} trattativa{requests.length !== 1 ? "e" : ""}
              {Object.keys(requestsSummaryByStatus).length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({Object.entries(requestsSummaryByStatus)
                    .map(([status, n]) => `${n} ${statusLabel(status)}`)
                    .join(", ")})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <Drawer open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>Modifica cliente</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <DrawerBody className="space-y-4">
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
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={formSaving}>
                  {formSaving ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full flex flex-wrap border-b border-border bg-transparent p-0">
          <TabsTrigger value="profilo" icon={<User className="h-4 w-4" />}>
            Profilo
          </TabsTrigger>
          <TabsTrigger value="trattative" icon={<Calendar className="h-4 w-4" />}>
            Trattative
          </TabsTrigger>
          <TabsTrigger value="appartamenti" icon={<Home className="h-4 w-4" />}>
            Appartamenti
          </TabsTrigger>
          <TabsTrigger value="timeline" icon={<History className="h-4 w-4" />}>
            Timeline
          </TabsTrigger>
          <TabsTrigger value="documenti" icon={<FileText className="h-4 w-4" />}>
            Documenti
          </TabsTrigger>
        </TabsList>

        {/* Tab Profilo — allineato a scheda cliente e match: Contatti, Profilazione, Dettaglio/Info, Date e ID */}
        <TabsContent value="profilo" className="space-y-6 mt-4">
          <div className="grid gap-6 sm:grid-cols-2">
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Azioni rapide</h2>
            <p className="text-xs text-muted-foreground">
              Registra le attività svolte con il cliente. Le azioni compaiono nella timeline.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("mail_received")}
                disabled={actionLogging !== null}
              >
                <Mail className="h-3.5 w-3.5" />
                {actionLogging === "mail_received" ? "..." : "Mail ricevuta"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("mail_sent")}
                disabled={actionLogging !== null}
              >
                <Mail className="h-3.5 w-3.5" />
                {actionLogging === "mail_sent" ? "..." : "Mail inviata"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("call_completed")}
                disabled={actionLogging !== null}
              >
                <Phone className="h-3.5 w-3.5" />
                {actionLogging === "call_completed" ? "..." : "Chiamata fatta"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => logAction("meeting_scheduled")}
                disabled={actionLogging !== null}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                {actionLogging === "meeting_scheduled" ? "..." : "Meeting fissato"}
              </Button>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Contatti</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="font-medium text-foreground">{client.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telefono</span>
                <p className="font-medium text-foreground">{client.phone ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Città</span>
                <p className="font-medium text-foreground">{client.city ?? "—"}</p>
              </div>
              {client.coniuge && (client.coniuge.nome || client.coniuge.cognome || client.coniuge.mail) && (
                <div>
                  <span className="text-muted-foreground">Coniuge</span>
                  <p className="font-medium text-foreground">
                    {[client.coniuge.nome, client.coniuge.cognome].filter(Boolean).join(" ") || "—"}
                    {client.coniuge.mail && ` • ${client.coniuge.mail}`}
                  </p>
                </div>
              )}
            </div>
          </section>

            <ClientProfilationCard client={client} />
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Info e dettaglio</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {client.profilazione && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Profilazione</span>
              )}
              {client.trattamento && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Trattamento</span>
              )}
              {client.marketing && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Marketing</span>
              )}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Progetto</span>
                <p className="font-mono text-xs text-foreground">{client.projectId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stato</span>
                <p className="font-medium text-foreground">{statusLabel(client.status)}</p>
              </div>
              {client.source != null && (
                <div>
                  <span className="text-muted-foreground">Fonte</span>
                  <p className="font-medium text-foreground">{client.source}</p>
                </div>
              )}
              {client.budget != null && client.budget !== "" && (
                <div>
                  <span className="text-muted-foreground">Budget</span>
                  <p className="font-medium text-foreground">{String(client.budget)}</p>
                </div>
              )}
              {client.motivazione != null && (
                <div>
                  <span className="text-muted-foreground">Motivazione</span>
                  <p className="font-medium text-foreground">{client.motivazione}</p>
                </div>
              )}
              {client.nProposals != null && (
                <div>
                  <span className="text-muted-foreground">Proposte</span>
                  <p className="font-medium text-foreground">{client.nProposals}</p>
                </div>
              )}
              {client.nReserved != null && (
                <div>
                  <span className="text-muted-foreground">Riservati</span>
                  <p className="font-medium text-foreground">{client.nReserved}</p>
                </div>
              )}
              {client.myhomeVersion != null && (
                <div>
                  <span className="text-muted-foreground">Versione MyHome</span>
                  <p className="font-medium text-foreground">{client.myhomeVersion}</p>
                </div>
              )}
              {client.createdBy != null && (
                <div>
                  <span className="text-muted-foreground">Creato da</span>
                  <p className="font-medium text-foreground">{client.createdBy}</p>
                </div>
              )}
            </div>
            {client.note && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Note</span>
                <p className="font-medium text-foreground mt-1">{client.note}</p>
              </div>
            )}
            {client.family && (client.family.adulti != null || client.family.bambini != null || client.family.animali != null) && (
              <div className="mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Famiglia</span>
                <p className="font-medium text-foreground mt-1">
                  Adulti: {client.family.adulti ?? "—"} • Bambini: {client.family.bambini ?? "—"} • Animali: {client.family.animali ?? "—"}
                </p>
              </div>
            )}
            {(() => {
              const customInfos = additionalInfos.filter((ai) => (ai.path ?? "additionalInfo") === "additionalInfo");
              const hasCustom = customInfos.length > 0 || (client.additionalInfo && typeof client.additionalInfo === "object" && Object.keys(client.additionalInfo).length > 0);
              if (!hasCustom) return null;
              return (
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-muted-foreground">Info aggiuntive</span>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {customInfos.length > 0
                      ? customInfos.map((ai) => {
                          const val = client.additionalInfo?.[ai.name];
                          if (val == null || (typeof val === "string" && val.trim() === "")) return null;
                          return (
                            <div key={ai._id}>
                              <span className="text-muted-foreground">{ai.label}</span>
                              <p className="font-medium text-foreground">
                                {Array.isArray(val) ? val.join(", ") : String(val)}
                              </p>
                            </div>
                          );
                        })
                      : Object.entries(client.additionalInfo ?? {}).map(([key, val]) =>
                          val != null && (typeof val !== "string" || val.trim() !== "") ? (
                            <div key={key}>
                              <span className="text-muted-foreground">{key}</span>
                              <p className="font-medium text-foreground">
                                {Array.isArray(val) ? val.join(", ") : String(val)}
                              </p>
                            </div>
                          ) : null
                        )}
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Date e dettagli tecnici
            </h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Creato il</span>
                <p className="font-medium text-foreground">{formatDate(client.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Aggiornato il</span>
                <p className="font-medium text-foreground">{formatDate(client.updatedAt)}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">ID</span>
                <p className="font-mono text-xs text-foreground">{client._id}</p>
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Assegnato a
              </h2>
              <p className="text-xs text-muted-foreground mb-2">
                Assegna questo cliente a un vendor per limitarne la visibilità.
              </p>
              <ul className="space-y-1 mb-3">
                {assignments.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span>{a.userId}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-destructive" onClick={() => handleUnassign(a.userId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
                {assignments.length === 0 && <li className="text-sm text-muted-foreground">Nessuna assegnazione</li>}
              </ul>
              <div className="flex gap-2">
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger className="flex-1 max-w-xs">
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceUsers
                      .filter((u) => !assignments.some((a) => a.userId === u.userId))
                      .map((u) => (
                        <SelectItem key={u.userId} value={u.userId}>{u.userId}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssign} disabled={!assignUserId.trim()}>
                  Assegna
                </Button>
              </div>
            </section>
          )}
        </TabsContent>

        {/* Tab Trattative — timeline trattative */}
        <TabsContent value="trattative" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline trattative
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : timelineSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessuna trattativa associata. Crea una trattativa dalla sezione Trattative per
                vedere qui gli aggiornamenti.
              </p>
            ) : (
              <ul className="space-y-0">
                {timelineSorted.map((req) => {
                  const nextStatuses = getWorkflowConfig(req.type).allowedNextStatuses(req.status) ?? [];
                  const transitions = transitionsByRequestId[req._id] ?? [];
                  const loadingTransitions = transitionsLoadingId === req._id;
                  return (
                    <li key={req._id} className="border-b border-border last:border-b-0">
                      <div className="flex gap-3 py-3">
                        <div
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            req.status === "won"
                              ? "bg-green-500"
                              : req.status === "lost"
                                ? "bg-muted-foreground/50"
                                : "bg-primary"
                          )}
                        />
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-foreground">
                              {getWorkflowConfig(req.type).statusLabelByCode[req.status] ?? req.status}
                            </span>
                            <span className="text-muted-foreground">
                              {req.type === "sell" ? "Vendita" : "Affitto"}
                            </span>
                            {req.apartmentId && (
                              <Link
                                to={`/apartments/${req.apartmentId}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {req.apartmentCode ?? req.apartmentId}
                              </Link>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-primary gap-1"
                              onClick={() => navigate("/requests", { state: { openRequestId: req._id } })}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Dettaglio
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(req.updatedAt)}
                          </p>
                          {nextStatuses.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {nextStatuses.map((st) => (
                                <Button
                                  key={st}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  disabled={requestStatusChangingId === req._id}
                                  onClick={() => handleRequestStatusChange(req._id, st)}
                                >
                                  {getWorkflowConfig(req.type).statusLabelByCode[st] ?? st}
                                </Button>
                              ))}
                            </div>
                          )}
                          {loadingTransitions ? (
                            <p className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">Caricamento percorso...</p>
                          ) : (
                            <RequestStatusRoadmap
                              currentStatus={req.status}
                              transitions={transitions}
                              statusLabelByCode={getWorkflowConfig(req.type).statusLabelByCode}
                              statusOrder={getWorkflowConfig(req.type).statusOrder}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* Tab Appartamenti — consigliati (placeholder) + appartamenti dalle trattative */}
        <TabsContent value="appartamenti" className="space-y-6 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Home className="h-4 w-4" />
              Appartamenti in trattativa
            </h2>
            {requestsLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : (
              (() => {
                const withApt = requests.filter((r) => r.apartmentId);
                const seen = new Set<string>();
                const unique = withApt.filter((r) => {
                  if (r.apartmentId && !seen.has(r.apartmentId)) {
                    seen.add(r.apartmentId);
                    return true;
                  }
                  return false;
                });
                if (unique.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Nessun appartamento associato alle trattative. Le trattative con
                      appartamento appariranno qui.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-2">
                    {unique.map((req) => (
                      <li key={req.apartmentId}>
                        <Link
                          to={`/apartments/${req.apartmentId}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {req.apartmentCode ?? req.apartmentId}
                        </Link>
                        <span className="text-muted-foreground text-sm ml-2">
                          — {getWorkflowConfig(req.type).statusLabelByCode[req.status] ?? req.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </section>

          <MatchingCandidatesList
            title="Appartamenti papabili (matching)"
            introText="Appartamenti disponibili compatibili con il profilo del cliente."
            emptyMessage="Nessun appartamento papabile trovato. Completa il profilo (budget, città) per migliorare il matching."
            loading={matchLoading}
            candidates={matchCandidates}
            getItemLink={(item) => `/apartments/${item._id}`}
            renderItemTitle={(item) => <>{item.code}{item.name ? ` — ${item.name}` : ""}</>}
            renderItemSubtitle={(item) => `${item.mode === "SELL" ? "Vendita" : "Affitto"} · ${item.surfaceMq} m²`}
          />
        </TabsContent>

        {/* Tab Timeline — timeline unificata (trattative + azioni) con CRUD azioni */}
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4" />
                Timeline
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    const start = moment().hour(9).minute(0).second(0);
                    const end = start.clone().add(1, "hour");
                    setCalendarDrawerPrefill({
                      clientId: clientId ?? undefined,
                      projectId: client?.projectId ?? selectedProjectIds[0],
                      title: client?.fullName ? `Appuntamento con ${client.fullName}` : "",
                      startsAt: start.toISOString(),
                      endsAt: end.toISOString(),
                    });
                    setCalendarDrawerOpen(true);
                  }}
                  disabled={!clientId || !client?.projectId || !workspaceId || selectedProjectIds.length === 0}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Fissa in calendario
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={openActionDrawerCreate}
                  disabled={requests.length === 0}
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Nuova azione
                </Button>
              </div>
            </div>
            {timelineActionsLoading && timelineUnified.length === 0 ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : timelineUnified.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun evento. Le transizioni delle trattative e le azioni collegate al cliente appariranno qui.
              </p>
            ) : (
              <div className="relative pl-10">
                {/* Linea verticale */}
                <div
                  className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border rounded-full"
                  aria-hidden
                />
                <ul className="space-y-0">
                  {timelineUnified.map((item) => (
                    <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Nodo sulla linea */}
                      <div
                        className={cn(
                          "absolute left-0 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm",
                          item.kind === "transition"
                            ? "bg-primary text-primary-foreground"
                            : item.kind === "calendar_event"
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.kind === "transition" ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : item.kind === "calendar_event" ? (
                          <Calendar className="h-3.5 w-3.5" />
                        ) : item.action.type === "call" ? (
                          <Phone className="h-3.5 w-3.5" />
                        ) : item.action.type === "email" ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : item.action.type === "meeting" ? (
                          <CalendarCheck className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                      </div>
                      {/* Data + card */}
                      <div className="flex gap-3 min-w-0 flex-1 pl-8">
                        <span className="text-muted-foreground shrink-0 text-xs w-20 pt-0.5">
                          {formatDate(item.createdAt)}
                        </span>
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3 shadow-sm">
                          {item.kind === "transition" ? (
                            <>
                              <p className="font-medium text-foreground">
                                Trattativa: {getWorkflowConfig(item.request.type).statusLabelByCode[item.transition.fromState] ?? item.transition.fromState} → {getWorkflowConfig(item.request.type).statusLabelByCode[item.transition.toState] ?? item.transition.toState}
                              </p>
                              {item.transition.reason && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.transition.reason}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] text-primary gap-1"
                                  onClick={() => navigate("/requests", { state: { openRequestId: item.requestId } })}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Dettaglio
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] text-primary gap-1"
                                  onClick={() => openCalendarDrawerFromTimelineItem(item)}
                                >
                                  <Calendar className="h-3 w-3" />
                                  Fissa in calendario
                                </Button>
                              </div>
                            </>
                          ) : item.kind === "calendar_event" ? (
                            <>
                              <p className="font-medium text-foreground">{item.event.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(item.event.startsAt)}
                                {item.event.endsAt && ` – ${formatDate(item.event.endsAt)}`}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] text-primary gap-1"
                                  onClick={() => navigate("/calendar")}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Calendario
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] text-primary gap-1"
                                  onClick={() => openCalendarDrawerFromTimelineItem(item)}
                                >
                                  <Calendar className="h-3 w-3" />
                                  Crea evento simile
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-medium text-foreground">
                                {ACTION_TYPE_LABEL[item.action.type]}
                                {item.action.title && `: ${item.action.title}`}
                              </p>
                              {item.action.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{item.action.description}</p>
                              )}
                              {item.action.requestIds.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Trattative collegate:{" "}
                                  {item.action.requestIds
                                    .filter((id) => requestIdsSet.has(id))
                                    .map((id, i) => {
                                      const req = requests.find((r) => r._id === id);
                                      return req ? (
                                        <span key={id}>
                                          {i > 0 && ", "}
                                          <button
                                            type="button"
                                            className="text-primary hover:underline"
                                            onClick={() => navigate("/requests", { state: { openRequestId: id } })}
                                          >
                                            {req.apartmentCode ?? id.slice(0, 8)}
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[11px] text-primary gap-1"
                                  onClick={() => openCalendarDrawerFromTimelineItem(item)}
                                >
                                  <Calendar className="h-3 w-3" />
                                  Fissa in calendario
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => openActionDrawerEdit(item.action)}>
                                  Modifica
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[11px] text-destructive hover:text-destructive"
                                  disabled={deletingActionId === item.action._id}
                                  onClick={() => handleDeleteAction(item.action._id)}
                                >
                                  {deletingActionId === item.action._id ? "Eliminazione..." : "Elimina"}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>

        {/* Tab Documenti — documenti cliente (proposta, contratto), upload e link condiviso */}
        <TabsContent value="documenti" className="space-y-4 mt-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Documenti cliente
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Carica proposte, contratti o altri documenti. Visibilità &quot;cliente&quot;: il cliente può vedere il documento (es. via link con scadenza 7 giorni).
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Select value={documentVisibility} onValueChange={(v) => setDocumentVisibility(v as "internal" | "client")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Visibilità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Solo interno</SelectItem>
                  <SelectItem value="client">Visibile al cliente</SelectItem>
                </SelectContent>
              </Select>
              <FileUpload
                title={documentUploading ? "Caricamento…" : "Carica documento"}
                onFilesSelected={handleDocumentFilesSelected}
                accept="application/pdf,.pdf"
                multiple
                disabled={documentUploading}
              />
              {documentUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {clientDocumentsLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento documenti…
              </p>
            ) : clientDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>
            ) : (
              <ul className="space-y-2">
                {clientDocuments.map((doc) => (
                  <li
                    key={doc._id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} • {doc.visibility === "client" ? "Visibile al cliente" : "Solo interno"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={async () => {
                          const res = await followupApi.getClientDocumentDownloadUrl(workspaceId!, clientId!, doc._id);
                          window.open(res.downloadUrl, "_blank");
                        }}
                      >
                        Scarica
                      </Button>
                      {doc.visibility === "client" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          disabled={shareLinkDocId === doc._id}
                          onClick={async () => {
                            setShareLinkDocId(doc._id);
                            try {
                              const res = await followupApi.getClientDocumentShareLink(workspaceId!, clientId!, doc._id);
                              await navigator.clipboard.writeText(res.downloadUrl);
                              toastSuccess("Link (7 giorni) copiato negli appunti");
                            } catch (e) {
                              toastError(e instanceof Error ? e.message : "Errore link");
                            } finally {
                              setShareLinkDocId(null);
                            }
                          }}
                        >
                          {shareLinkDocId === doc._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                          Invia link
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!window.confirm("Eliminare questo documento?")) return;
                          try {
                            await followupApi.deleteClientDocument(workspaceId!, clientId!, doc._id);
                            loadClientDocuments();
                          } catch (e) {
                            toastError(e instanceof Error ? e.message : "Errore eliminazione");
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* Drawer Nuova / Modifica azione (tab Timeline) */}
      <Drawer open={actionDrawerOpen} onOpenChange={setActionDrawerOpen}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{actionDrawerMode === "edit" ? "Modifica azione" : "Nuova azione"}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleActionFormSubmit} id="timeline-action-form">
            <DrawerBody className="space-y-4">
              {actionFormError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionFormError}</p>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo</label>
                <Select value={actionFormType} onValueChange={(v) => setActionFormType(v as RequestActionType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ACTION_TYPE_LABEL) as [RequestActionType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Titolo (opzionale)</label>
                <Input
                  className="w-full"
                  value={actionFormTitle}
                  onChange={(e) => setActionFormTitle(e.target.value)}
                  placeholder="Es. Chiamata di follow-up"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Descrizione (opzionale)</label>
                <Textarea
                  className="min-h-[80px] w-full"
                  value={actionFormDescription}
                  onChange={(e) => setActionFormDescription(e.target.value)}
                  placeholder="Note..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Trattative collegate</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {actionFormRequestIds.map((rid) => {
                    const req = requests.find((r) => r._id === rid);
                    return (
                      <span
                        key={rid}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs"
                      >
                        {req?.apartmentCode ?? req?.clientName ?? rid.slice(0, 8)}
                        <button
                          type="button"
                          className="rounded hover:bg-muted"
                          onClick={() => removeRequestIdFromActionForm(rid)}
                          disabled={actionFormRequestIds.length <= 1}
                          aria-label="Rimuovi"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <Select
                  value="_add"
                  onValueChange={(v) => {
                    if (v && v !== "_add") addRequestIdToActionForm(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aggiungi trattativa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_add" disabled>
                      Aggiungi trattativa...
                    </SelectItem>
                    {requests
                      .filter((r) => !actionFormRequestIds.includes(r._id))
                      .map((r) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.apartmentCode ?? r.clientId ?? r._id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    {requests.filter((r) => !actionFormRequestIds.includes(r._id)).length === 0 && (
                      <SelectItem value="_none" disabled>
                        Tutte le trattative già collegate
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button type="button" variant="outline" onClick={() => setActionDrawerOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" form="timeline-action-form" disabled={actionFormSaving}>
                {actionFormSaving ? "Salvataggio..." : actionDrawerMode === "edit" ? "Salva" : "Crea azione"}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <CalendarEventFormDrawer
        mode="create"
        event={null}
        defaultDate={moment()}
        workspaceId={workspaceId ?? ""}
        projectIds={client?.projectId ? [client.projectId] : selectedProjectIds}
        projects={projects}
        open={calendarDrawerOpen}
        onClose={() => setCalendarDrawerOpen(false)}
        onSaved={() => {
          setCalendarEventsRefreshKey((k) => k + 1);
          setCalendarDrawerOpen(false);
        }}
        prefill={calendarDrawerPrefill}
        drawerTitle="Fissa in calendario"
        readOnlyClientAndProject
      />
    </div>
  );
};
