export type LegacyWorkspaceId = "dev-1" | "demo" | "prod";

export const isLegacyWorkspaceId = (id: string): id is LegacyWorkspaceId =>
  id === "dev-1" || id === "demo" || id === "prod";

/**
 * ID workspace Mongo per API (canAccess, clients/query).
 * Non confondere con apiEnvironment (dev-1/demo/prod) usato solo per banner/legacy.
 */
export function resolveMongoWorkspaceId(
  candidate: string | undefined | null,
  defaultWorkspaceId?: string | null,
  membershipWorkspaces?: { _id: string }[]
): string {
  const c = candidate?.trim() ?? "";
  if (c && !isLegacyWorkspaceId(c)) return c;
  const def = defaultWorkspaceId?.trim() ?? "";
  if (def && !isLegacyWorkspaceId(def)) return def;
  const first = membershipWorkspaces?.[0]?._id?.trim();
  if (first) return first;
  return c;
}
