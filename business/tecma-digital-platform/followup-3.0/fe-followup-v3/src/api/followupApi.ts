import {
  deleteJson,
  getJson,
  getAccessToken,
  API_BASE_URL,
  HttpApiError,
  patchJson,
  postJson,
  postFormData,
  putJson,
  setTokens
} from "./http";

/** Utente sessione come restituito da login / MFA verify. */
export type FollowupAuthUser = {
  id: string;
  email: string;
  role: string | null;
  isAdmin: boolean;
  permissions?: string[];
  projectId?: string | null;
  system_role?: string;
  isTecmaAdmin?: boolean;
  mfaEnabled?: boolean;
};

export type FollowupLoginResponse =
  | { mfaRequired: true; mfaToken: string; expiresIn?: string }
  | {
      mfaRequired: false;
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: FollowupAuthUser;
    };

async function postAuthLogin(email: string, password: string): Promise<FollowupLoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password })
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (!res.ok) {
      throw new HttpApiError(text || `Errore HTTP ${res.status}`, { status: res.status });
    }
    throw new Error(text || "Risposta di login non valida");
  }
  const p = parsed as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof p.error === "string" && p.error.length > 0 ? p.error : text || `Errore HTTP ${res.status}`;
    throw new HttpApiError(msg, {
      status: res.status,
      code: typeof p.code === "string" ? p.code : undefined,
      hint: typeof p.hint === "string" ? p.hint : undefined
    });
  }
  if (p.mfaRequired === true) {
    const mfaToken = typeof p.mfaToken === "string" ? p.mfaToken : "";
    if (!mfaToken) throw new Error("Risposta MFA incompleta dal server");
    return {
      mfaRequired: true,
      mfaToken,
      expiresIn: typeof p.expiresIn === "string" ? p.expiresIn : undefined
    };
  }
  const user = p.user as FollowupAuthUser;
  return {
    mfaRequired: false,
    accessToken: String(p.accessToken ?? ""),
    refreshToken: String(p.refreshToken ?? ""),
    expiresIn: typeof p.expiresIn === "string" ? p.expiresIn : undefined,
    user
  };
}
import type {
  AdditionalInfoCreateInput,
  AdditionalInfoRow,
  ApartmentRow,
  AssociationCreateInput,
  AutomationRuleRow,
  CalendarEvent,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  ClientRow,
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
  ProjectAccessRow,
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
  WorkspaceAiConfig,
  WorkspaceEntitlementEffectiveRow,
  WorkspaceEntitlementFeature,
  WorkspaceEntitlementRow,
  WorkspaceEntitlementStatus,
  WorkspaceProjectRow,
  WorkspaceRow,
  WorkspaceUserRow,
  AssetRow,
  ClientDocumentRow,
  WorkspaceUserRole,
  AccessScope,
  UserWithVisibilityRow,
  CustomerNeedRow,
  OpportunityRow,
  InitiativeRow,
  FeatureRow,
} from "../types/domain";
import { clientsApi } from "./domains/clientsApi";
import { apartmentsApi } from "./domains/apartmentsApi";
import { requestsApi } from "./domains/requestsApi";

