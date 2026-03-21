import type { ElementType } from "react";
import {
  CheckCircle2,
  Zap,
  AlertCircle,
  Clock,
  Plug,
} from "lucide-react";
import type { AutomationEventType } from "../../types/domain";

export const LOOKER_CONNECTOR_STORAGE_KEY = "followup3.connector.looker";

export const TAB_KEYS = ["connettori", "comunicazioni", "regole", "webhook", "api"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const isValidTab = (s: string | null): s is TabKey =>
  s !== null && TAB_KEYS.includes(s as TabKey);

export type ConnectorStatus = "available" | "beta" | "coming_soon" | "configured" | "error";
export type ConnectorGroup =
  | "Communication"
  | "Marketing"
  | "Workflow Automation"
  | "CRM/Lead Sources"
  | "Website/CMS"
  | "Data/BI"
  | "Docs/Signature"
  | "Productivity/Collab";

/** Tab da aprire per completare la configurazione (es. webhook, api). */
export type ConnectorRelatedTab = "webhook" | "api" | "comunicazioni";

/** Chiave per loghi brand in ConnectorBrandLogo (SVG). */
export type ConnectorBrandId =
  | "gmail"
  | "outlook"
  | "twilio"
  | "meta"
  | "mailchimp"
  | "n8n"
  | "salesforce"
  | "webflow"
  | "looker_studio"
  | "docusign"
  | "slack";

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  group: ConnectorGroup;
  status: ConnectorStatus;
  description: string;
  capabilities: string[];
  prerequisites: string[];
  /** Logo brand (decorativo; il titolo della card è il nome accessibile). */
  brandId?: ConnectorBrandId;
  /** Breve guida "Come attivare" per connettori già utilizzabili (n8n, Looker, Outlook). */
  setupSummary?: string;
  /** Tab da aprire con "Vai a ..." per configurare (Webhook per n8n, API per Looker). */
  relatedTab?: ConnectorRelatedTab;
}

