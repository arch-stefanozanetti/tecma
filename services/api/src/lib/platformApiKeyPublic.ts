/**
 * DTO pubblico per workspace platform API keys: esclude tokenHash e altri campi interni.
 */

export type PublicPlatformApiKey = {
  _id: string;
  workspaceId: string;
  label: string;
  projectIds: string[];
  scopes: string[];
  tokenPreview?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  rotatedAt?: string;
  rotatedBy?: string;
};

export function toPublicPlatformApiKey(
  doc: Record<string, unknown> | null | undefined,
): PublicPlatformApiKey | null {
  if (doc == null) return null;
  const base: PublicPlatformApiKey = {
    _id: String(doc._id ?? ''),
    workspaceId: String(doc.workspaceId ?? ''),
    label: String(doc.label ?? ''),
    projectIds: Array.isArray(doc.projectIds) ? doc.projectIds.map(String) : [],
    scopes: Array.isArray(doc.scopes) ? doc.scopes.map(String) : [],
    status: String(doc.status ?? ''),
  };
  if (doc.tokenPreview != null) base.tokenPreview = String(doc.tokenPreview);
  if (doc.createdAt != null) base.createdAt = String(doc.createdAt);
  if (doc.updatedAt != null) base.updatedAt = String(doc.updatedAt);
  if (doc.createdBy != null) base.createdBy = String(doc.createdBy);
  if (doc.rotatedAt != null) base.rotatedAt = String(doc.rotatedAt);
  if (doc.rotatedBy != null) base.rotatedBy = String(doc.rotatedBy);
  return base;
}