export const followupApi = {
  clients: clientsApi,
  apartments: apartmentsApi,
  requests: requestsApi,
  /** @deprecated Usa followupApi.apartments.queryApartments */
  queryApartments: apartmentsApi.queryApartments,
  getApartmentPriceCalendar: apartmentsApi.getApartmentPriceCalendar,
  upsertApartmentPriceCalendar: apartmentsApi.upsertApartmentPriceCalendar,
  queryCalendar: (query: ListQuery) => postJson<PaginatedResponse<CalendarEvent>>("/calendar/events/query", query),
  createCalendarEvent: (payload: CalendarEventCreateInput) =>
    postJson<{ event: CalendarEvent }>("/calendar/events", payload),
  updateCalendarEvent: (eventId: string, payload: CalendarEventUpdateInput) =>
    patchJson<{ event: CalendarEvent }>(`/calendar/events/${eventId}`, payload),
  deleteCalendarEvent: (eventId: string) =>
    deleteJson<{ deleted: boolean }>(`/calendar/events/${eventId}`),
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
      | "kpi_summary"
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
  /** Aggiorna utente admin (Mongo id). Es. permissions_override. Richiede users.update. */
  patchAdminUser: (
    userId: string,
    body: Partial<{
      role: string;
      status: "invited" | "active" | "disabled";
      permissions_override: string[];
      isDisabled: boolean;
    }>
  ) =>
    patchJson<{ ok: boolean; user: { permissions_override?: string[] } | null }>(
      `/users/${encodeURIComponent(userId)}`,
      body
    ),
  listEmailFlows: () =>
    getJson<
      Array<{
        flowKey: string;
        label: string;
        description: string;
        placeholders: string[];
        enabled: boolean;
        subject: string;
        bodyHtml: string;
        hasCustomTemplate: boolean;
        editorMode: "html" | "blocks";
        layout: {
          logoUrl: string;
          primaryColor: string;
          blocks: Array<
            | { type: "heading"; html?: string; text?: string }
            | { type: "text"; html?: string; text?: string }
            | { type: "button"; label: string; href: string }
            | { type: "image"; src: string; alt: string }
          >;
        } | null;
        updatedAt: string | null;
        updatedBy: string | null;
      }>
    >("/admin/email-flows"),
  getEmailFlowSuggested: (flowKey: string) =>
    getJson<{ subject: string; bodyHtml: string }>(`/admin/email-flows/${flowKey}/suggested`),
  updateEmailFlow: (
    flowKey: string,
    body:
      | { editorMode: "html"; enabled: boolean; subject: string; bodyHtml: string }
      | {
          editorMode: "blocks";
          enabled: boolean;
          subject: string;
          layout: {
            logoUrl: string;
            primaryColor: string;
            blocks: Array<
              | { type: "heading"; html?: string; text?: string }
              | { type: "text"; html?: string; text?: string }
              | { type: "button"; label: string; href: string }
              | { type: "image"; src: string; alt: string }
            >;
          };
        }
  ) =>
    putJson<{
      flowKey: string;
      label: string;
      description: string;
      placeholders: string[];
      enabled: boolean;
      subject: string;
      bodyHtml: string;
      hasCustomTemplate: boolean;
      editorMode: "html" | "blocks";
      layout: unknown;
      updatedAt: string | null;
      updatedBy: string | null;
    }>(`/admin/email-flows/${flowKey}`, body),
  uploadEmailFlowAsset: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return postFormData<{ url: string }>("/admin/email-flows/upload-asset", fd);
  },
  previewEmailFlow: (
    flowKey: string,
    body: {
      subject: string;
      bodyHtml?: string;
      layout?: {
        logoUrl: string;
        primaryColor: string;
        blocks: Array<
          | { type: "heading"; html?: string; text?: string }
          | { type: "text"; html?: string; text?: string }
          | { type: "button"; label: string; href: string }
          | { type: "image"; src: string; alt: string }
        >;
      };
      sampleVars?: Record<string, string>;
    }
  ) => postJson<{ subject: string; html: string }>(`/admin/email-flows/${flowKey}/preview`, body),
  /** Invito MDOO: crea utente invited + email set-password; richiede permesso users.invite. */
  inviteUser: (body: {
    email: string;
    projectId: string;
    projectName?: string;
    /** Base FE per link invito; default = origine browser */
    appPublicUrl?: string;
    /** Label ruolo per l'email (es. "Vendor", "Admin"); default "Membro" */
    roleLabel?: string;
  }) =>
    postJson<{ userId: string }>("/users", {
      ...body,
      appPublicUrl: body.appPublicUrl ?? (typeof window !== "undefined" ? window.location.origin : undefined)
    }),
  listWorkspaces: () => getJson<WorkspaceRow[]>("/workspaces"),
  /** Ruoli per membership workspace (da DB). In caso errore restituisce array vuoto. */
  getWorkspaceRoles: async (): Promise<{ roleKey: string; label: string }[]> => {
    try {
      const res = await getJson<{ data: { roleKey: string; label: string }[] }>("/workspace-roles");
      return Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  },
  /** Catalogo permessi per UI override (richiede users.read). */
  getPermissionCatalog: () =>
    getJson<{
      data: {
        groups: Array<{
          module: string;
          label: string;
          permissions: Array<{ id: string; label: string; action: string }>;
        }>;
      };
    }>("/rbac/permission-catalog"),
  /** Permessi effettivi del ruolo workspace (DB + builtin) — anteprima / preset override in wizard utenti. */
  getRoleEffectivePermissions: (roleKey: string) =>
    getJson<{ data: { roleKey: string; permissions: string[] } }>(
      `/rbac/roles/${encodeURIComponent(roleKey)}/effective-permissions`
    ),
  getWorkspaceById: (id: string) => getJson<{ workspace: WorkspaceRow }>(`/workspaces/${id}`),
  createWorkspace: (payload: { name: string }) => postJson<{ workspace: WorkspaceRow }>("/workspaces", payload),
  updateWorkspace: (id: string, payload: { name?: string }) =>
    patchJson<{ workspace: WorkspaceRow }>(`/workspaces/${id}`, payload),
  deleteWorkspace: (id: string) => deleteJson<{ deleted: boolean }>(`/workspaces/${id}`),
  getWorkspaceAiConfig: (workspaceId: string) =>
    getJson<WorkspaceAiConfig>(`/workspaces/${encodeURIComponent(workspaceId)}/ai-config`),
  putWorkspaceAiConfig: (workspaceId: string, payload: { provider: string; apiKey: string }) =>
    putJson<WorkspaceAiConfig>(`/workspaces/${encodeURIComponent(workspaceId)}/ai-config`, payload),
  getWorkspaceEntitlements: (workspaceId: string) =>
    getJson<{ data: WorkspaceEntitlementEffectiveRow[] }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/entitlements`
    ),
  patchWorkspaceEntitlement: (
    workspaceId: string,
    feature: WorkspaceEntitlementFeature,
    payload: { status: WorkspaceEntitlementStatus; notes?: string; billingMode?: "manual_invoice" }
  ) =>
    patchJson<{ entitlement: WorkspaceEntitlementRow }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/entitlements/${encodeURIComponent(feature)}`,
      payload
    ),
  listPlatformApiKeys: (workspaceId: string) =>
    getJson<{ data: Array<{ _id: string; label: string; projectIds: string[]; scopes: string[]; quotaPerDay: number | null; active: boolean; lastUsedAt?: string; createdAt: string; updatedAt: string }> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform-api-keys`
    ),
  createPlatformApiKey: (
    workspaceId: string,
    payload: { label: string; projectIds?: string[]; scopes?: string[]; quotaPerDay?: number | null }
  ) =>
    postJson<{ key: Record<string, unknown>; apiKey: string; apiKeyMasked: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform-api-keys`,
      payload
    ),
  rotatePlatformApiKey: (workspaceId: string, keyId: string) =>
    postJson<{ key: Record<string, unknown>; apiKey: string; apiKeyMasked: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform-api-keys/${encodeURIComponent(keyId)}/rotate`,
      {}
    ),
  revokePlatformApiKey: (workspaceId: string, keyId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform-api-keys/${encodeURIComponent(keyId)}`
    ),
  getPlatformApiKeyUsage: (workspaceId: string, params?: { dateFrom?: string; dateTo?: string }) => {
    const q = new URLSearchParams();
    if (params?.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params?.dateTo) q.set("dateTo", params.dateTo);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return getJson<{ data: Array<{ keyRef: string; count: number; date: string }> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform-api-keys/usage${suffix}`
    );
  },
  listWorkspaceProjects: (workspaceId: string) =>
    getJson<{ data: WorkspaceProjectRow[] }>(`/workspaces/${workspaceId}/projects`),
  getAssetUploadUrl: (
    workspaceId: string,
    body: { type: "image" | "document" | "planimetry" | "branding"; name: string; mimeType: string; fileSize: number; projectId?: string; apartmentId?: string }
  ) =>
    postJson<{ uploadUrl: string; key: string; expiresAt: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/assets/upload-url`,
      body
    ),
  uploadFileToPresignedUrl: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`Upload fallito: ${res.status}`);
  },
  createAsset: (
    workspaceId: string,
    body: { key: string; type: "image" | "document" | "planimetry" | "branding"; name: string; mimeType: string; fileSize: number; projectId?: string; apartmentId?: string }
  ) =>
    postJson<{ data: AssetRow }>(`/workspaces/${encodeURIComponent(workspaceId)}/assets`, body),
  listAssets: (
    workspaceId: string,
    params?: { projectId?: string; apartmentId?: string; type?: "image" | "document" | "planimetry" | "branding" }
  ) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("projectId", params.projectId);
    if (params?.apartmentId) q.set("apartmentId", params.apartmentId);
    if (params?.type) q.set("type", params.type);
    const query = q.toString();
    return getJson<{ data: AssetRow[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/assets${query ? `?${query}` : ""}`);
  },
  getAssetDownloadUrl: (workspaceId: string, assetId: string) =>
    getJson<{ downloadUrl: string; expiresAt: string }>(`/workspaces/${encodeURIComponent(workspaceId)}/assets/${encodeURIComponent(assetId)}/download-url`),
  deleteAsset: (workspaceId: string, assetId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/assets/${encodeURIComponent(assetId)}`),
  getWorkspaceBranding: (workspaceId: string) =>
    getJson<{
      workspaceId: string;
      logoAssetId?: string;
      emailHeaderAssetId?: string;
      logoDownloadUrl?: string;
      emailHeaderDownloadUrl?: string;
      updatedAt: string;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/branding`),
  putWorkspaceBranding: (workspaceId: string, body: { logoAssetId?: string; emailHeaderAssetId?: string }) =>
    patchJson<{ data: { logoDownloadUrl?: string; emailHeaderDownloadUrl?: string; updatedAt: string } }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/branding`,
      body
    ),
  getClientDocumentUploadUrl: (
    workspaceId: string,
    clientId: string,
    body: { name: string; mimeType: string; fileSize: number; type: "proposta" | "contratto" | "altro"; projectId?: string }
  ) =>
    postJson<{ uploadUrl: string; key: string; expiresAt: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents/upload-url`,
      body
    ),
  createClientDocument: (
    workspaceId: string,
    clientId: string,
    body: {
      key: string;
      name: string;
      mimeType: string;
      fileSize: number;
      type: "proposta" | "contratto" | "altro";
      visibility: "internal" | "client";
      projectId?: string;
    }
  ) =>
    postJson<{ data: ClientDocumentRow }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents`,
      body
    ),
  listClientDocuments: (workspaceId: string, clientId: string) =>
    getJson<{ data: ClientDocumentRow[] }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents`
    ),
  getClientDocumentDownloadUrl: (workspaceId: string, clientId: string, docId: string) =>
    getJson<{ downloadUrl: string; expiresAt: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}/download-url`
    ),
  getClientDocumentShareLink: (workspaceId: string, clientId: string, docId: string) =>
    getJson<{ downloadUrl: string; expiresAt: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}/share-link`
    ),
  deleteClientDocument: (workspaceId: string, clientId: string, docId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(docId)}`
    ),
  associateProjectToWorkspace: (payload: { workspaceId: string; projectId: string }) =>
    postJson<{ workspaceId: string; projectId: string }>("/workspaces/projects/associate", payload),
  dissociateProjectFromWorkspace: (workspaceId: string, projectId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${workspaceId}/projects/${projectId}`),
  listAdditionalInfos: (workspaceId: string) =>
    getJson<{ data: AdditionalInfoRow[] }>(`/workspaces/${workspaceId}/additional-infos`),
  listWorkspaceUsers: (workspaceId: string) =>
    getJson<{ data: WorkspaceUserRow[] }>(`/workspaces/${workspaceId}/users`),
  addWorkspaceUser: (workspaceId: string, payload: { userId: string; role: WorkspaceUserRole; access_scope?: AccessScope }) =>
    postJson<{ workspaceUser: WorkspaceUserRow }>(`/workspaces/${workspaceId}/users`, payload),
  updateWorkspaceUser: (workspaceId: string, userId: string, payload: { role?: WorkspaceUserRole; access_scope?: AccessScope }) =>
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
  listProjectAccess: (projectId: string, workspaceId: string) =>
    getJson<{ data: ProjectAccessRow[] }>(`/projects/${encodeURIComponent(projectId)}/access?workspaceId=${encodeURIComponent(workspaceId)}`),
  grantProjectAccess: (
    projectId: string,
    payload: { workspaceId: string; role: "owner" | "collaborator" | "viewer" },
    currentWorkspaceId?: string
  ) =>
    postJson<ProjectAccessRow>(
      `/projects/${encodeURIComponent(projectId)}/access${currentWorkspaceId ? `?workspaceId=${encodeURIComponent(currentWorkspaceId)}` : ""}`,
      payload
    ),
  revokeProjectAccess: (projectId: string, workspaceId: string, currentWorkspaceId?: string) =>
    deleteJson<{ deleted: boolean }>(
      `/projects/${encodeURIComponent(projectId)}/access/${encodeURIComponent(workspaceId)}${currentWorkspaceId ? `?workspaceId=${encodeURIComponent(currentWorkspaceId)}` : ""}`
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
  getProjectsByEmail: (email: string, workspaceId?: string) =>
    postJson<ProjectAccessResponse>("/session/projects-by-email", {
      email,
      ...(workspaceId ? { workspaceId } : {}),
    }),
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
  subscribeRealtimeEvents: (
    workspaceId: string,
    options: { projectId?: string; eventTypes?: string[] },
    onEvent: (event: { eventType: string; payload: Record<string, unknown> }) => void
  ) => {
    const params = new URLSearchParams({ workspaceId });
    if (options.projectId) params.set("projectId", options.projectId);
    if (options.eventTypes && options.eventTypes.length > 0) {
      params.set("eventTypes", options.eventTypes.join(","));
    }
    const token = getAccessToken();
    if (token) params.set("accessToken", token);
    const source = new EventSource(`${API_BASE_URL}/realtime/stream?${params.toString()}`);
    source.addEventListener("domain-event", (evt) => {
      try {
        onEvent(JSON.parse((evt as MessageEvent).data) as { eventType: string; payload: Record<string, unknown> });
      } catch {
        // ignore invalid payloads
      }
    });
    return () => source.close();
  },
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
    return getJson<{
      data: Array<{
        _id: string;
        workspaceId: string;
        projectId?: string;
        channel: string;
        name: string;
        subject?: string;
        bodyText: string;
        bodyHtml?: string;
        variables: string[];
        metaTemplateName?: string;
        metaTemplateLanguage?: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/communication-templates${query ? `?${query}` : ""}`);
  },
  createCommunicationTemplate: (
    workspaceId: string,
    body: {
      projectId?: string;
      channel: string;
      name: string;
      subject?: string;
      bodyText: string;
      bodyHtml?: string;
      variables?: string[];
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
    }
  ) =>
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
  createPortalMagicLink: (payload: { workspaceId: string; clientId: string; projectIds: string[]; expiresInHours?: number }) =>
    postJson<{ token: string; expiresAt: string }>("/portal/magic-links", payload),
  portalExchangeMagicLink: (token: string) =>
    postJson<{ accessToken: string; expiresAt: string }>("/portal/auth/exchange", { token }),
  portalGetOverview: (
    accessToken: string,
    filters?: { statuses?: string[]; documentTypes?: Array<"quote" | "document"> },
  ) =>
    postJson<{
      client: { id: string; firstName: string; lastName: string; fullName: string; email?: string; phone?: string };
      deals: Array<{ id: string; type: string; status: string; updatedAt: string; quoteNumber?: string; quoteTotalPrice?: number }>;
      documents: Array<{ id: string; title: string; type: "quote" | "document"; createdAt: string; url?: string }>;
      timeline: Array<{ id: string; kind: "deal_status" | "document"; title: string; status?: string; at: string; requestId?: string }>;
    }>("/portal/overview", { accessToken, filters }),
  portalLogout: (accessToken: string) =>
    postJson<{ ok: boolean }>("/portal/logout", { accessToken }),
  privacyUpsertConsent: (
    clientId: string,
    payload: { workspaceId: string; consentType: "marketing_email" | "marketing_sms" | "profiling" | "third_party_sharing"; granted: boolean; source?: string },
  ) => postJson<{ ok: boolean }>(`/privacy/clients/${encodeURIComponent(clientId)}/consents`, payload),
  privacyRevokeConsent: (clientId: string, consentType: string, workspaceId: string) =>
    deleteJson<{ ok: boolean }>(
      `/privacy/clients/${encodeURIComponent(clientId)}/consents/${encodeURIComponent(consentType)}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  privacyExportClient: (clientId: string, workspaceId: string) =>
    getJson<Record<string, unknown>>(`/privacy/clients/${encodeURIComponent(clientId)}/export?workspaceId=${encodeURIComponent(workspaceId)}`),
  privacyEraseClient: (clientId: string, payload: { workspaceId: string; reason?: string }) =>
    postJson<{ ok: boolean; erasedAt: string }>(`/privacy/clients/${encodeURIComponent(clientId)}/erase`, payload),
  privacyRunRetention: (payload?: { olderThanDays?: number }) =>
    postJson<{ ok: boolean; olderThanDays: number; deletedAuditRows: number; runAt: string }>("/privacy/retention/run", payload ?? {}),
  createSignatureRequest: (payload: {
    workspaceId: string;
    requestId: string;
    provider: "docusign" | "yousign";
    signer: { fullName: string; email: string };
    document: { title: string; fileUrl: string };
    callbackUrl?: string;
  }) => postJson<Record<string, unknown>>("/contracts/signature-requests", payload),
  getRequestSignatureStatus: (requestId: string, workspaceId: string) =>
    getJson<{ data: Array<Record<string, unknown>> }>(
      `/contracts/${encodeURIComponent(requestId)}/signature-status?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  listMarketingWorkflows: (workspaceId: string) =>
    getJson<{ data: Array<Record<string, unknown>> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/marketing-workflows`
    ),
  createMarketingWorkflow: (workspaceId: string, payload: Record<string, unknown>) =>
    postJson<Record<string, unknown>>(
      `/workspaces/${encodeURIComponent(workspaceId)}/marketing-workflows`,
      payload
    ),
  runDueMarketingWorkflows: () => postJson<{ processed: number; failed: number }>("/marketing-workflows/run-due", {}),
  createMlsMapping: (
    workspaceId: string,
    payload: { projectId: string; portal: "immobiliare_it" | "idealista"; titlePrefix?: string; listingBaseUrl?: string },
  ) =>
    postJson<{ portal: string; apiKey: string; apiKeyMasked: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/mls/mappings`,
      payload
    ),
  runMlsReconciliation: (workspaceId: string) =>
    postJson<{ ok: boolean; checked: number; issues: number }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/mls/reconcile`,
      {}
    ),
  getScaleOutDecision: (workspaceId: string) =>
    getJson<Record<string, unknown>>(
      `/workspaces/${encodeURIComponent(workspaceId)}/platform/scale-out-decision`
    ),
  listOperationalAlerts: (workspaceId: string) =>
    getJson<{ data: Array<Record<string, unknown>> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/ops/alerts`
    ),
  acknowledgeOperationalAlert: (id: string) =>
    postJson<{ ok: boolean }>(`/ops/alerts/${encodeURIComponent(id)}/ack`, {}),
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
  /** Solo admin: invio prova Twilio WhatsApp (verifica config workspace). */
  testWhatsAppMessage: (workspaceId: string, body: { to: string; body?: string }) =>
    postJson<{ ok: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/whatsapp/test`, body),
  getMetaWhatsAppConfig: (workspaceId: string) =>
    getJson<{
      config: {
        _id: string;
        workspaceId: string;
        connectorId: string;
        config: { phoneNumberId: string; accessTokenMasked?: string };
        updatedAt: string;
      } | null;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/meta-whatsapp/config`),
  saveMetaWhatsAppConfig: (workspaceId: string, body: { phoneNumberId: string; accessToken: string }) =>
    postJson<{ config: Record<string, unknown> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/meta-whatsapp/config`,
      body
    ),
  deleteMetaWhatsAppConfig: (workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/meta-whatsapp/config`),
  getMailchimpConnectorConfig: (workspaceId: string) =>
    getJson<{
      config: {
        _id: string;
        workspaceId: string;
        connectorId: string;
        config: { apiKeyMasked?: string };
        updatedAt: string;
      } | null;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/mailchimp/config`),
  saveMailchimpConnectorConfig: (workspaceId: string, body: { apiKey: string }) =>
    postJson<{ config: Record<string, unknown> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/mailchimp/config`,
      body
    ),
  deleteMailchimpConnectorConfig: (workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/mailchimp/config`),
  getActiveCampaignConnectorConfig: (workspaceId: string) =>
    getJson<{
      config: {
        _id: string;
        workspaceId: string;
        connectorId: string;
        config: { apiKeyMasked?: string; apiBaseUrl?: string };
        updatedAt: string;
      } | null;
    }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/activecampaign/config`),
  saveActiveCampaignConnectorConfig: (workspaceId: string, body: { apiKey: string; apiBaseUrl?: string }) =>
    postJson<{ config: Record<string, unknown> }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/activecampaign/config`,
      body
    ),
  deleteActiveCampaignConnectorConfig: (workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/connectors/activecampaign/config`),
  testMetaWhatsAppMessage: (
    workspaceId: string,
    body: { to: string; templateName: string; languageCode: string; bodyParameters?: string[] }
  ) =>
    postJson<{ ok: boolean; externalId?: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/connectors/meta-whatsapp/test`,
      body
    ),
  /** Test API listati pubblici (nessuna auth richiesta lato backend). Per connettore Looker Studio. */
  testPublicListings: (workspaceId: string, projectIds: string[]) =>
    postJson<PaginatedResponse<ApartmentRow>>("/public/listings", {
      workspaceId,
      projectIds,
      page: 1,
      perPage: 5,
    }),
  login: (email: string, password: string) => postAuthLogin(email, password),
  verifyMfaLogin: (mfaToken: string, code: string) =>
    postJson<{
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: FollowupAuthUser;
    }>("/auth/mfa/verify", { mfaToken, code: code.trim() }),
  startMfaSetup: () => postJson<{ otpauthUrl: string }>("/auth/mfa/setup/start", {}),
  confirmMfaSetup: (code: string) =>
    postJson<{ backupCodes: string[] }>("/auth/mfa/setup/confirm", { code: code.trim().replace(/\s/g, "") }),
  disableMfa: (code: string) =>
    postJson<{ ok: true }>("/auth/mfa/disable", { code: code.trim().replace(/\s/g, "") }),
  me: () => getJson<FollowupAuthUser>("/auth/me"),
  ssoExchange: (ssoJwt: string) =>
    postJson<{
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: {
        id: string;
        email: string;
        role: string | null;
        isAdmin: boolean;
        permissions?: string[];
        projectId?: string | null;
      };
    }>("/auth/sso-exchange", { ssoJwt }),
  refresh: (refreshToken: string) =>
    postJson<{ accessToken: string; refreshToken?: string; expiresIn?: string }>("/auth/refresh", { refreshToken }),
  logout: (refreshToken: string) => postJson<void>("/auth/logout", { refreshToken }),
  setPasswordFromInvite: (body: { token: string; password: string }) =>
    postJson<{
      accessToken: string;
      refreshToken: string;
      expiresIn?: string;
      user: {
        id: string;
        email: string;
        role: string | null;
        isAdmin: boolean;
        permissions?: string[];
        projectId?: string | null;
      };
    }>("/auth/set-password-from-invite", body),
  requestPasswordReset: (email: string) => postJson<{ ok: boolean }>("/auth/request-password-reset", { email }),
  resetPassword: (token: string, password: string) =>
    postJson<{ ok: boolean }>("/auth/reset-password", { token, password }),
  getPriceAvailabilityMatrix: (workspaceId: string, projectIds: string[], from: string, to: string) =>
    getJson<{
      units: Array<{ unitId: string; code: string; name: string; mode?: string }>;
      dates: string[];
      cells: Record<string, Record<string, { price?: number; availability?: string; minStay?: number }>>;
    }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/price-availability?projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
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
  /** Elenco suggerimenti pending già salvati (nessuna rigenerazione). */
  getAiSuggestions: (workspaceId: string, projectIds: string[], limit = 20) => {
    const q = new URLSearchParams();
    q.set("workspaceId", workspaceId);
    q.set("limit", String(limit));
    projectIds.forEach((id) => q.append("projectIds", id));
    return getJson<{
      generatedAt: string;
      data: AiSuggestion[];
      aiConfigured?: boolean;
      llmUsed?: boolean | null;
      fromCache?: boolean;
    }>(`/ai/suggestions?${q.toString()}`);
  },
  /** Rigenera suggerimenti (rule-based + LLM) e li persiste in `tz_ai_suggestions`. */
  generateAiSuggestions: (workspaceId: string, projectIds: string[], limit = 20) =>
    postJson<{
      generatedAt: string;
      data: AiSuggestion[];
      aiConfigured?: boolean;
      llmUsed?: boolean | null;
      fromCache?: boolean;
    }>("/ai/suggestions", {
      workspaceId,
      projectIds,
      limit
    }),
  executeAiSuggestion: (
    suggestionId: string,
    body: { actorEmail: string; note?: string; maxSteps?: number }
  ) =>
    postJson<{
      suggestionId: string;
      summary: string;
      toolLog: Array<{ name: string; ok: boolean; error?: string }>;
      steps: number;
    }>(`/ai/suggestions/${encodeURIComponent(suggestionId)}/execute`, body),
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
