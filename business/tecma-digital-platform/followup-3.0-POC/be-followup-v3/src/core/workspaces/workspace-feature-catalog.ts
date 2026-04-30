/**
 * Catalogo unico delle chiavi entitlement per workspace (tz_workspace_entitlements).
 * Documentazione: docs/plans/2026-03-21-feature-flags-workspace-design.md
 *
 * - defaultEntitledWhenNoRow: se true, assenza di riga DB ⇒ uso consentito (retrocompat).
 *   Nuove funzioni commerciali opt-in possono usare false (dopo migrazione dati).
 * - includeInWorkspaceFeaturesPayload: se true, la chiave entra in GET /workspaces/:id → features[]
 *   (allineamento nav FE: SECTION_FEATURE_KEY / FEATURE_KEYS).
 */
export const WORKSPACE_ENTITLEMENT_FEATURES = [
  "publicApi",
  "twilio",
  "mailchimp",
  "activecampaign",
  "aiApprovals",
  "reports",
  "integrations",
] as const;

export type WorkspaceEntitlementFeature = (typeof WORKSPACE_ENTITLEMENT_FEATURES)[number];

export interface WorkspaceFeatureCatalogEntry {
  defaultEntitledWhenNoRow: boolean;
  includeInWorkspaceFeaturesPayload: boolean;
  /** Etichetta per console Tecma / documentazione */
  labelIt: string;
}

export const WORKSPACE_FEATURE_CATALOG: Record<WorkspaceEntitlementFeature, WorkspaceFeatureCatalogEntry> = {
  publicApi: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: false,
    labelIt: "Public API / chiavi platform",
  },
  twilio: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: false,
    labelIt: "Twilio / WhatsApp",
  },
  mailchimp: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: false,
    labelIt: "Mailchimp",
  },
  activecampaign: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: false,
    labelIt: "ActiveCampaign",
  },
  aiApprovals: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: true,
    labelIt: "Approvazioni AI / suggerimenti",
  },
  reports: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: true,
    labelIt: "Reportistica",
  },
  integrations: {
    defaultEntitledWhenNoRow: true,
    includeInWorkspaceFeaturesPayload: true,
    labelIt: "Integrazioni e automazioni",
  },
};

export function getDefaultEntitledWhenNoRow(feature: WorkspaceEntitlementFeature): boolean {
  return WORKSPACE_FEATURE_CATALOG[feature].defaultEntitledWhenNoRow;
}

export function shouldIncludeFeatureInWorkspacePayload(feature: WorkspaceEntitlementFeature): boolean {
  return WORKSPACE_FEATURE_CATALOG[feature].includeInWorkspaceFeaturesPayload;
}
