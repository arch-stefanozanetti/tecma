import { deleteJson, getJson, patchJson, postJson, putJson } from "../http";
import type { ProjectAccessRow } from "../../types/domain";

export const projectsApi = {
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
  getProjectDetail: (projectId: string, workspaceId: string) =>
    getJson<{
      id: string;
      name: string;
      displayName: string;
      mode: "rent" | "sell";
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
      archived?: boolean;
      createdAt?: string;
      updatedAt?: string;
      migration?: Record<string, unknown>;
      legacyPayload?: Record<string, unknown>;
    }>(`/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`),
  updateProject: (
    projectId: string,
    workspaceId: string,
    payload: {
      name?: string;
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
    }
  ) =>
    patchJson<{ id: string; name: string; displayName: string; mode: "rent" | "sell" }>(
      `/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  getProjectPolicies: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      privacyPolicyUrl?: string;
      termsUrl?: string;
      content?: string;
      legalNotes?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectPolicies: (
    projectId: string,
    workspaceId: string,
    payload: { privacyPolicyUrl?: string; termsUrl?: string; content?: string; legalNotes?: string }
  ) =>
    putJson<{
      projectId: string;
      privacyPolicyUrl?: string;
      termsUrl?: string;
      content?: string;
      legalNotes?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/policies?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectBranding: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      logoUrl?: string;
      primaryColor?: string;
      footerText?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/branding?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectBranding: (
    projectId: string,
    workspaceId: string,
    payload: { logoUrl?: string; primaryColor?: string; footerText?: string }
  ) =>
    putJson<{
      projectId: string;
      logoUrl?: string;
      primaryColor?: string;
      footerText?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/branding?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectEmailConfig: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      smtpHost?: string;
      smtpPort?: number;
      fromEmail?: string;
      defaultTemplateId?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/email-config?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectEmailConfig: (
    projectId: string,
    workspaceId: string,
    payload: { smtpHost?: string; smtpPort?: number; fromEmail?: string; defaultTemplateId?: string }
  ) =>
    putJson<{
      projectId: string;
      smtpHost?: string;
      smtpPort?: number;
      fromEmail?: string;
      defaultTemplateId?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/email-config?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  listProjectEmailTemplates: (projectId: string, workspaceId: string) =>
    getJson<
      Array<{
        _id: string;
        projectId: string;
        name: string;
        subject: string;
        bodyHtml: string;
        bodyText?: string;
        createdAt: string;
        updatedAt: string;
      }>
    >(`/projects/${projectId}/email-templates?workspaceId=${encodeURIComponent(workspaceId)}`),
  createProjectEmailTemplate: (
    projectId: string,
    workspaceId: string,
    payload: { name: string; subject: string; bodyHtml: string; bodyText?: string }
  ) =>
    postJson<{
      _id: string;
      projectId: string;
      name: string;
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/projects/${projectId}/email-templates?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectEmailTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    getJson<{
      _id: string;
      projectId: string;
      name: string;
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`),
  patchProjectEmailTemplate: (
    projectId: string,
    templateId: string,
    workspaceId: string,
    payload: { name?: string; subject?: string; bodyHtml?: string; bodyText?: string }
  ) =>
    patchJson<{
      _id: string;
      projectId: string;
      name: string;
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  deleteProjectEmailTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/projects/${projectId}/email-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  listProjectPdfTemplates: (projectId: string, workspaceId: string) =>
    getJson<
      Array<{ _id: string; projectId: string; name: string; templateKey: string; config: Record<string, unknown>; updatedAt: string }>
    >(`/projects/${projectId}/pdf-templates?workspaceId=${encodeURIComponent(workspaceId)}`),
  createProjectPdfTemplate: (
    projectId: string,
    workspaceId: string,
    payload: { name: string; templateKey: string; config?: Record<string, unknown> }
  ) =>
    postJson<{
      _id: string;
      projectId: string;
      name: string;
      templateKey: string;
      config: Record<string, unknown>;
      updatedAt: string;
    }>(`/projects/${projectId}/pdf-templates?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectPdfTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    getJson<{
      _id: string;
      projectId: string;
      name: string;
      templateKey: string;
      config: Record<string, unknown>;
      updatedAt: string;
    }>(`/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`),
  patchProjectPdfTemplate: (
    projectId: string,
    templateId: string,
    workspaceId: string,
    payload: { name?: string; config?: Record<string, unknown> }
  ) =>
    patchJson<{
      _id: string;
      projectId: string;
      name: string;
      templateKey: string;
      config: Record<string, unknown>;
      updatedAt: string;
    }>(`/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  deleteProjectPdfTemplate: (projectId: string, templateId: string, workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(
      `/projects/${projectId}/pdf-templates/${templateId}?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  getProjectMarketingSettings: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      googleAdsCustomerId?: string;
      googleAdsLoginCustomerId?: string;
      ga4PropertyId?: string;
      metaAdAccountId?: string;
      siteHostname?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/marketing-settings?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectMarketingSettings: (
    projectId: string,
    workspaceId: string,
    payload: {
      googleAdsCustomerId?: string | null;
      googleAdsLoginCustomerId?: string | null;
      ga4PropertyId?: string | null;
      metaAdAccountId?: string | null;
      siteHostname?: string | null;
    }
  ) =>
    putJson<{
      projectId: string;
      googleAdsCustomerId?: string;
      googleAdsLoginCustomerId?: string;
      ga4PropertyId?: string;
      metaAdAccountId?: string;
      siteHostname?: string;
      updatedAt: string;
    }>(`/projects/${projectId}/marketing-settings?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectWorkflowSettings: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      workspaceId: string;
      workflowId: string | null;
      updatedAt: string;
    }>(`/projects/${projectId}/workflow-settings?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectWorkflowSettings: (projectId: string, workspaceId: string, payload: { workflowId: string | null }) =>
    putJson<{
      projectId: string;
      workspaceId: string;
      workflowId: string | null;
      updatedAt: string;
    }>(`/projects/${projectId}/workflow-settings?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  getProjectLegacyOverrides: (projectId: string, workspaceId: string) =>
    getJson<{
      projectId: string;
      enabledTools?: {
        quotations?: boolean;
        appointments?: boolean;
        floorPlans?: boolean;
        docs?: boolean;
        myHome?: boolean;
      };
      floorPlanning?: {
        flowDeskEnabled?: boolean;
        flowWebEnabled?: boolean;
        planInfoEnabled?: boolean;
        showOnlyAvailable?: boolean;
      };
      neurosales?: {
        enabled?: boolean;
        dashboardEnabled?: boolean;
        cardsEnabled?: boolean;
        homePageEnabled?: boolean;
      };
      myHome?: {
        enabled?: boolean;
        documentAreaEnabled?: boolean;
        proposalEnabled?: boolean;
        reserveEnabled?: boolean;
        onlinePaymentEnabled?: boolean;
      };
      appointments?: {
        bookingEnabled?: boolean;
        openDaysEnabled?: boolean;
        unavailablePeriodEnabled?: boolean;
      };
      policyFlags?: {
        gdprEnabled?: boolean;
        marketingConsentEnabled?: boolean;
        profilingConsentEnabled?: boolean;
      };
      jobs?: {
        leaseExpiryReminderEnabled?: boolean;
        reminderDaysBefore?: number;
      };
      advancedOverrides?: Array<{
        path: string;
        valueType: "string" | "number" | "boolean";
        stringValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
      }>;
      identityFields?: Record<string, unknown>;
      pageTitles?: Record<string, string>;
      manifestConfig?: unknown;
      myLivingConfig?: unknown;
      legacyEnabledTools?: Array<Record<string, unknown>>;
      rentAssetContext?: unknown;
      myhomeConfig?: unknown;
      jobsConfig?: unknown;
      followupConfig?: unknown;
      floorPlanningConfig?: unknown;
      neurosalesConfig?: unknown;
      legacyPolicyFlags?: unknown;
      businessPlatformConfig?: unknown;
      domainWhitelist?: string[];
      projectFlags?: unknown;
      proposalTemplate?: unknown;
      iban?: unknown;
      updatedAt: string;
    }>(`/projects/${projectId}/legacy-overrides?workspaceId=${encodeURIComponent(workspaceId)}`),
  putProjectLegacyOverrides: (projectId: string, workspaceId: string, payload: Record<string, unknown>) =>
    putJson<{
      projectId: string;
      updatedAt: string;
    }>(`/projects/${projectId}/legacy-overrides?workspaceId=${encodeURIComponent(workspaceId)}`, payload),
  listProjectAccess: (projectId: string, workspaceId: string) =>
    getJson<{ data: ProjectAccessRow[] }>(
      `/projects/${encodeURIComponent(projectId)}/access?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
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
};
