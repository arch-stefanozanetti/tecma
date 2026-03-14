import type { ProjectAccessProject } from "../types/domain";

/**
 * Feature flag per workspace: mappatura section -> chiave feature.
 * Se una section ha featureKey, è visibile solo se enabledFeatures include quella chiave.
 * Se enabledFeatures è undefined = tutte abilitate (retrocompat).
 */
export const FEATURE_KEYS = {
  aiApprovals: "aiApprovals",
  reports: "reports",
  integrations: "integrations",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/** Section id -> feature key. Solo le section con flag sono qui; le altre sono sempre visibili. */
export const SECTION_FEATURE_KEY: Partial<Record<string, FeatureKey>> = {
  aiApprovals: FEATURE_KEYS.aiApprovals,
  reports: FEATURE_KEYS.reports,
  integrations: FEATURE_KEYS.integrations,
};

/**
 * Ritorna true se la section è abilitata per il workspace.
 * enabledFeatures undefined = tutte abilitate; array vuoto = solo section senza featureKey.
 */
export function isSectionEnabledByFeature(
  sectionId: string,
  enabledFeatures: string[] | undefined
): boolean {
  const key = SECTION_FEATURE_KEY[sectionId];
  if (!key) return true;
  if (enabledFeatures === undefined) return true;
  return enabledFeatures.includes(key);
}

/** True se il progetto è considerato "affitto" (id/name/displayName contengono "rent"). */
function isProjectRentMode(project: ProjectAccessProject): boolean {
  const s = `${project.id} ${project.name ?? ""} ${project.displayName ?? ""}`.toLowerCase();
  return s.includes("rent");
}

/**
 * True se la sezione "Prezzi e disponibilità" è rilevante per il contesto corrente.
 * In contesto solo vendita (tutti i progetti selezionati sono sell) non serve la matrice prezzi/disponibilità per data.
 */
export function isPriceAvailabilityRelevant(
  projects: ProjectAccessProject[],
  selectedProjectIds: string[]
): boolean {
  if (selectedProjectIds.length === 0) return true;
  const selected = projects.filter((p) => selectedProjectIds.includes(p.id));
  return selected.some(isProjectRentMode);
}