export const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [
  {
    id: "connector_gmail",
    name: "Gmail",
    group: "Communication",
    status: "coming_soon",
    brandId: "gmail",
    description: "Ingestion email bidirezionale con timeline cliente e contatori mail ricevute.",
    capabilities: ["Mail ingestion", "Thread matching", "Timeline events"],
    prerequisites: ["Google OAuth app"],
  },
  {
    id: "connector_outlook",
    name: "Outlook",
    group: "Communication",
    status: "beta",
    brandId: "outlook",
    description: "Sincronizzazione casella Outlook e automazioni follow-up su activity.",
    capabilities: ["Mail sync", "Calendar sync hooks", "Timeline events"],
    prerequisites: ["Azure app registration"],
    setupSummary: "Integrazione OAuth Outlook in arrivo. Per ricevere notifiche su eventi CRM (nuova trattativa, cambio stato) usa intanto i Webhook (tab Webhook) verso un workflow che invia email o crea attività Outlook.",
    relatedTab: "webhook",
  },
  {
    id: "connector_twilio",
    name: "WhatsApp (Twilio)",
    group: "Communication",
    status: "available",
    brandId: "twilio",
    description:
      "Collegamento una tantum: con Twilio attivo, messaggi e regole del tab Comunicazioni possono essere recapitati su WhatsApp (per workspace).",
    capabilities: ["Invio WhatsApp", "SMS (policy Twilio)", "Messaggio di prova (admin)"],
    prerequisites: ["Account Twilio", "Numero WhatsApp approvato o sandbox"],
    setupSummary:
      "Apri Configura e inserisci Account SID, Auth Token e numero mittente WhatsApp. Poi definisci messaggi e regole nel tab Comunicazioni.",
    relatedTab: "comunicazioni",
  },
  {
    id: "connector_meta_whatsapp",
    name: "WhatsApp (Meta Cloud API)",
    group: "Communication",
    status: "available",
    brandId: "meta",
    description:
      "Invio WhatsApp tramite template approvati su Meta (WhatsApp Cloud API). Se configurato, ha priorità su Twilio per il medesimo workspace.",
    capabilities: ["Invio solo template approvati", "Parametri da variabili CRM", "Prova invio (admin)"],
    prerequisites: ["App Meta", "Phone Number ID", "Token di accesso", "Template approvati in Meta"],
    setupSummary:
      "Inserisci Phone Number ID e access token (Graph API). Nei messaggi WhatsApp del tab Comunicazioni indica nome template Meta, lingua e variabili nello stesso ordine dei placeholder {{1}}, {{2}}, …",
    relatedTab: "comunicazioni",
  },
  {
    id: "connector_mailchimp",
    name: "Mailchimp",
    group: "Marketing",
    status: "coming_soon",
    brandId: "mailchimp",
    description:
      "Segmenti marketing da profili CRM e trigger campagne da eventi trattativa. L’attivazione è commerciale: nessuna auto-provisioning dal portale.",
    capabilities: ["Segment sync", "Campaign trigger", "Bounce feedback"],
    prerequisites: ["Mailchimp API key", "Modulo abilitato da Tecma"],
  },
  {
    id: "connector_activecampaign",
    name: "ActiveCampaign",
    group: "Marketing",
    status: "coming_soon",
    description:
      "Automazioni e liste collegate al CRM. Stesso modello di Mailchimp: attivazione solo dopo accordo commerciale con Tecma.",
    capabilities: ["List sync", "Automation hooks", "Event triggers"],
    prerequisites: ["Account ActiveCampaign", "Modulo abilitato da Tecma"],
  },
  {
    id: "connector_n8n",
    name: "n8n",
    group: "Workflow Automation",
    status: "available",
    brandId: "n8n",
    description: "Event bus out/in per orchestrare workflow custom senza sviluppo backend dedicato.",
    capabilities: ["Webhook out", "Webhook in", "Retry hooks"],
    prerequisites: ["n8n endpoint", "Signing secret"],
    setupSummary: "Nel tab Webhook aggiungi un webhook con URL = URL del nodo Webhook del workflow n8n. Eventi disponibili: request.created, request.status_changed, client.created, calendar.event.created. Il payload viene inviato in POST con header X-Webhook-Signature (HMAC) se imposti un secret.",
    relatedTab: "webhook",
  },
  {
    id: "connector_salesforce",
    name: "Salesforce",
    group: "CRM/Lead Sources",
    status: "coming_soon",
    brandId: "salesforce",
    description: "Sincronizzazione lead/deal multi-tenant con mapping campo configurabile.",
    capabilities: ["Lead sync", "Deal sync", "Custom field mapping"],
    prerequisites: ["Salesforce connected app"],
  },
  {
    id: "connector_webflow",
    name: "Webflow",
    group: "Website/CMS",
    status: "coming_soon",
    brandId: "webflow",
    description: "Pubblicazione listing apartment-first su siti Webflow con sync near real-time.",
    capabilities: ["Listing publish", "Media sync", "Status update"],
    prerequisites: ["Webflow API token", "Collection mapping"],
  },
  {
    id: "connector_looker",
    name: "Looker Studio",
    group: "Data/BI",
    status: "available",
    brandId: "looker_studio",
    description: "Esportazione dataset per dashboard BI condivise e auditing operativo.",
    capabilities: ["Dataset export", "Scheduled push", "Schema mapping"],
    prerequisites: ["Destination connector"],
    setupSummary: "Endpoint GET e POST /v1/public/listings (nessuna auth, 60 req/min). Per Looker Studio: connettore Community nel repo (connectors/looker-studio) con README per deploy; oppure Custom API / Google Sheet / n8n che chiamano l'API.",
    relatedTab: "api",
  },
  {
    id: "connector_docusign",
    name: "DocuSign",
    group: "Docs/Signature",
    status: "coming_soon",
    brandId: "docusign",
    description: "Pipeline documentale per proposta/contratto con eventi firma in timeline.",
    capabilities: ["Envelope create", "Signature status", "Audit trail"],
    prerequisites: ["DocuSign account"],
  },
  {
    id: "connector_slack",
    name: "Slack",
    group: "Productivity/Collab",
    status: "coming_soon",
    brandId: "slack",
    description: "Notifiche operative vendor_manager/admin su eventi critici.",
    capabilities: ["Channel alerts", "Action digests", "Mention policies"],
    prerequisites: ["Slack app token"],
  },
];

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
