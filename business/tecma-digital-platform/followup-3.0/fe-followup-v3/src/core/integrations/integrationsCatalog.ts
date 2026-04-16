import type { ElementType } from "react";
import {
  CheckCircle2,
  Zap,
  AlertCircle,
  Clock,
  Plug,
} from "lucide-react";
import type { AutomationEventType } from "../../types/domain";
import {
  type ConnectorCatalogItem,
  type ConnectorCluster,
  type ConnectorGroup,
  type ConnectorStatus,
} from "./connectorCatalog/types";
import { coreConnectors } from "./connectorCatalog/coreConnectors";
import { roadmapConnectors } from "./connectorCatalog/roadmapConnectors";

export type {
  ConnectorBrandId,
  ConnectorCatalogItem,
  ConnectorCluster,
  ConnectorGroup,
  ConnectorRelatedTab,
  ConnectorStatus,
} from "./connectorCatalog/types";
export { GROUP_TO_CLUSTER, getConnectorCluster } from "./connectorCatalog/types";

export const LOOKER_CONNECTOR_STORAGE_KEY = "followup3.connector.looker";

export const TAB_KEYS = ["connettori", "comunicazioni", "regole", "webhook", "api"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const isValidTab = (s: string | null): s is TabKey =>
  s !== null && TAB_KEYS.includes(s as TabKey);

export const CONNECTOR_CLUSTER_LABELS: Record<ConnectorCluster, string> = {
  communication: "Comunicazione & canali",
  marketing: "Marketing & growth",
  crm_sales: "CRM, lead & vendite",
  payments: "Pagamenti & fatturazione",
  content: "Siti & contenuti",
  data_bi: "Dati & BI",
  docs: "Documenti & firma",
  productivity: "Produttività & collab",
  compliance: "Compliance & KYC",
  automation: "Automazione & orchestrazione",
};

/** Testo opzionale sotto il titolo di sezione (contesto prodotto per cluster densi). */
export const CONNECTOR_CLUSTER_SECTION_INTRO: Partial<Record<ConnectorCluster, string>> = {
  payments:
    "Incassi, POS e gateway: molte integrazioni sono in roadmap o richiedono accordo con il PSP. Lo stato «In arrivo» indica che non c’è ancora un flusso di configurazione guidata nel portale; contatta Tecma per priorità e progetto.",
  data_bi:
    "Replica in warehouse, BI self-service, orchestrazione ETL e osservabilità: modelli curati e KPI condivisi tra commerciale, marketing e direzione, senza esporre il database operativo.",
  docs:
    "Dalla proposta al contratto firmato e archiviato: firme elettroniche, template legali, integrazione con ERP/DMS (es. TeamSystem) e tracciamento in timeline CRM per audit e conformità.",
};

/** Ordine di visualizzazione delle sezioni «Altri connettori». */
export const CONNECTOR_CLUSTER_ORDER: ConnectorCluster[] = [
  "communication",
  "marketing",
  "crm_sales",
  "payments",
  "content",
  "data_bi",
  "docs",
  "productivity",
  "compliance",
  "automation",
];

/** Catalogo unificato: connettori core (configurabili / prioritari) + roadmap estesa. */
export const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [...coreConnectors, ...roadmapConnectors];

export const STATUS_CONFIG: Record<
  ConnectorStatus,
  { label: string; badgeClass: string; icon: ElementType }
> = {
  configured: {
    label: "Configurato",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  beta: {
    label: "Beta",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Zap,
  },
  available: {
    label: "Disponibile",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Plug,
  },
  error: {
    label: "Errore",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  },
  coming_soon: {
    label: "In arrivo",
    badgeClass: "bg-muted text-muted-foreground border-border",
    icon: Clock,
  },
};

export const ALL_GROUPS: ConnectorGroup[] = [
  "Communication",
  "Marketing",
  "Workflow Automation",
  "CRM/Lead Sources",
  "Website/CMS",
  "Data/BI",
  "Docs/Signature",
  "Productivity/Collab",
  "Compliance",
  "Payments & Billing",
];

export const CONNECTOR_EVENT_LABELS: Record<AutomationEventType, string> = {
  "request.created": "Nuova trattativa",
  "request.status_changed": "Cambio stato trattativa",
  "client.created": "Nuovo cliente",
};

/** Alias per uso in Regole/Webhook tab. */
export const EVENT_LABELS = CONNECTOR_EVENT_LABELS;

export type N8nConfigSnapshot = {
  baseUrl: string;
  apiKeyMasked?: string;
  defaultWorkflowId?: string;
} | null;

export type SumsubConfigSnapshot = {
  levelName: string;
  appTokenMasked?: string;
  secretKeyMasked?: string;
  webhookSecretMasked?: string;
  webhookPathTemplate?: string;
} | null;
