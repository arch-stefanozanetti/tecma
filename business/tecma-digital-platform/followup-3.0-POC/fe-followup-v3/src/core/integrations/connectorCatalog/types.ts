/** Tipi condivisi catalogo connettori (evita dipendenze circolari tra core / roadmap / integrationsCatalog). */

export type ConnectorStatus = "available" | "beta" | "coming_soon" | "configured" | "error";

export type ConnectorGroup =
  | "Communication"
  | "Marketing"
  | "Workflow Automation"
  | "CRM/Lead Sources"
  | "Website/CMS"
  | "Data/BI"
  | "Docs/Signature"
  | "Productivity/Collab"
  | "AI & Assistants"
  | "Compliance"
  | "Payments & Billing";

export type ConnectorCluster =
  | "communication"
  | "marketing"
  | "crm_sales"
  | "payments"
  | "content"
  | "data_bi"
  | "docs"
  | "productivity"
  | "compliance"
  | "automation"
  | "ai";

/** Tab da aprire per completare la configurazione (es. webhook, api). */
export type ConnectorRelatedTab = "webhook" | "api" | "comunicazioni";

/** Chiave logo in `ConnectorBrandLogo`; valori non mappati usano fallback Plug. */
export type ConnectorBrandId = string;

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  group: ConnectorGroup;
  status: ConnectorStatus;
  description: string;
  capabilities: string[];
  prerequisites: string[];
  brandId?: ConnectorBrandId;
  setupSummary?: string;
  relatedTab?: ConnectorRelatedTab;
  /** UX primaria per la connessione. */
  connectionMode?: "oauthDirect" | "guidedExternal" | "manualFallback";
  /** URL provider da aprire direttamente (nuova tab) nel flusso guidato. */
  providerConnectUrl?: string;
  /** Label pulsante per aprire provider. */
  providerConnectLabel?: string;
  /** Verifica automatica stato connessione disponibile. */
  supportsAutoVerify?: boolean;
  /** Se true, mostra la compilazione manuale solo come fallback avanzato. */
  hasAdvancedFallback?: boolean;
}

export const GROUP_TO_CLUSTER: Record<ConnectorGroup, ConnectorCluster> = {
  Communication: "communication",
  Marketing: "marketing",
  "Workflow Automation": "automation",
  "CRM/Lead Sources": "crm_sales",
  "Website/CMS": "content",
  "Data/BI": "data_bi",
  "Docs/Signature": "docs",
  "Productivity/Collab": "productivity",
  "AI & Assistants": "ai",
  Compliance: "compliance",
  "Payments & Billing": "payments",
};

export function getConnectorCluster(item: ConnectorCatalogItem): ConnectorCluster {
  return GROUP_TO_CLUSTER[item.group];
}
