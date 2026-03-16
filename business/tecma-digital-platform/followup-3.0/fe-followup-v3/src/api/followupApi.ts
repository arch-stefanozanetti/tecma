import { deleteJson, getJson, getAccessToken, API_BASE_URL, patchJson, postJson, putJson, setTokens } from "./http";
import type {
  AdditionalInfoCreateInput,
  AdditionalInfoRow,
  ApartmentCreateInput,
  ApartmentRow,
  AssociationCreateInput,
  AutomationRuleRow,
  CalendarEvent,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  ClientRow,
  ClientCreateInput,
  ClientUpdateInput,
  CompleteFlowPayload,
  ConfigurationTemplateSchema,
  AiSuggestion,
  AiActionDraft,
  HCApartmentConfig,
  HCMasterEntity,
  HCMasterEntityRecord,
  ListQuery,
  NotificationRow,
  PaginatedResponse,
  ProjectAccessResponse,
  RequestRow,
  RequestTransitionRow,
  RequestActionRow,
  RequestActionType,
  RequestCreateInput,
  UserPreferences,
  WebhookConfigRow,
  WorkflowRow,
  WorkflowStateRow,
  WorkflowTransitionRow,
  WorkflowWithDetail,
  WorkflowType,
  ApartmentLockType,
  WorkspaceProjectRow,
  WorkspaceRow,
  WorkspaceUserRow,
  WorkspaceUserRole,
  UserWithVisibilityRow,
  CustomerNeedRow,
  OpportunityRow,
  InitiativeRow,
  FeatureRow,
} from "../types/domain";

