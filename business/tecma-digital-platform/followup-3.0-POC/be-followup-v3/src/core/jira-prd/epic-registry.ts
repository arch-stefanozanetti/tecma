/**
 * Epic candidate Followup 3.0 (allineate a docs/JIRA_TRACEABILITY_FOLLOWUP_3.md §5).
 * E14 = macro-area non coperta dalle prime 13 (strumenti interni, discovery, assessment).
 */
export const EPIC_IDS = [
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E7",
  "E8",
  "E9",
  "E10",
  "E11",
  "E12",
  "E13",
  "E14",
] as const;

export type EpicId = (typeof EPIC_IDS)[number];

/** Titoli Epic (denormalizzati per API/UI/export Jira) */
export const EPIC_TITLES: Record<EpicId, string> = {
  E1: "[Cross] Followup 3.0 — Workspace, progetti e segregazione dati",
  E2: "[Cross] Followup 3.0 — RBAC granulare e audit utenze",
  E3: "[Cross] Followup 3.0 — Entitlement commerciale e integrazioni a pagamento",
  E4: "[Cross] Followup 3.0 — Migrazione dati legacy e mapping CSV",
  E5: "[Cross] Followup 3.0 — Storage S3 e documenti",
  E6: "[Sell] Followup 3.0 — Preventivo digitale e magic link",
  E7: "[Cross] Followup 3.0 — Report, definizioni e condivisione",
  E8: "[Cross] Followup 3.0 — Calendario e sincronizzazione esterna",
  E9: "[Cross] Followup 3.0 — Connettori e comunicazioni (UX)",
  E10: "[Cross] Followup 3.0 — Inbox e notifiche",
  E11: "[iTd] Followup 3.0 — Parità visiva e UX mobile",
  E12: "[Cross] Followup 3.0 — Piattaforma API enterprise (OpenAPI, BSS, CI)",
  E13: "[Cross] Followup 3.0 — AI cockpit e automazioni (Wave 7)",
  E14: "[Cross] Followup 3.0 — Discovery, assessment e strumenti prodotto interni",
};

export type CatalogWorkItemKind = "story" | "spike" | "task" | "technical";
