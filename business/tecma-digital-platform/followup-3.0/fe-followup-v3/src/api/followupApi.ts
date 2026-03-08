import { deleteJson, getJson, patchJson, postJson, putJson, setTokens } from "./http";
import type {
  AdditionalInfoCreateInput,
  AdditionalInfoRow,
  ApartmentCreateInput,
  ApartmentRow,
  AssociationCreateInput,
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
  PaginatedResponse,
  ProjectAccessResponse,
  RequestRow,
  RequestCreateInput,
  UserPreferences,
  WorkspaceProjectRow,
  WorkspaceRow
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
  // Projects (admin)
  createProject: (payload: { name: string; displayName?: string; mode?: "rent" | "sell" }) =>
    postJson<{ project: { id: string; name: string; displayName: string; mode: "rent" | "sell" } }>("/projects", payload),
  // Project config (dettaglio, policies, email, pdf)
  getProjectDetail: (projectId: string, workspaceId: string) =>
    getJson<{ id: string; name: string; displayName: string; mode: "rent" | "sell"; city?: string; payoff?: string }>(
      `/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  getProjectPolicies: (projectId: string, workspaceId: string) =>
    getJson<{ projectId: string; privacyPolicyUrl?: string; termsUrl?: string; content?: string; updatedAt: string }>(
      `/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  putProjectPolicies: (projectId: string, workspaceId: string, payload: { privacyPolicyUrl?: string; termsUrl?: string; content?: string }) =>
    putJson<{ projectId: string; privacyPolicyUrl?: string; termsUrl?: string; content?: string; updatedAt: string }>(
      `/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`,
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
    reportType: "pipeline" | "clients_by_status" | "apartments_by_availability",
    body: { workspaceId: string; projectIds: string[]; dateFrom?: string; dateTo?: string }
  ) =>
    postJson<{ data: Array<Record<string, unknown>> }>(`/reports/${reportType}`, body),
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
  createAdditionalInfo: (payload: AdditionalInfoCreateInput) =>
    postJson<{ additionalInfo: AdditionalInfoRow }>("/additional-infos", payload),
  updateAdditionalInfo: (id: string, payload: Partial<AdditionalInfoCreateInput>) =>
    patchJson<{ additionalInfo: AdditionalInfoRow }>(`/additional-infos/${id}`, payload),
  deleteAdditionalInfo: (id: string) => deleteJson<{ deleted: boolean }>(`/additional-infos/${id}`),
  getWorkflowConfig: (workspaceId: string, projectId: string, flowType: "rent" | "sell" = "sell") =>
    getJson<{ flowType: "rent" | "sell"; states: Array<{ id: string; label?: string; isTerminal?: boolean }>; transitions: Array<{ fromState: string; toState: string; event: string }>; version?: number }>(
      `/workflow/config?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}&flowType=${flowType}`
    ),
  createRequest: (payload: RequestCreateInput) => postJson<{ request: RequestRow }>("/requests", payload),
  updateRequestStatus: (requestId: string, payload: { status: string; reason?: string; quoteId?: string }) =>
    patchJson<{ request: RequestRow }>(`/requests/${requestId}/status`, payload),
  getProjectsByEmail: (email: string) => postJson<ProjectAccessResponse>("/session/projects-by-email", { email }),
  getUserPreferences: (email: string) =>
    getJson<UserPreferences>(`/session/preferences?email=${encodeURIComponent(email)}`),
  saveUserPreferences: (email: string, workspaceId: string, selectedProjectIds: string[]) =>
    postJson<UserPreferences>("/session/preferences", { email, workspaceId, selectedProjectIds }),
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
    })
};
