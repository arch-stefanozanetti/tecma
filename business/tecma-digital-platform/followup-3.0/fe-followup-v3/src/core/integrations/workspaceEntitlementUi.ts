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

/** Mappa connettore catalogo → feature commerciale (vetrina). */
export const CONNECTOR_CATALOG_ENTITLEMENT_FEATURE: Partial<
  Record<string, WorkspaceEntitlementFeature>
> = {
  connector_twilio: "twilio",
  connector_mailchimp: "mailchimp",
  connector_activecampaign: "activecampaign",
  connector_looker: "publicApi",
};

/**
 * Testo per card connettore quando il modulo non è abilitato sul workspace.
 */
export function commercialActivationFootnote(
  rows: WorkspaceEntitlementEffectiveRow[] | undefined,
  connectorId: string
): string | undefined {
  const feature = CONNECTOR_CATALOG_ENTITLEMENT_FEATURE[connectorId];
  if (!feature || rows === undefined) return undefined;
  const row = rows.find((r) => r.feature === feature);
  if (!row || row.entitled) return undefined;
  return "Modulo non attivo su questo workspace: per abilitarlo contatta Tecma (referente commerciale o supporto).";
}
