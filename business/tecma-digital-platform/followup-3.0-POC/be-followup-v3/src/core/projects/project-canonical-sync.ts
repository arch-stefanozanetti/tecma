import { ObjectId } from "mongodb";

export const CANONICAL_PROJECT_FIELD_KEYS = [
  "name",
  "displayName",
  "hostKey",
  "assetKey",
  "customDomain",
  "city",
  "payoff",
  "defaultLang",
  "accountManagerEnabled",
  "automaticQuoteEnabled",
  "broker",
  "contactPhone",
  "contactEmail",
  "projectUrl",
  "iban",
] as const;

type CanonicalKey = (typeof CANONICAL_PROJECT_FIELD_KEYS)[number];

export const tzProjectFilter = (projectId: string): Record<string, unknown> => {
  const idFilter = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
  return {
    $or: [{ _id: idFilter as never }, { _id: projectId as never }, { legacyProjectId: projectId }],
  };
};

/** Patch rawProject derivata da update top-level tz_projects. */
export const buildRawProjectPatchFromTzUpdate = (
  updateDoc: Record<string, unknown>
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const key of CANONICAL_PROJECT_FIELD_KEYS) {
    const value = updateDoc[key];
    if (value !== undefined) patch[key] = value;
  }
  return patch;
};

/** Patch top-level tz_projects derivata da identityFields legacy. */
export const buildTzPatchFromIdentityFields = (
  identityFields: Record<string, unknown> | undefined
): Record<string, unknown> => {
  if (!identityFields) return {};
  const out: Partial<Record<CanonicalKey, unknown>> = {};
  const keyMap: Record<string, CanonicalKey> = {
    name: "name",
    displayName: "displayName",
    hostKey: "hostKey",
    assetKey: "assetKey",
    customDomain: "customDomain",
    city: "city",
    payoff: "payoff",
    defaultLang: "defaultLang",
    accountManagerEnabled: "accountManagerEnabled",
    automaticQuoteEnabled: "automaticQuoteEnabled",
    broker: "broker",
    contactPhone: "contactPhone",
    contactEmail: "contactEmail",
  };
  for (const [legacyKey, tzKey] of Object.entries(keyMap)) {
    const value = identityFields[legacyKey];
    if (value !== undefined) out[tzKey] = value;
  }
  return out as Record<string, unknown>;
};

