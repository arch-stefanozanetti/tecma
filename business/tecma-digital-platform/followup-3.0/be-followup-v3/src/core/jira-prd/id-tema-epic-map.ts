/**
 * Mappatura ogni idTema del catalogo → Epic (E1–E14) e tipo backlog Jira suggerito.
 * Single source per Product Blueprint e integrità catalogo.
 */
import type { CatalogWorkItemKind, EpicId } from "./epic-registry.js";

export interface IdTemaEpicMeta {
  epicId: EpicId;
  /** Suggerimento per righe product; le righe kind=technical usano sempre "technical". */
  workItemKind: Exclude<CatalogWorkItemKind, "technical">;
  storyRef?: string;
  /** Path relativi a followup-3.0/docs/ o label UX */
  designRefs?: string[];
}

export const ID_TEMA_EPIC_MAP: Record<string, IdTemaEpicMeta> = {
  "close-phase0": { epicId: "E1", workItemKind: "story", storyRef: "S1.1", designRefs: ["PIANO_GLOBALE_FOLLOWUP_3.md"] },
  "user-access-granularity": { epicId: "E2", workItemKind: "story", storyRef: "S2.1", designRefs: ["deliverables/FASE01_USER_ACCESS_RBAC.md"] },
  "commercial-entitlements": { epicId: "E3", workItemKind: "story", storyRef: "S3.1", designRefs: ["deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md"] },
  "tecma-activation-audit": { epicId: "E3", workItemKind: "story", designRefs: ["deliverables/FASE02_ENTITLEMENTS_AND_TECMA.md"] },
  "csv-mapping": { epicId: "E4", workItemKind: "story", storyRef: "S4.1", designRefs: ["deliverables/FASE1_CSV_MAPPING.md"] },
  "s3-verify": { epicId: "E5", workItemKind: "story", storyRef: "S5.1", designRefs: ["deliverables/FASE3_S3_VERIFICATION.md"] },
  "digital-quote": { epicId: "E6", workItemKind: "story", storyRef: "S6.1", designRefs: ["deliverables/FASE2_DIGITAL_QUOTE.md"] },
  "reports-dashboards": { epicId: "E7", workItemKind: "story", storyRef: "S7.1", designRefs: ["deliverables/FASE4_REPORTS_DASHBOARDS.md"] },
  "calendar-sync": { epicId: "E8", workItemKind: "story", storyRef: "S8.1", designRefs: ["deliverables/FASE5_CALENDAR_SYNC.md"] },
  "connectors-ux": { epicId: "E9", workItemKind: "story", storyRef: "S9.1", designRefs: ["deliverables/FASE6_CONNECTORS_UX.md"] },
  "inbox-contract": { epicId: "E10", workItemKind: "story", storyRef: "S10.1", designRefs: ["deliverables/FASE7_INBOX_CONTRACT.md"] },
  "visual-parity": { epicId: "E11", workItemKind: "task", storyRef: "T11.1", designRefs: ["deliverables/FASE8_VISUAL_PARITY.md"] },
  "ux-mobile": { epicId: "E11", workItemKind: "task", storyRef: "T11.2" },
  "refactor-api-layer": { epicId: "E11", workItemKind: "task" },
  "matching-be": { epicId: "E1", workItemKind: "story" },
  "auth-core": { epicId: "E2", workItemKind: "story" },
  "clients-apartments-core": { epicId: "E1", workItemKind: "story" },
  "requests-deals": { epicId: "E1", workItemKind: "story" },
  "customer360": { epicId: "E1", workItemKind: "story" },
  "price-availability": { epicId: "E1", workItemKind: "story" },
  "integrations-hub": { epicId: "E3", workItemKind: "story" },
  "big-data-marketing": { epicId: "E3", workItemKind: "story" },
  "ai-cockpit-approvals": { epicId: "E13", workItemKind: "spike", storyRef: "SP13.1" },
  "platform-api-bss": { epicId: "E12", workItemKind: "story", storyRef: "S12.1", designRefs: ["AUTH_AND_TECMA_BSS_API_REPORT.md"] },
  "ci-quality-observability": { epicId: "E12", workItemKind: "task", designRefs: ["CI_AND_TEST_GATES.md"] },
  "product-discovery": { epicId: "E14", workItemKind: "spike" },
  "experimental-hub": { epicId: "E14", workItemKind: "spike" },
  "dialog-drawer-ux": { epicId: "E11", workItemKind: "task" },
  "ux-liste-card-toggle": { epicId: "E11", workItemKind: "task" },
  "keycloak-oidc-sso": { epicId: "E2", workItemKind: "story" },
  "session-project-scope": { epicId: "E1", workItemKind: "story" },
  "clients-domain-detail": { epicId: "E1", workItemKind: "story" },
  "apartments-domain-detail": { epicId: "E1", workItemKind: "story" },
  "requests-actions-workflow": { epicId: "E1", workItemKind: "story" },
  "calendar-events-domain": { epicId: "E8", workItemKind: "story" },
  "workspaces-users-admin": { epicId: "E1", workItemKind: "story" },
  "workflow-config-ui": { epicId: "E1", workItemKind: "story" },
  "hc-catalog-templates": { epicId: "E1", workItemKind: "story" },
  "email-flows-transactional": { epicId: "E10", workItemKind: "story" },
  "audit-log-security": { epicId: "E2", workItemKind: "story" },
  "gdpr-compliance-erasure": { epicId: "E12", workItemKind: "spike" },
  "customer-portal-public": { epicId: "E6", workItemKind: "story" },
  "contracts-signatures": { epicId: "E6", workItemKind: "story" },
  "communications-whatsapp-sms": { epicId: "E9", workItemKind: "story" },
  "webhook-automation-rules": { epicId: "E9", workItemKind: "story" },
  "platform-api-keys-rate-limit": { epicId: "E12", workItemKind: "story" },
  "realtime-bus-ui": { epicId: "E10", workItemKind: "story" },
  "notifications-domain": { epicId: "E10", workItemKind: "story" },
  "quotes-domain-public": { epicId: "E6", workItemKind: "story" },
  "projects-legacy-detail": { epicId: "E1", workItemKind: "story" },
  "assets-client-documents": { epicId: "E5", workItemKind: "story" },
  "additional-infos-custom-fields": { epicId: "E1", workItemKind: "story" },
  "marketing-automation-nurture": { epicId: "E3", workItemKind: "story" },
  "mls-feed-import": { epicId: "E4", workItemKind: "spike" },
  "privacy-consent-records": { epicId: "E12", workItemKind: "story" },
  "ops-scale-health": { epicId: "E12", workItemKind: "task" },
  "intelligence-routes": { epicId: "E13", workItemKind: "spike" },
  "discovery-workflow-product": { epicId: "E14", workItemKind: "spike" },
  "pwa-offline-telemetry": { epicId: "E11", workItemKind: "task" },
  "bss-auth-adapter": { epicId: "E12", workItemKind: "story" },
  "product-blueprint-jira-console": { epicId: "E12", workItemKind: "task" },
  "executive-overview-strategic": { epicId: "E14", workItemKind: "story" },
  "coima-gap-assessment": { epicId: "E14", workItemKind: "spike" },
  "close-phase0-technical-matching-api": { epicId: "E1", workItemKind: "story" },
  "auth-core-technical-mfa-lockout": { epicId: "E2", workItemKind: "story" },
  "product-blueprint-jira-technical-rest": { epicId: "E12", workItemKind: "task" },
};

export function getEpicMetaForIdTema(idTema: string): IdTemaEpicMeta {
  const m = ID_TEMA_EPIC_MAP[idTema];
  if (!m) {
    throw new Error(`id-tema-epic-map: idTema "${idTema}" non mappato — aggiungere voce in ID_TEMA_EPIC_MAP`);
  }
  return m;
}
