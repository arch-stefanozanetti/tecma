import type { WorkspaceEntitlementEffectiveRow, WorkspaceEntitlementFeature } from "../../types/domain";

/**
 * Finché gli entitlement non sono caricati (`undefined`), non blocchiamo l’UI (il backend resta fonte di verità).
 */
export function workspaceFeatureEntitled(
  items: WorkspaceEntitlementEffectiveRow[] | undefined,
  feature: WorkspaceEntitlementFeature
): boolean {
  if (items === undefined) return true;
  const row = items.find((i) => i.feature === feature);
  return row?.entitled !== false;
}