export const followupApi = {
  queryCalendar: (query: ListQuery) => postJson<PaginatedResponse<CalendarEvent>>("/calendar/events/query", query),
  createCalendarEvent: (payload: CalendarEventCreateInput) =>
    postJson<{ event: CalendarEvent }>("/calendar/events", payload),
  updateCalendarEvent: (eventId: string, payload: CalendarEventUpdateInput) =>
    patchJson<{ event: CalendarEvent }>(`/calendar/events/${eventId}`, payload),
  deleteCalendarEvent: (eventId: string) =>
    deleteJson<{ deleted: boolean }>(`/calendar/events/${eventId}`),
  queryClients: (query: ListQuery) => postJson<PaginatedResponse<ClientRow>>("/clients/query", query),
  createClient: (payload: ClientCreateInput) => postJson<{ client: ClientRow }>("/clients", payload),
  updateClient: (clientId: string, payload: ClientUpdateInput) =>
    patchJson<{ client: ClientRow }>(`/clients/${clientId}`, payload),
  getClientById: (clientId: string) => getJson<{ client: ClientRow }>(`/clients/${clientId}`),
  createClientAction: (clientId: string, type: "mail_received" | "mail_sent" | "call_completed" | "meeting_scheduled") =>
    postJson<{ action: { _id: string; type: string; at: string } }>(`/clients/${clientId}/actions`, { type }),
  getApartmentCandidates: (apartmentId: string, workspaceId: string, projectIds: string[]) =>
    getJson<{ data: Array<{ item: Pick<ApartmentRow, "_id" | "code" | "name" | "status" | "mode" | "surfaceMq" | "updatedAt">; score: number; reasons: string[] }> }>(
      `/matching/apartments/${apartmentId}/candidates?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}`
    ),
  getClientCandidates: (clientId: string, workspaceId: string, projectIds: string[]) =>
    getJson<{ data: Array<{ item: Pick<ClientRow, "_id" | "fullName" | "email" | "status" | "city">; score: number; reasons: string[] }> }>(
      `/matching/clients/${clientId}/candidates?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}`
    ),
  getMatchingApartmentCandidates: (
    apartmentId: string,
    workspaceId: string,
    projectIds: string[],
    limit?: number
  ) =>
    getJson<{ data: Array<{ item: ClientRow; score: number; reasons: string[] }> }>(
      `/matching/apartments/${apartmentId}/candidates?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}${limit != null ? `&limit=${limit}` : ""}`
    ),
  getMatchingClientCandidates: (
    clientId: string,
    workspaceId: string,
    projectIds: string[],
    limit?: number
  ) =>
    getJson<{ data: Array<{ item: ApartmentRow; score: number; reasons: string[] }> }>(
      `/matching/clients/${clientId}/candidates?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}${limit != null ? `&limit=${limit}` : ""}`
    ),
  getClientRequests: (
    clientId: string,
    workspaceId: string,
    projectIds: string[],
    page = 1,
    perPage = 50
  ) =>
    getJson<PaginatedResponse<RequestRow>>(
      `/clients/${clientId}/requests?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&page=${page}&perPage=${perPage}`
    ),
  queryApartments: (query: ListQuery) => postJson<PaginatedResponse<ApartmentRow>>("/apartments/query", query),
  queryRequests: (query: ListQuery) => postJson<PaginatedResponse<RequestRow>>("/requests/query", query),
  getRequestById: (id: string) => getJson<{ request: RequestRow }>(`/requests/${id}`),
  getRequestTransitions: (requestId: string) =>
    getJson<{ transitions: RequestTransitionRow[] }>(`/requests/${requestId}/transitions`),
  revertRequestStatus: (requestId: string, transitionId: string) =>
    postJson<{ request: RequestRow }>(`/requests/${requestId}/revert`, { transitionId }),
  getRequestActions: (workspaceId: string, requestId?: string) =>
    getJson<{ actions: RequestActionRow[] }>(
      `/requests/actions?workspaceId=${encodeURIComponent(workspaceId)}${requestId ? `&requestId=${encodeURIComponent(requestId)}` : ""}`
    ),
  createRequestAction: (payload: {
    workspaceId: string;
    requestIds: string[];
    type: RequestActionType;
    title?: string;
    description?: string;
  }) => postJson<{ action: RequestActionRow }>("/requests/actions", payload),
  updateRequestAction: (
    actionId: string,
    payload: { requestIds?: string[]; type?: RequestActionType; title?: string; description?: string }
  ) => patchJson<{ action: RequestActionRow }>(`/requests/actions/${actionId}`, payload),
  deleteRequestAction: (actionId: string) =>
    deleteJson<{ deleted: boolean }>(`/requests/actions/${actionId}`),
  // Projects (admin)
  createProject: (payload: {
    name: string;
    displayName?: string;
    mode?: "rent" | "sell";
    city?: string;
    payoff?: string;
    contactEmail?: string;
    contactPhone?: string;
    projectUrl?: string;
    customDomain?: string;
    defaultLang?: string;
    hostKey?: string;
    assetKey?: string;
    feVendorKey?: string;
    automaticQuoteEnabled?: boolean;
    accountManagerEnabled?: boolean;
    hasDAS?: boolean;
    broker?: string | null;
    iban?: string;
  }) =>
    postJson<{ project: { id: string; name: string; displayName: string; mode: "rent" | "sell" } }>("/projects", payload),
  // Project config (dettaglio, policies, email, pdf)
  getProjectDetail: (projectId: string, workspaceId: string) =>
    getJson<{
      id: string; name: string; displayName: string; mode: "rent" | "sell";
      city?: string; payoff?: string;
      contactEmail?: string; contactPhone?: string; projectUrl?: string;
      customDomain?: string; defaultLang?: string;
      hostKey?: string; assetKey?: string; feVendorKey?: string;
      automaticQuoteEnabled?: boolean; accountManagerEnabled?: boolean; hasDAS?: boolean;
      broker?: string | null; iban?: string;
      archived?: boolean; createdAt?: string; updatedAt?: string;
    }>(
      `/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  updateProject: (
    projectId: string,
    workspaceId: string,
    payload: {
      name?: string; displayName?: string; mode?: "rent" | "sell";
      city?: string; payoff?: string;
      contactEmail?: string; contactPhone?: string; projectUrl?: string;
      customDomain?: string; defaultLang?: string;
      hostKey?: string; assetKey?: string; feVendorKey?: string;
      automaticQuoteEnabled?: boolean; accountManagerEnabled?: boolean; hasDAS?: boolean;
      broker?: string | null; iban?: string;
    }
  ) =>
    patchJson<{ id: string; name: string; displayName: string; mode: "rent" | "sell" }>(
      `/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectPolicies: (projectId: string, workspaceId: string) =>
    getJson<{ projectId: string; privacyPolicyUrl?: string; termsUrl?: string; content?: string; legalNotes?: string; updatedAt: string }>(
      `/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  putProjectPolicies: (projectId: string, workspaceId: string, payload: { privacyPolicyUrl?: string; termsUrl?: string; content?: string; legalNotes?: string }) =>
    putJson<{ projectId: string; privacyPolicyUrl?: string; termsUrl?: string; content?: string; legalNotes?: string; updatedAt: string }>(
      `/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectBranding: (projectId: string, workspaceId: string) =>
    getJson<{ projectId: string; logoUrl?: string; primaryColor?: string; footerText?: string; updatedAt: string }>(
      `/projects/${projectId}/branding?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  putProjectBranding: (projectId: string, workspaceId: string, payload: { logoUrl?: string; primaryColor?: string; footerText?: string }) =>
    putJson<{ projectId: string; logoUrl?: string; primaryColor?: string; footerText?: string; updatedAt: string }>(
      `/projects/${projectId}/branding?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectEmailConfig: (projectId: string, workspaceId: string) =>
    getJson<{ projectId: string; smtpHost?: string; smtpPort?: number; fromEmail?: string; defaultTemplateId?: string; updatedAt: string }>(
      `/projects/${projectId}/email-config?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  putProjectEmailConfig: (
    projectId: string,
    workspaceId: string,
    payload: { smtpHost?: string; smtpPort?: number; fromEmail?: string; defaultTemplateId?: string }
  ) =>
    putJson<{ projectId: string; smtpHost?: string; smtpPort?: number; fromEmail?: string; defaultTemplateId?: string; updatedAt: string }>(
      `/projects/${projectId}/email-config?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  listProjectEmailTemplates: (projectId: string, workspaceId: string) =>
    getJson<Array<{ _id: string; projectId: string; name: string; subject: string; bodyHtml: string; bodyText?: string; createdAt: string; updatedAt: string }>>(
      `/projects/${projectId}/email-templates?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  createProjectEmailTemplate: (
    projectId: string,
    workspaceId: string,
    payload: { name: string; subject: string; bodyHtml: string; bodyText?: string }
  ) =>
    postJson<{ _id: string; projectId: string; name: string; subject: string; bodyHtml: string; bodyText?: string; createdAt: string; updatedAt: string }>(
      `/projects/${projectId}/email-templates?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectEmailTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    getJson<{ _id: string; projectId: string; name: string; subject: string; bodyHtml: string; bodyText?: string; createdAt: string; updatedAt: string }>(
      `/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  patchProjectEmailTemplate: (
    projectId: string,
    templateId: string,
    workspaceId: string,
    payload: { name?: string; subject?: string; bodyHtml?: string; bodyText?: string }
  ) =>
    patchJson<{ _id: string; projectId: string; name: string; subject: string; bodyHtml: string; bodyText?: string; createdAt: string; updatedAt: string }>(
      `/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  deleteProjectEmailTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`),
  listProjectPdfTemplates: (projectId: string, workspaceId: string) =>
    getJson<Array<{ _id: string; projectId: string; name: string; templateKey: string; config: Record<string, unknown>; updatedAt: string }>>(
      `/projects/${projectId}/pdf-templates?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  createProjectPdfTemplate: (
    projectId: string,
    workspaceId: string,
    payload: { name: string; templateKey: string; config?: Record<string, unknown> }
  ) =>
    postJson<{ _id: string; projectId: string; name: string; templateKey: string; config: Record<string, unknown>; updatedAt: string }>(
      `/projects/${projectId}/pdf-templates?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectPdfTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    getJson<{ _id: string; projectId: string; name: string; templateKey: string; config: Record<string, unknown>; updatedAt: string }>(
      `/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  patchProjectPdfTemplate: (
    projectId: string,
    templateId: string,
    workspaceId: string,
    payload: { name?: string; config?: Record<string, unknown> }
  ) =>
    patchJson<{ _id: string; projectId: string; name: string; templateKey: string; config: Record<string, unknown>; updatedAt: string }>(
      `/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  deleteProjectPdfTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`),
  runReport: (
    reportType:
      | "pipeline"
      | "clients_by_status"
      | "apartments_by_availability"
      | "activity_per_period"
      | "conversions_per_project"
      | "avg_times",
    body: { workspaceId: string; projectIds: string[]; dateFrom?: string; dateTo?: string }
  ) =>
    postJson<{ data: Array<Record<string, unknown>> }>(`/reports/${reportType}`, body),
  getAuditForEntity: (
    entityType: string,
    entityId: string,
    workspaceId: string,
    limit?: number
  ) =>
    getJson<{
      data: Array<{
        _id: string;
        at: string;
        action: string;
        entityType: string;
        entityId: string;
        actor: { type: string; userId?: string; email?: string };
        payload?: Record<string, unknown>;
      }>;
      pagination: { page: number; perPage: number; total: number; totalPages: number };
    }>(
      `/audit/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?workspaceId=${encodeURIComponent(workspaceId)}${limit != null ? `&limit=${limit}` : ""}`
    ),
  queryAuditLog: (query: {
    workspaceId: string;
    projectId?: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }) =>
    postJson<{
      data: Array<{
        _id: string;
        at: string;
        action: string;
        workspaceId: string;
        projectId?: string;
        entityType: string;
        entityId: string;
        actor: { type: string; userId?: string; email?: string };
        payload?: Record<string, unknown>;
      }>;
      pagination: { page: number; perPage: number; total: number; totalPages: number };
    }>("/audit/query", query),
  // Workspaces (tz_workspaces)
  listUsersWithVisibility: () => getJson<{ users: UserWithVisibilityRow[] }>("/users"),
  listWorkspaces: () => getJson<WorkspaceRow[]>("/workspaces"),
  getWorkspaceById: (id: string) => getJson<{ workspace: WorkspaceRow }>(`/workspaces/${id}`),
  createWorkspace: (payload: { name: string }) => postJson<{ workspace: WorkspaceRow }>("/workspaces", payload),
  updateWorkspace: (id: string, payload: { name?: string }) =>
    patchJson<{ workspace: WorkspaceRow }>(`/workspaces/${id}`, payload),
  deleteWorkspace: (id: string) => deleteJson<{ deleted: boolean }>(`/workspaces/${id}`),
  listWorkspaceProjects: (workspaceId: string) =>
    getJson<{ data: WorkspaceProjectRow[] }>(`/workspaces/${workspaceId}/projects`),
  associateProjectToWorkspace: (payload: { workspaceId: string; projectId: string }) =>
    postJson<{ workspaceId: string; projectId: string }>("/workspaces/projects/associate", payload),
  dissociateProjectFromWorkspace: (workspaceId: string, projectId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${workspaceId}/projects/${projectId}`),
  listAdditionalInfos: (workspaceId: string) =>
    getJson<{ data: AdditionalInfoRow[] }>(`/workspaces/${workspaceId}/additional-infos`),
  listWorkspaceUsers: (workspaceId: string) =>
    getJson<{ data: WorkspaceUserRow[] }>(`/workspaces/${workspaceId}/users`),
  addWorkspaceUser: (workspaceId: string, payload: { userId: string; role: WorkspaceUserRole }) =>
    postJson<{ workspaceUser: WorkspaceUserRow }>(`/workspaces/${workspaceId}/users`, payload),
  updateWorkspaceUser: (workspaceId: string, userId: string, payload: { role?: WorkspaceUserRole }) =>
    patchJson<{ workspaceUser: WorkspaceUserRow }>(`/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}`, payload),
  removeWorkspaceUser: (workspaceId: string, userId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}`),
  listWorkspaceUserProjects: (workspaceId: string, userId: string) =>
    getJson<{ data: string[] }>(`/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}/projects`),
  addWorkspaceUserProject: (workspaceId: string, userId: string, projectId: string) =>
    postJson<{ row: { _id: string; workspaceId: string; userId: string; projectId: string } }>(
      `/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}/projects`,
      { projectId }
    ),
  removeWorkspaceUserProject: (workspaceId: string, userId: string, projectId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/workspaces/${workspaceId}/users/${encodeURIComponent(userId)}/projects/${encodeURIComponent(projectId)}`
    ),
  listEntityAssignments: (workspaceId: string, entityType: "client" | "apartment", entityId: string) =>
    getJson<{
      data: Array<{ _id: string; workspaceId: string; entityType: string; entityId: string; userId: string }>;
    }>(`/workspaces/${workspaceId}/entities/${entityType}/${encodeURIComponent(entityId)}/assignments`),
  listEntityAssignmentsByUser: (workspaceId: string, userId: string) =>
    getJson<{
      data: Array<{ _id: string; workspaceId: string; entityType: string; entityId: string; userId: string }>;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/users/${encodeURIComponent(userId)}/assignments`),
  assignEntity: (workspaceId: string, entityType: "client" | "apartment", entityId: string, userId: string) =>
    postJson<{ assignment: { _id: string } }>(
      `/workspaces/${workspaceId}/entities/${entityType}/${encodeURIComponent(entityId)}/assignments`,
      { userId }
    ),
  unassignEntity: (
    workspaceId: string,
    entityType: "client" | "apartment",
    entityId: string,
    userId: string
  ) =>
    deleteJson<{ deleted: boolean }>(
      `/workspaces/${workspaceId}/entities/${entityType}/${encodeURIComponent(entityId)}/assignments/${encodeURIComponent(userId)}`
    ),
  createAdditionalInfo: (payload: AdditionalInfoCreateInput) =>
    postJson<{ additionalInfo: AdditionalInfoRow }>("/additional-infos", payload),
  updateAdditionalInfo: (id: string, payload: Partial<AdditionalInfoCreateInput>) =>
    patchJson<{ additionalInfo: AdditionalInfoRow }>(`/additional-infos/${id}`, payload),
  deleteAdditionalInfo: (id: string) => deleteJson<{ deleted: boolean }>(`/additional-infos/${id}`),
  getWorkflowConfig: (workspaceId: string, projectId: string, flowType: "rent" | "sell" = "sell") =>
    getJson<{ flowType: "rent" | "sell"; states: Array<{ id: string; label?: string; isTerminal?: boolean }>; transitions: Array<{ fromState: string; toState: string; event: string }>; version?: number }>(
      `/workflow/config?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}&flowType=${flowType}`
    ),
  listWorkflowsByWorkspace: (workspaceId: string) =>
    getJson<{ workflows: WorkflowRow[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/workflows`),
  getWorkflowWithStatesAndTransitions: (workflowId: string) =>
    getJson<WorkflowWithDetail>(`/workflows/${encodeURIComponent(workflowId)}`),
  createWorkflow: (payload: { workspaceId: string; name: string; type: WorkflowType }) =>
    postJson<{ workflow: WorkflowRow }>("/workflows", payload),
  createWorkflowState: (payload: {
    workflowId: string;
    code: string;
    label: string;
    order: number;
    terminal?: boolean;
    reversible?: boolean;
    apartmentLock?: ApartmentLockType;
  }) => postJson<{ state: WorkflowStateRow }>("/workflows/states", payload),
  createWorkflowTransition: (payload: { workflowId: string; fromStateId: string; toStateId: string }) =>
    postJson<{ transition: WorkflowTransitionRow }>("/workflows/transitions", payload),
  createRequest: (payload: RequestCreateInput) => postJson<{ request: RequestRow }>("/requests", payload),
  updateRequestStatus: (requestId: string, payload: { status: string; reason?: string; quoteId?: string }) =>
    patchJson<{ request: RequestRow }>(`/requests/${requestId}/status`, payload),
  getProjectsByEmail: (email: string) => postJson<ProjectAccessResponse>("/session/projects-by-email", { email }),
  getUserPreferences: (email: string) =>
    getJson<UserPreferences>(`/session/preferences?email=${encodeURIComponent(email)}`),
  saveUserPreferences: (email: string, workspaceId: string, selectedProjectIds: string[]) =>
    postJson<UserPreferences>("/session/preferences", { email, workspaceId, selectedProjectIds }),
  getNotifications: (
    workspaceId: string,
    params?: { read?: boolean; type?: string; dateFrom?: string; dateTo?: string; page?: number; perPage?: number }
  ) => {
    const q = new URLSearchParams({ workspaceId });
    if (params?.read !== undefined) q.set("read", String(params.read));
    if (params?.type) q.set("type", params.type);
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.perPage !== undefined) q.set("perPage", String(params.perPage));
    return getJson<PaginatedResponse<NotificationRow>>(`/notifications?${q.toString()}`);
  },
  markNotificationRead: (id: string) =>
    patchJson<{ notification: NotificationRow }>(`/notifications/${id}`, { read: true }),
  markAllNotificationsRead: (workspaceId: string) =>
    postJson<{ count: number }>("/notifications/read-all", { workspaceId }),
  listAutomationRules: (workspaceId: string) =>
    getJson<{ data: AutomationRuleRow[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/automation-rules`),
  createAutomationRule: (workspaceId: string, payload: Omit<AutomationRuleRow, "_id" | "workspaceId" | "createdAt" | "updatedAt">) =>
    postJson<{ rule: AutomationRuleRow }>(`/workspaces/${encodeURIComponent(workspaceId)}/automation-rules`, payload),
  updateAutomationRule: (id: string, payload: Partial<Pick<AutomationRuleRow, "name" | "enabled" | "trigger" | "actions">>) =>
    patchJson<{ rule: AutomationRuleRow }>(`/automation-rules/${encodeURIComponent(id)}`, payload),
  deleteAutomationRule: (id: string) =>
    deleteJson<{ deleted: boolean }>(`/automation-rules/${encodeURIComponent(id)}`),
  listWebhookConfigs: (workspaceId: string) =>
    getJson<{ data: WebhookConfigRow[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/webhook-configs`),
  createWebhookConfig: (workspaceId: string, payload: Omit<WebhookConfigRow, "_id" | "workspaceId" | "createdAt" | "updatedAt">) =>
    postJson<{ config: WebhookConfigRow }>(`/workspaces/${encodeURIComponent(workspaceId)}/webhook-configs`, payload),
  updateWebhookConfig: (id: string, payload: Partial<Pick<WebhookConfigRow, "url" | "secret" | "events" | "enabled" | "connectorId">>) =>
    patchJson<{ config: WebhookConfigRow }>(`/webhook-configs/${encodeURIComponent(id)}`, payload),
  deleteWebhookConfig: (id: string) =>
    deleteJson<{ deleted: boolean }>(`/webhook-configs/${encodeURIComponent(id)}`),
  /** Connettore n8n: config (API reale). */
  getN8nConfig: (workspaceId: string) =>
    getJson<{ config: { _id: string; workspaceId: string; connectorId: string; config: { baseUrl: string; apiKeyMasked?: string; defaultWorkflowId?: string }; updatedAt: string } | null }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/n8n/config`
    ),
  saveN8nConfig: (workspaceId: string, body: { baseUrl: string; apiKey: string; defaultWorkflowId?: string }) =>
    postJson<{ config: { _id: string; workspaceId: string; connectorId: string; config: { baseUrl: string; apiKeyMasked?: string; defaultWorkflowId?: string }; updatedAt: string } }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/n8n/config`,
      body
    ),
  triggerN8nWorkflow: (workspaceId: string, body: { workflowId?: string; data?: Record<string, unknown> }) =>
    postJson<{ executionId?: number; waitingForWebhook?: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/n8n/trigger`, body ?? {}),
  deleteN8nConfig: (workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/n8n/config`),
  /** Connettore Outlook (OAuth2). Redirect a Microsoft: usa getOutlookAuthRedirect e poi window.location.href = url. */
  getOutlookAuthRedirect: async (workspaceId?: string): Promise<string> => {
    const token = getAccessToken();
    if (!token) throw new Error("Non autenticato");
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    const res = await fetch(`${API_BASE_URL}/connectors/outlook/auth${q}`, {
      method: "GET",
      redirect: "manual",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 302) {
      const text = await res.text();
      throw new Error(text || `Errore ${res.status} durante avvio connessione Outlook`);
    }
    const loc = res.headers.get("Location");
    if (!loc) throw new Error("Redirect URL mancante");
    return loc;
  },
  getOutlookStatus: () => getJson<{ connected: boolean }>("/connectors/outlook/status"),
  deleteOutlook: (workspaceId?: string) =>
    deleteJson<{ deleted: boolean }>(`/connectors/outlook${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`),
  getOutlookCalendarEvents: (dateFrom: string, dateTo: string, workspaceId?: string) =>
    getJson<{ data: Array<{ id: string; subject: string; start: string; end: string; isAllDay?: boolean; webLink?: string }> }>(
      `/connectors/outlook/calendar/events?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${workspaceId ? `&workspaceId=${encodeURIComponent(workspaceId)}` : ""}`
    ),
  /** Communication templates (Comunicazioni). */
  listCommunicationTemplates: (workspaceId: string, params?: { projectId?: string; channel?: string }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("projectId", params.projectId);
    if (params?.channel) q.set("channel", params.channel);
    const query = q.toString();
    return getJson<{ data: Array<{ _id: string; workspaceId: string; projectId?: string; channel: string; name: string; subject?: string; bodyText: string; bodyHtml?: string; variables: string[]; createdAt: string; updatedAt: string }> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/communication-templates${query ? `?${query}` : ""}`
    );
  },
  createCommunicationTemplate: (workspaceId: string, body: { projectId?: string; channel: string; name: string; subject?: string; bodyText: string; bodyHtml?: string; variables?: string[] }) =>
    postJson<{ template: Record<string, unknown> }>(`/workspaces/${encodeURIComponent(workspaceId)}/communication-templates`, body),
  getCommunicationTemplate: (id: string) => getJson<{ template: Record<string, unknown> }>(`/communication-templates/${encodeURIComponent(id)}`),
  updateCommunicationTemplate: (id: string, body: Record<string, unknown>) =>
    patchJson<{ template: Record<string, unknown> }>(`/communication-templates/${encodeURIComponent(id)}`, body),
  deleteCommunicationTemplate: (id: string) => deleteJson<{ deleted: boolean }>(`/communication-templates/${encodeURIComponent(id)}`),
  /** Communication rules (Comunicazioni). */
  listCommunicationRules: (workspaceId: string, params?: { projectId?: string }) =>
    getJson<{ data: Array<Record<string, unknown>> }>(`/workspaces/${encodeURIComponent(workspaceId)}/communication-rules${params?.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : ""}`),
  createCommunicationRule: (workspaceId: string, body: Record<string, unknown>) =>
    postJson<{ rule: Record<string, unknown> }>(`/workspaces/${encodeURIComponent(workspaceId)}/communication-rules`, body),
  getCommunicationRule: (id: string) => getJson<{ rule: Record<string, unknown> }>(`/communication-rules/${encodeURIComponent(id)}`),
  updateCommunicationRule: (id: string, body: Record<string, unknown>) =>
    patchJson<{ rule: Record<string, unknown> }>(`/communication-rules/${encodeURIComponent(id)}`, body),
  deleteCommunicationRule: (id: string) => deleteJson<{ deleted: boolean }>(`/communication-rules/${encodeURIComponent(id)}`),
  /** Log comunicazioni inviate (Notification Center). */
  listCommunicationDeliveries: (workspaceId: string, limit?: number) =>
    getJson<{ data: Array<{ _id: string; channel: string; templateId: string; recipientMasked: string; status: string; sentAt: string }> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/communication-deliveries${limit != null ? `?limit=${limit}` : ""}`
    ),
  /** WhatsApp config (Twilio) per workspace. */
  getWhatsAppConfig: (workspaceId: string) =>
    getJson<{ config: { _id: string; workspaceId: string; connectorId: string; config: { accountSid: string; authTokenMasked?: string; fromNumber: string }; updatedAt: string } | null }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/whatsapp/config`
    ),
  saveWhatsAppConfig: (workspaceId: string, body: { accountSid: string; authToken: string; fromNumber: string }) =>
    postJson<{ config: Record<string, unknown> }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/whatsapp/config`, body),
  deleteWhatsAppConfig: (workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/whatsapp/config`),
  /** Test API listati pubblici (nessuna auth richiesta lato backend). Per connettore Looker Studio. */
  testPublicListings: (workspaceId: string, projectIds: string[]) =>
    postJson<PaginatedResponse<ApartmentRow>>("/public/listings", {
      workspaceId,
      projectIds,
      page: 1,
      perPage: 5,
    }),
  login: (email: string, password: string) =>
    postJson<{
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: { id: string; email: string; role: string | null; isAdmin: boolean };
    }>("/auth/login", { email, password }),
  me: () => getJson<{ id: string; email: string; role: string | null; isAdmin: boolean }>("/auth/me"),
  ssoExchange: (ssoJwt: string) =>
    postJson<{
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: { id: string; email: string; role: string | null; isAdmin: boolean };
    }>("/auth/sso-exchange", { ssoJwt }),
  refresh: (refreshToken: string) =>
    postJson<{ accessToken: string; refreshToken?: string; expiresIn?: string }>("/auth/refresh", { refreshToken }),
  logout: (refreshToken: string) => postJson<void>("/auth/logout", { refreshToken }),
  createApartment: (payload: ApartmentCreateInput) => postJson<{ apartmentId: string; apartment: ApartmentRow }>("/apartments", payload),
  updateApartment: (apartmentId: string, payload: Partial<ApartmentCreateInput>) =>
    patchJson<{ apartment: ApartmentRow }>(`/apartments/${apartmentId}`, payload),
  getApartmentById: (apartmentId: string) => getJson<{ apartment: ApartmentRow }>(`/apartments/${apartmentId}`),
  getApartmentPrices: (apartmentId: string) =>
    getJson<{
      current: { source: string; amount: number; currency: string; mode: string; validFrom?: string; validTo?: string; deposit?: number } | null;
      salePrices: Array<{ _id: string; price: number; currency: string; validFrom: string; validTo?: string }>;
      monthlyRents: Array<{ _id: string; pricePerMonth: number; deposit?: number; currency: string; validFrom: string; validTo?: string }>;
    }>(`/apartments/${apartmentId}/prices`),
  getApartmentInventory: (apartmentId: string) =>
    getJson<{
      inventory: { _id: string; unitId: string; inventoryStatus: string; updatedAt: string } | null;
      lock: { requestId: string; type: string } | null;
      effectiveStatus: string;
    }>(`/apartments/${apartmentId}/inventory`),
  createApartmentSalePrice: (
    apartmentId: string,
    body: { workspaceId: string; price: number; currency?: string; validFrom?: string; validTo?: string }
  ) =>
    postJson<{ _id: string; unitId: string; price: number; currency: string; validFrom: string; validTo?: string }>(
      `/apartments/${apartmentId}/prices/sale`,
      body
    ),
  createApartmentMonthlyRent: (
    apartmentId: string,
    body: {
      workspaceId: string;
      pricePerMonth: number;
      deposit?: number;
      currency?: string;
      validFrom?: string;
      validTo?: string;
    }
  ) =>
    postJson<{
      _id: string;
      unitId: string;
      pricePerMonth: number;
      deposit?: number;
      currency: string;
      validFrom: string;
      validTo?: string;
    }>(`/apartments/${apartmentId}/prices/monthly-rent`, body),
  updateApartmentSalePrice: (
    apartmentId: string,
    priceId: string,
    body: { validTo?: string; price?: number }
  ) =>
    patchJson<{ _id: string; unitId: string; price: number; currency: string; validFrom: string; validTo?: string }>(
      `/apartments/${apartmentId}/prices/sale/${priceId}`,
      body
    ),
  updateApartmentMonthlyRent: (
    apartmentId: string,
    rentId: string,
    body: { validTo?: string; pricePerMonth?: number; deposit?: number }
  ) =>
    patchJson<{
      _id: string;
      unitId: string;
      pricePerMonth: number;
      deposit?: number;
      currency: string;
      validFrom: string;
      validTo?: string;
    }>(`/apartments/${apartmentId}/prices/monthly-rent/${rentId}`, body),
  getApartmentPriceCalendar: (apartmentId: string, from: string, to: string) =>
    getJson<Array<{ _id: string; unitId: string; date: string; price: number; minStay?: number; availability?: string }>>(
      `/apartments/${apartmentId}/prices/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  upsertApartmentPriceCalendar: (
    apartmentId: string,
    body: { date: string; price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }
  ) => putJson<{ ok: boolean }>(`/apartments/${apartmentId}/prices/calendar`, body),
  getPriceAvailabilityMatrix: (workspaceId: string, projectIds: string[], from: string, to: string) =>
    getJson<{
      units: Array<{ unitId: string; code: string; name: string; mode?: string }>;
      dates: string[];
      cells: Record<string, Record<string, { price?: number; availability?: string; minStay?: number }>>;
    }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/price-availability?projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  patchApartmentInventory: (apartmentId: string, body: { workspaceId: string; inventoryStatus?: "available" | "locked" | "reserved" | "sold" }) =>
    patchJson<{ _id: string; unitId: string; workspaceId: string; inventoryStatus: string; updatedAt: string }>(
      `/apartments/${apartmentId}/inventory`,
      body
    ),
  unitsImportPreview: (workspaceId: string, projectId: string, fileBase64: string) =>
    postJson<{
      validRows: Array<{ unit_code: string; name?: string; floor?: number; size_m2?: number; price?: number; status?: string }>;
      errors: Array<{ rowIndex: number; message: string }>;
      duplicates: Array<{ rowIndex: number; unit_code: string }>;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/units/import/preview`, {
      fileBase64,
      fileName: "import.xlsx",
    }),
  unitsImportExecute: (
    workspaceId: string,
    projectId: string,
    validRows: Array<Record<string, unknown>>,
    onDuplicate: "skip" | "overwrite" | "fail"
  ) =>
    postJson<{ created: number; skipped: number; errors: Array<{ rowIndex: number; unit_code: string; message: string }> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/units/import/execute`,
      { validRows, onDuplicate }
    ),
  getApartmentRequests: (
    apartmentId: string,
    workspaceId: string,
    projectIds: string[],
    page = 1,
    perPage = 50
  ) =>
    getJson<PaginatedResponse<RequestRow>>(
      `/apartments/${apartmentId}/requests?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&page=${page}&perPage=${perPage}`
    ),

  upsertHCApartment: (payload: HCApartmentConfig) => postJson<{ config: HCApartmentConfig }>("/hc/apartments", payload),
  patchHCApartment: (apartmentId: string, payload: Partial<HCApartmentConfig>) =>
    patchJson<{ config: HCApartmentConfig }>(`/hc/apartments/${apartmentId}`, payload),
  getHCApartment: (apartmentId: string) => getJson<{ config: HCApartmentConfig }>(`/hc/apartments/${apartmentId}`),
  queryHCApartments: (query: ListQuery) => postJson<PaginatedResponse<HCApartmentConfig>>("/hc/apartments/query", query),

  createAssociation: (payload: AssociationCreateInput) =>
    postJson<{ association: unknown; created: boolean }>("/associations/apartment-client", payload),
  queryAssociations: (query: ListQuery) => postJson<PaginatedResponse<unknown>>("/associations/query", query),
  deleteAssociation: (associationId: string) => deleteJson<{ deleted: boolean }>(`/associations/${associationId}`),

  previewCompleteFlow: (payload: CompleteFlowPayload) =>
    postJson<{ valid: boolean; steps: string[]; warnings: string[]; summary: Record<string, unknown> }>(
      "/workflows/complete-flow/preview",
      payload
    ),
  executeCompleteFlow: (payload: CompleteFlowPayload) =>
    postJson<{ done: boolean; apartmentId: string }>("/workflows/complete-flow/execute", payload),

  queryHCMaster: (entity: HCMasterEntity, query: ListQuery) =>
    postJson<PaginatedResponse<HCMasterEntityRecord>>(`/hc-master/${entity}/query`, query),
  createHCMaster: (entity: HCMasterEntity, payload: HCMasterEntityRecord) =>
    postJson<{ id: string }>(`/hc-master/${entity}`, payload),
  updateHCMaster: (entity: HCMasterEntity, id: string, payload: Partial<HCMasterEntityRecord>) =>
    patchJson<{ entity: HCMasterEntityRecord }>(`/hc-master/${entity}/${id}`, payload),
  deleteHCMaster: (entity: HCMasterEntity, id: string) => deleteJson<{ deleted: boolean }>(`/hc-master/${entity}/${id}`),

  getTemplateConfiguration: (projectId: string) =>
    getJson<{ projectId: string; template: ConfigurationTemplateSchema }>(
      `/templates/configuration?projectId=${encodeURIComponent(projectId)}`
    ),
  saveTemplateConfiguration: (projectId: string, workspaceId: string, template: ConfigurationTemplateSchema) =>
    putJson<{ saved: boolean }>(`/templates/configuration/${projectId}`, { workspaceId, template }),
  validateTemplateConfiguration: (projectId: string, template: ConfigurationTemplateSchema) =>
    postJson<{ valid: boolean; errors: string[] }>(`/templates/configuration/${projectId}/validate`, { template }),
  queryClientsLite: (workspaceId: string, projectIds: string[]) =>
    postJson<{ data: Array<{ _id: string; fullName: string; email: string; projectId: string }> }>("/clients/lite/query", {
      workspaceId,
      projectIds
    }),
  generateAiSuggestions: (workspaceId: string, projectIds: string[], limit = 20) =>
    postJson<{ generatedAt: string; data: AiSuggestion[] }>("/ai/suggestions", { workspaceId, projectIds, limit }),
  decideAiSuggestion: (suggestionId: string, decision: "approved" | "rejected", actorEmail: string, note = "") =>
    postJson<{ suggestionId: string; decision: string; decidedAt: string }>("/ai/approvals", {
      suggestionId,
      decision,
      actorEmail,
      note
    }),
  createAiActionDraft: (payload: {
    workspaceId: string;
    projectId: string;
    suggestionId: string;
    actionType: "create_task" | "send_reminder";
    title: string;
    message: string;
    target: { clientId?: string; apartmentId?: string };
    dueAt?: string;
  }) => postJson<{ id: string; draft: AiActionDraft }>("/ai/actions/drafts", payload),
  queryAiActionDrafts: (query: ListQuery) =>
    postJson<PaginatedResponse<AiActionDraft>>("/ai/actions/drafts/query", query),
  decideAiActionDraft: (id: string, decision: "approved" | "rejected", actorEmail: string, note = "") =>
    postJson<{ draftId: string; decision: string; executionResult: Record<string, unknown> }>(`/ai/actions/drafts/${id}/decision`, {
      decision,
      actorEmail,
      note
    }),

  // Product Discovery (admin only)
  getCustomerNeeds: (params?: { opportunityId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.opportunityId) q.set("opportunityId", params.opportunityId);
    if (params?.status) q.set("status", params.status);
    const query = q.toString();
    return getJson<CustomerNeedRow[]>(`/customer-needs${query ? `?${query}` : ""}`);
  },
  createCustomerNeed: (payload: Partial<CustomerNeedRow>) => postJson<CustomerNeedRow>("/customer-needs", payload),
  getCustomerNeed: (id: string) => getJson<CustomerNeedRow>(`/customer-needs/${id}`),
  updateCustomerNeed: (id: string, payload: Partial<CustomerNeedRow>) =>
    patchJson<CustomerNeedRow>(`/customer-needs/${id}`, payload),

  getOpportunities: (params?: { initiativeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.initiativeId) q.set("initiativeId", params.initiativeId);
    const query = q.toString();
    return getJson<OpportunityRow[]>(`/opportunities${query ? `?${query}` : ""}`);
  },
  createOpportunity: (payload: Partial<OpportunityRow>) => postJson<OpportunityRow>("/opportunities", payload),
  getOpportunity: (id: string) => getJson<OpportunityRow>(`/opportunities/${id}`),
  updateOpportunity: (id: string, payload: Partial<OpportunityRow>) =>
    patchJson<OpportunityRow>(`/opportunities/${id}`, payload),

  getInitiatives: () => getJson<InitiativeRow[]>("/initiatives"),
  getSuggestedRoadmap: () => getJson<InitiativeRow[]>("/product-discovery/suggested-roadmap"),
  createInitiative: (payload: Partial<InitiativeRow>) => postJson<InitiativeRow>("/initiatives", payload),
  getInitiative: (id: string) => getJson<InitiativeRow>(`/initiatives/${id}`),
  updateInitiative: (id: string, payload: Partial<InitiativeRow>) =>
    patchJson<InitiativeRow>(`/initiatives/${id}`, payload),

  getTopProblems: () => getJson<OpportunityRow[]>("/product-discovery/top-problems"),

  getFeatures: (params?: { initiativeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.initiativeId) q.set("initiativeId", params.initiativeId);
    const query = q.toString();
    return getJson<FeatureRow[]>(`/features${query ? `?${query}` : ""}`);
  },
  createFeature: (payload: Partial<FeatureRow>) => postJson<FeatureRow>("/features", payload),
  getFeature: (id: string) => getJson<FeatureRow>(`/features/${id}`),
  updateFeature: (id: string, payload: Partial<FeatureRow>) =>
    patchJson<FeatureRow>(`/features/${id}`, payload),
};
