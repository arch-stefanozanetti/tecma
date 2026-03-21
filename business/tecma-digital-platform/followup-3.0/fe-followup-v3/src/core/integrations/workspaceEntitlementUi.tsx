import type { ReactNode } from "react";
import type { WorkspaceEntitlementEffectiveRow, WorkspaceEntitlementFeature } from "../../types/domain";
import { commercialContactInlineNode } from "./tecmaCommercialContact";

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
): ReactNode | undefined {
  const feature = CONNECTOR_CATALOG_ENTITLEMENT_FEATURE[connectorId];
  if (!feature || rows === undefined) return undefined;
  const row = rows.find((r) => r.feature === feature);
  if (!row || row.entitled) return undefined;
  const contact = commercialContactInlineNode();
  return (
    <>
      Modulo non attivo su questo workspace: per abilitarlo contatta Tecma (referente commerciale o supporto).
      {contact}
    </>
  );
}

/** Connettori marketing: richiedono Integrazioni + Mailchimp/ActiveCampaign (allineato al gate API). */
export function connectorEntitlementFootnote(
  rows: WorkspaceEntitlementEffectiveRow[] | undefined,
  connectorId: string
): ReactNode | undefined {
  if (rows === undefined) return undefined;
  if (connectorId === "connector_mailchimp") {
    if (workspaceFeatureEntitled(rows, "integrations") && workspaceFeatureEntitled(rows, "mailchimp")) return undefined;
    const contact = commercialContactInlineNode();
    return (
      <>
        Richiede Integrazioni e Mailchimp attivi su questo workspace. Contatta Tecma (referente commerciale o supporto).
        {contact}
      </>
    );
  }
  if (connectorId === "connector_activecampaign") {
    if (workspaceFeatureEntitled(rows, "integrations") && workspaceFeatureEntitled(rows, "activecampaign")) return undefined;
    const contact = commercialContactInlineNode();
    return (
      <>
        Richiede Integrazioni e ActiveCampaign attivi su questo workspace. Contatta Tecma (referente commerciale o supporto).
        {contact}
      </>
    );
  }
  return commercialActivationFootnote(rows, connectorId);
}
