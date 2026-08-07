import { ObjectId } from 'mongodb';

/** Campi top-level tz_projects che alimentano legacyPayload.rawProject (estesi rispetto al POC per PATCH followup-3.0). */
export const CANONICAL_PROJECT_FIELD_KEYS = [
  'name',
  'code',
  'displayName',
  'mode',
  'hostKey',
  'assetKey',
  'feVendorKey',
  'customDomain',
  'city',
  'payoff',
  'defaultLang',
  'accountManagerEnabled',
  'automaticQuoteEnabled',
  'hasDAS',
  'broker',
  'contactPhone',
  'contactEmail',
  'projectUrl',
  'iban',
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
  updateDoc: Record<string, unknown>,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const key of CANONICAL_PROJECT_FIELD_KEYS) {
    const value = updateDoc[key as CanonicalKey];
    if (value !== undefined) patch[key] = value;
  }
  return patch;
};
