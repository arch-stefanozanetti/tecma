import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCcw,
  Plug,
  Webhook,
  FileText,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type {
  AutomationRuleRow,
  AutomationRuleTrigger,
  CreateNotificationAction,
  WebhookConfigRow,
  AutomationEventType,
} from "../../types/domain";
import { cn } from "../../lib/utils";

const LOOKER_CONNECTOR_STORAGE_KEY = "followup3.connector.looker";

const TAB_KEYS = ["connettori", "comunicazioni", "regole", "webhook", "api"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const isValidTab = (s: string | null): s is TabKey =>
  s !== null && TAB_KEYS.includes(s as TabKey);

type ConnectorStatus = "available" | "beta" | "coming_soon" | "configured" | "error";
type ConnectorGroup =
  | "Communication"
  | "Marketing"
  | "Workflow Automation"
  | "CRM/Lead Sources"
  | "Website/CMS"
  | "Data/BI"
  | "Docs/Signature"
  | "Productivity/Collab";

/** Tab da aprire per completare la configurazione (es. webhook, api). */
export type ConnectorRelatedTab = "webhook" | "api";

interface ConnectorCatalogItem {
  id: string;
  name: string;
  group: ConnectorGroup;
  status: ConnectorStatus;
  description: string;
  capabilities: string[];
  prerequisites: string[];
  /** Breve guida "Come attivare" per connettori già utilizzabili (n8n, Looker, Outlook). */
  setupSummary?: string;
  /** Tab da aprire con "Vai a ..." per configurare (Webhook per n8n, API per Looker). */
  relatedTab?: ConnectorRelatedTab;
}

const CONNECTOR_CATALOG: ConnectorCatalogItem[] = [
  {
    id: "connector_gmail",
    name: "Gmail",
    group: "Communication",
    status: "beta",
    description: "Ingestion email bidirezionale con timeline cliente e contatori mail ricevute.",
    capabilities: ["Mail ingestion", "Thread matching", "Timeline events"],
    prerequisites: ["Google OAuth app"],
  },
  {
    id: "connector_outlook",
    name: "Outlook",
    group: "Communication",
    status: "beta",
    description: "Sincronizzazione casella Outlook e automazioni follow-up su activity.",
    capabilities: ["Mail sync", "Calendar sync hooks", "Timeline events"],
    prerequisites: ["Azure app registration"],
    setupSummary: "Integrazione OAuth Outlook in arrivo. Per ricevere notifiche su eventi CRM (nuova trattativa, cambio stato) usa intanto i Webhook (tab Webhook) verso un workflow che invia email o crea attività Outlook.",
    relatedTab: "webhook",
  },
  {
    id: "connector_mailchimp",
    name: "Mailchimp",
    group: "Marketing",
    status: "available",
    description: "Segmenti marketing da profili CRM e trigger campagne da eventi trattativa.",
    capabilities: ["Segment sync", "Campaign trigger", "Bounce feedback"],
    prerequisites: ["Mailchimp API key"],
  },
  {
    id: "connector_n8n",
    name: "n8n",
    group: "Workflow Automation",
    status: "available",
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
    description: "Sincronizzazione lead/deal multi-tenant con mapping campo configurabile.",
    capabilities: ["Lead sync", "Deal sync", "Custom field mapping"],
    prerequisites: ["Salesforce connected app"],
  },
  {
    id: "connector_webflow",
    name: "Webflow",
    group: "Website/CMS",
    status: "available",
    description: "Pubblicazione listing apartment-first su siti Webflow con sync near real-time.",
    capabilities: ["Listing publish", "Media sync", "Status update"],
    prerequisites: ["Webflow API token", "Collection mapping"],
  },
  {
    id: "connector_looker",
    name: "Looker Studio",
    group: "Data/BI",
    status: "available",
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
    description: "Pipeline documentale per proposta/contratto con eventi firma in timeline.",
    capabilities: ["Envelope create", "Signature status", "Audit trail"],
    prerequisites: ["DocuSign account"],
  },
  {
    id: "connector_slack",
    name: "Slack",
    group: "Productivity/Collab",
    status: "available",
    description: "Notifiche operative vendor_manager/admin su eventi critici.",
    capabilities: ["Channel alerts", "Action digests", "Mention policies"],
    prerequisites: ["Slack app token"],
  },
];

const STATUS_CONFIG: Record<
  ConnectorStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
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

const ALL_GROUPS: ConnectorGroup[] = [
  "Communication",
  "Marketing",
  "Workflow Automation",
  "CRM/Lead Sources",
  "Website/CMS",
  "Data/BI",
  "Docs/Signature",
  "Productivity/Collab",
];

const CONNECTOR_EVENT_LABELS: Record<AutomationEventType, string> = {
  "request.created": "Nuova trattativa",
  "request.status_changed": "Cambio stato trattativa",
  "client.created": "Nuovo cliente",
};

export type N8nConfigSnapshot = {
  baseUrl: string;
  apiKeyMasked?: string;
  defaultWorkflowId?: string;
} | null;

function ConnettoriTab({
  connectors,
  setConnectors,
  onOpenTab,
  workspaceId = "",
  webhookConfigs = [],
  loadWebhooks,
  projectIds = [],
  n8nConfig = null,
  loadN8nConfig,
  outlookConnected = false,
  loadOutlookStatus,
}: {
  connectors: ConnectorCatalogItem[];
  setConnectors: React.Dispatch<React.SetStateAction<ConnectorCatalogItem[]>>;
  onOpenTab?: (tab: ConnectorRelatedTab) => void;
  workspaceId?: string;
  webhookConfigs?: WebhookConfigRow[];
  loadWebhooks?: () => void;
  projectIds?: string[];
  n8nConfig?: N8nConfigSnapshot;
  loadN8nConfig?: () => void;
  outlookConnected?: boolean;
  loadOutlookStatus?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | ConnectorGroup>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [setupConnectorId, setSetupConnectorId] = useState<string | null>(null);
  const [connectorConfigDrawer, setConnectorConfigDrawer] = useState<"connector_n8n" | "connector_outlook" | "connector_looker" | null>(null);
  const [connectorFormUrl, setConnectorFormUrl] = useState("");
  const [connectorFormSecret, setConnectorFormSecret] = useState("");
  const [connectorFormEvents, setConnectorFormEvents] = useState<AutomationEventType[]>(["request.created", "request.status_changed"]);
  const [connectorFormEnabled, setConnectorFormEnabled] = useState(true);
  const [connectorSaving, setConnectorSaving] = useState(false);
  const [lookerTesting, setLookerTesting] = useState(false);
  const [lookerTestError, setLookerTestError] = useState<string | null>(null);
  const [n8nFormBaseUrl, setN8nFormBaseUrl] = useState("");
  const [n8nFormApiKey, setN8nFormApiKey] = useState("");
  const [n8nFormWorkflowId, setN8nFormWorkflowId] = useState("");
  const [n8nTestTriggering, setN8nTestTriggering] = useState(false);
  const [n8nTestError, setN8nTestError] = useState<string | null>(null);
  const [outlookConnecting, setOutlookConnecting] = useState(false);
  const [outlookCalendarEvents, setOutlookCalendarEvents] = useState<Array<{ id: string; subject: string; start: string; end: string; isAllDay?: boolean; webLink?: string }>>([]);
  const [outlookCalendarLoading, setOutlookCalendarLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connectors.filter((c) => {
      if (groupFilter !== "all" && c.group !== groupFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.group} ${c.description} ${c.capabilities.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [connectors, search, groupFilter]);

  const configuredCount = connectors.filter((c) => c.status === "configured").length;

  const openConnectorConfig = (id: "connector_n8n" | "connector_outlook" | "connector_looker") => {
    const connectorId = id === "connector_n8n" ? "n8n" : id === "connector_outlook" ? "outlook" : null;
    if (id === "connector_n8n") {
      setN8nFormBaseUrl(n8nConfig?.baseUrl ?? "");
      setN8nFormApiKey("");
      setN8nFormWorkflowId(n8nConfig?.defaultWorkflowId ?? "");
      setN8nTestError(null);
    } else if (connectorId) {
      const existing = webhookConfigs.find((w) => w.connectorId === connectorId);
      setConnectorFormUrl(existing?.url ?? "");
      setConnectorFormSecret(existing?.secret ?? "");
      setConnectorFormEvents(existing?.events?.length ? existing.events : ["request.created", "request.status_changed"]);
      setConnectorFormEnabled(existing?.enabled ?? true);
    } else {
      setLookerTestError(null);
    }
    setConnectorConfigDrawer(id);
  };

  const closeConnectorConfig = () => {
    setConnectorConfigDrawer(null);
  };

  const toggleConnector = (id: string) => {
    if (id === "connector_n8n" || id === "connector_outlook" || id === "connector_looker") {
      const conn = connectors.find((c) => c.id === id);
      if (conn?.status === "configured") {
        if (id === "connector_looker") {
          try {
            if (workspaceId) window.localStorage?.removeItem(`${LOOKER_CONNECTOR_STORAGE_KEY}.${workspaceId}`);
          } catch {}
          setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
        } else if (id === "connector_n8n") {
          setTogglingId(id);
          const deleteN8n = workspaceId ? followupApi.deleteN8nConfig(workspaceId) : Promise.resolve({ deleted: false });
          const wh = webhookConfigs.find((w) => w.connectorId === "n8n");
          const deleteWh = wh ? followupApi.deleteWebhookConfig(wh._id) : Promise.resolve({ deleted: false });
          Promise.all([deleteN8n, deleteWh])
            .then(() => {
              loadWebhooks?.();
              loadN8nConfig?.();
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
            })
            .catch((err) => window.alert(err?.message ?? "Errore disconnessione"))
            .finally(() => setTogglingId(null));
        } else if (id === "connector_outlook") {
          setTogglingId(id);
          const deleteOAuth = followupApi.deleteOutlook(workspaceId);
          const wh = webhookConfigs.find((w) => w.connectorId === "outlook");
          const deleteWh = wh ? followupApi.deleteWebhookConfig(wh._id) : Promise.resolve({ deleted: false });
          Promise.all([deleteOAuth, deleteWh])
            .then(() => {
              loadOutlookStatus?.();
              loadWebhooks?.();
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "beta" } : c)));
            })
            .catch((err) => window.alert(err?.message ?? "Errore disconnessione"))
            .finally(() => setTogglingId(null));
        }
      } else {
        openConnectorConfig(id);
      }
      return;
    }
    setTogglingId(id);
    setTimeout(() => {
      setConnectors((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          if (c.status === "configured") return { ...c, status: "available" };
          if (c.status === "coming_soon") return c;
          return { ...c, status: "configured" };
        })
      );
      setTogglingId(null);
    }, 600);
  };

  const toggleConnectorFormEvent = (e: AutomationEventType) => {
    setConnectorFormEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  };

  const saveConnectorWebhook = () => {
    if (!workspaceId || connectorConfigDrawer === "connector_looker") return;
    if (!connectorFormUrl.trim()) {
      window.alert("Inserisci l'URL del webhook.");
      return;
    }
    if (connectorFormEvents.length === 0) {
      window.alert("Seleziona almeno un evento.");
      return;
    }
    const connectorId = connectorConfigDrawer === "connector_n8n" ? "n8n" : "outlook";
    const existing = webhookConfigs.find((w) => w.connectorId === connectorId);
    setConnectorSaving(true);
    const payload = {
      url: connectorFormUrl.trim(),
      secret: connectorFormSecret.trim() || undefined,
      events: connectorFormEvents,
      enabled: connectorFormEnabled,
      connectorId,
    };
    const done = () => {
      setConnectorSaving(false);
      setConnectorConfigDrawer(null);
      loadWebhooks?.();
      setConnectors((prev) => prev.map((c) => (c.id === connectorConfigDrawer ? { ...c, status: "configured" } : c)));
    };
    if (existing) {
      followupApi
        .updateWebhookConfig(existing._id, payload)
        .then(done)
        .catch((err) => {
          setConnectorSaving(false);
          window.alert(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createWebhookConfig(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setConnectorSaving(false);
          window.alert(err?.message ?? "Errore creazione");
        });
    }
  };

  const testLookerConnection = () => {
    if (!workspaceId || projectIds.length === 0) {
      setLookerTestError("Seleziona almeno un progetto nel workspace.");
      return;
    }
    setLookerTesting(true);
    setLookerTestError(null);
    followupApi
      .testPublicListings(workspaceId, projectIds)
      .then(() => {
        try {
          if (workspaceId) window.localStorage?.setItem(`${LOOKER_CONNECTOR_STORAGE_KEY}.${workspaceId}`, "true");
        } catch {}
        setConnectors((prev) => prev.map((c) => (c.id === "connector_looker" ? { ...c, status: "configured" } : c)));
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setLookerTestError(err?.message ?? "Test fallito"))
      .finally(() => setLookerTesting(false));
  };

  const saveN8nConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_n8n") return;
    const baseUrl = n8nFormBaseUrl.trim().replace(/\/$/, "");
    if (!baseUrl) {
      window.alert("Inserisci l'URL base dell'istanza n8n (es. https://n8n.example.com).");
      return;
    }
    const apiKey = n8nFormApiKey.trim();
    if (!apiKey && !n8nConfig?.baseUrl) {
      window.alert("Inserisci l'API key n8n (Settings → API in n8n).");
      return;
    }
    if (!apiKey) {
      window.alert("Per salvare è necessario inserire l'API key (il backend non conserva la key precedente).");
      return;
    }
    setConnectorSaving(true);
    setN8nTestError(null);
    followupApi
      .saveN8nConfig(workspaceId, {
        baseUrl,
        apiKey: n8nFormApiKey.trim(),
        defaultWorkflowId: n8nFormWorkflowId.trim() || undefined,
      })
      .then(() => {
        loadN8nConfig?.();
        setConnectors((prev) => prev.map((c) => (c.id === "connector_n8n" ? { ...c, status: "configured" } : c)));
        setConnectorConfigDrawer(null);
      })
      .catch((err) => {
        setConnectorSaving(false);
        window.alert(err?.message ?? "Errore salvataggio config n8n");
      })
      .finally(() => setConnectorSaving(false));
  };

  const connectOutlook = () => {
    setOutlookConnecting(true);
    followupApi
      .getOutlookAuthRedirect(workspaceId)
      .then((url) => {
        window.location.href = url;
      })
      .catch((err) => {
        setOutlookConnecting(false);
        window.alert(err?.message ?? "Errore avvio connessione Outlook");
      });
  };

  const loadOutlookCalendar = () => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 14);
    const dateFrom = from.toISOString();
    const dateTo = to.toISOString();
    setOutlookCalendarLoading(true);
    followupApi
      .getOutlookCalendarEvents(dateFrom, dateTo, workspaceId)
      .then((r) => setOutlookCalendarEvents(r.data ?? []))
      .catch(() => setOutlookCalendarEvents([]))
      .finally(() => setOutlookCalendarLoading(false));
  };

  const testN8nTrigger = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_n8n") return;
    const wfId = n8nFormWorkflowId.trim() || undefined;
    if (!wfId && !n8nConfig?.defaultWorkflowId) {
      setN8nTestError("Salva prima la config con un Workflow ID di default, oppure inserisci un Workflow ID qui per il test.");
      return;
    }
    setN8nTestTriggering(true);
    setN8nTestError(null);
    followupApi
      .triggerN8nWorkflow(workspaceId, { workflowId: wfId || undefined, data: { test: true, source: "integrations_ui" } })
      .then(() => {
        setN8nTestError(null);
        window.alert("Workflow avviato con successo.");
      })
      .catch((err) => setN8nTestError(err?.message ?? "Test trigger fallito"))
      .finally(() => setN8nTestTriggering(false));
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-lg border-border pl-10 text-sm"
            placeholder="Cerca connettore..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v as "all" | ConnectorGroup)}>
          <SelectTrigger className="h-10 w-[200px] rounded-lg border-border text-sm">
            <SelectValue placeholder="Tutti i gruppi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i gruppi</SelectItem>
            {ALL_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} connettori</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((connector) => {
          const cfg = STATUS_CONFIG[connector.status];
          const StatusIcon = cfg.icon;
          const isConfigured = connector.status === "configured";
          const isComingSoon = connector.status === "coming_soon";

          return (
            <div
              key={connector.id}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
                isConfigured ? "border-green-200" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{connector.name}</h3>
                  <p className="text-xs text-muted-foreground">{connector.group}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    cfg.badgeClass
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {cfg.label}
                </span>
              </div>

              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {connector.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1">
                {connector.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {cap}
                  </span>
                ))}
              </div>

              {connector.prerequisites.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Richiede: {connector.prerequisites.join(", ")}
                </p>
              )}

              {(connector.setupSummary ?? connector.relatedTab) && (
                <div className="mt-3 space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-primary hover:text-primary"
                    onClick={() => setSetupConnectorId(setupConnectorId === connector.id ? null : connector.id)}
                  >
                    Come attivare
                  </Button>
                  {setupConnectorId === connector.id && (
                    <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                      {connector.setupSummary}
                      {connector.relatedTab && onOpenTab && (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-2 h-auto p-0 text-xs font-medium text-primary"
                          onClick={() => {
                            onOpenTab(connector.relatedTab!);
                            setSetupConnectorId(null);
                          }}
                        >
                          Vai al tab {connector.relatedTab === "webhook" ? "Webhook" : "API"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant={isConfigured ? "outline" : "default"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  disabled={isComingSoon || togglingId === connector.id}
                  onClick={() => toggleConnector(connector.id)}
                >
                  {togglingId === connector.id ? (
                    <>
                      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      {isConfigured ? "Disconnessione..." : "Configurazione..."}
                    </>
                  ) : isConfigured ? (
                    "Disconnetti"
                  ) : isComingSoon ? (
                    "Non disponibile"
                  ) : (
                    "Configura"
                  )}
                </Button>
                {isConfigured && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={togglingId === connector.id}
                    onClick={() => {
                      setTogglingId(connector.id);
                      setTimeout(() => setTogglingId(null), 800);
                    }}
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Health check
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center text-muted-foreground">
          <Plug className="mx-auto h-10 w-10 opacity-30" />
          <p className="mt-3 text-sm">Nessun connettore trovato per questa ricerca.</p>
        </div>
      )}

      <Drawer open={!!connectorConfigDrawer} onOpenChange={(open) => !open && closeConnectorConfig()}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>
              {connectorConfigDrawer === "connector_n8n" && "Configura n8n"}
              {connectorConfigDrawer === "connector_outlook" && "Configura Outlook"}
              {connectorConfigDrawer === "connector_looker" && "Configura Looker Studio"}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            {connectorConfigDrawer === "connector_looker" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Verifica che l&apos;API listati pubblici sia raggiungibile con il workspace e i progetti correnti. Se il test ha esito positivo, il connettore verrà considerato configurato.
                </p>
                {projectIds.length === 0 && (
                  <p className="text-sm text-amber-600">Seleziona almeno un progetto nel selettore progetti (sidebar) per poter testare.</p>
                )}
                {lookerTestError && <p className="text-sm text-destructive">{lookerTestError}</p>}
                <Button onClick={testLookerConnection} disabled={lookerTesting || projectIds.length === 0}>
                  {lookerTesting ? "Test in corso..." : "Test connessione"}
                </Button>
              </>
            )}
            {connectorConfigDrawer === "connector_n8n" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Configura l&apos;istanza n8n e l&apos;API key per avviare workflow dagli eventi CRM. Opzionale: Workflow ID di default (altrimenti specificabile per ogni trigger).
                </p>
                <div>
                  <label htmlFor="n8n-base-url" className="text-sm font-medium text-foreground">Base URL n8n</label>
                  <Input
                    id="n8n-base-url"
                    type="url"
                    value={n8nFormBaseUrl}
                    onChange={(e) => setN8nFormBaseUrl(e.target.value)}
                    placeholder="https://n8n.example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="n8n-api-key" className="text-sm font-medium text-foreground">API key</label>
                  <Input
                    id="n8n-api-key"
                    type="password"
                    value={n8nFormApiKey}
                    onChange={(e) => setN8nFormApiKey(e.target.value)}
                    placeholder={n8nConfig?.apiKeyMasked ? `Già configurata (${n8nConfig.apiKeyMasked}); inserisci nuova key per aggiornare` : "Da Settings → API in n8n"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="n8n-workflow-id" className="text-sm font-medium text-foreground">Workflow ID (opzionale)</label>
                  <Input
                    id="n8n-workflow-id"
                    type="text"
                    value={n8nFormWorkflowId}
                    onChange={(e) => setN8nFormWorkflowId(e.target.value)}
                    placeholder="ID del workflow da avviare sugli eventi"
                    className="mt-1"
                  />
                </div>
                {n8nTestError && <p className="text-sm text-destructive">{n8nTestError}</p>}
              </>
            )}
            {connectorConfigDrawer === "connector_outlook" && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Connessione calendario (OAuth Microsoft)</p>
                  {outlookConnected ? (
                    <>
                      <p className="text-sm text-muted-foreground">Outlook connesso. Puoi disconnettere dalla scheda o vedere gli eventi.</p>
                      <Button variant="outline" size="sm" onClick={loadOutlookCalendar} disabled={outlookCalendarLoading}>
                        {outlookCalendarLoading ? "Caricamento..." : "Vedi eventi calendario (14 gg)"}
                      </Button>
                      {outlookCalendarEvents.length > 0 && (
                        <ul className="mt-2 max-h-48 overflow-auto rounded border border-border p-2 text-xs">
                          {outlookCalendarEvents.map((e) => (
                            <li key={e.id} className="flex justify-between gap-2 py-1">
                              <span className="truncate">{e.subject || "(Senza oggetto)"}</span>
                              <span className="shrink-0 text-muted-foreground">{e.start.slice(0, 16)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Connetti il tuo account Microsoft per leggere il calendario Outlook.</p>
                      <Button onClick={connectOutlook} disabled={outlookConnecting}>
                        {outlookConnecting ? "Reindirizzamento..." : "Connetti Outlook"}
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">Oppure: webhook (eventi CRM verso un URL)</p>
                <div>
                  <label htmlFor="conn-wh-url" className="text-sm font-medium text-foreground">URL webhook</label>
                  <Input
                    id="conn-wh-url"
                    type="url"
                    value={connectorFormUrl}
                    onChange={(e) => setConnectorFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="conn-wh-secret" className="text-sm font-medium text-foreground">Secret (opzionale, per firma HMAC)</label>
                  <Input
                    id="conn-wh-secret"
                    type="password"
                    value={connectorFormSecret}
                    onChange={(e) => setConnectorFormSecret(e.target.value)}
                    placeholder="Secret per X-Webhook-Signature"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Eventi</label>
                  <div className="mt-2 flex flex-col gap-2">
                    {(Object.keys(CONNECTOR_EVENT_LABELS) as AutomationEventType[]).map((e) => (
                      <div key={e} className="flex items-center gap-2">
                        <Checkbox
                          id={`conn-ev-${e}`}
                          checked={connectorFormEvents.includes(e)}
                          onCheckedChange={() => toggleConnectorFormEvent(e)}
                        />
                        <label htmlFor={`conn-ev-${e}`} className="text-sm font-normal text-foreground cursor-pointer">{CONNECTOR_EVENT_LABELS[e]}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="conn-wh-enabled"
                    checked={connectorFormEnabled}
                    onCheckedChange={(c) => setConnectorFormEnabled(c === true)}
                  />
                  <label htmlFor="conn-wh-enabled" className="text-sm font-normal text-foreground cursor-pointer">Webhook attivo</label>
                </div>
              </>
            )}
          </DrawerBody>
          {connectorConfigDrawer === "connector_n8n" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button onClick={saveN8nConfig} disabled={connectorSaving}>
                {connectorSaving ? "Salvataggio..." : "Salva"}
              </Button>
              <Button variant="outline" onClick={testN8nTrigger} disabled={n8nTestTriggering || connectorSaving}>
                {n8nTestTriggering ? "Test in corso..." : "Test trigger"}
              </Button>
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_outlook" && (
            <DrawerFooter>
              <Button onClick={saveConnectorWebhook} disabled={connectorSaving}>
                {connectorSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

const EVENT_LABELS: Record<AutomationEventType, string> = {
  "request.created": "Nuova trattativa",
  "request.status_changed": "Cambio stato trattativa",
  "client.created": "Nuovo cliente",
};

function RegoleTab({ workspaceId }: { workspaceId: string }) {
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEventType, setFormEventType] = useState<AutomationEventType>("request.status_changed");
  const [formToStatus, setFormToStatus] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  const loadRules = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    followupApi
      .listAutomationRules(workspaceId)
      .then((res) => setRules(res.data ?? []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormEventType("request.status_changed");
    setFormToStatus("");
    setFormTitle("");
    setFormBody("");
    setFormEnabled(true);
    setDrawerOpen(true);
  };

  const openEdit = (r: AutomationRuleRow) => {
    setEditingId(r._id);
    setFormName(r.name);
    setFormEventType(r.trigger.event_type);
    setFormToStatus(r.trigger.toStatus ?? "");
    const notif = r.actions.find((a) => a.type === "create_notification") as CreateNotificationAction | undefined;
    setFormTitle(notif?.title ?? "");
    setFormBody(notif?.body ?? "");
    setFormEnabled(r.enabled);
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formTitle.trim()) return;
    setSaving(true);
    const trigger: AutomationRuleTrigger = { event_type: formEventType };
    if (formEventType === "request.status_changed" && formToStatus.trim()) trigger.toStatus = formToStatus.trim();
    const payload = {
      name: formName.trim(),
      enabled: formEnabled,
      trigger,
      actions: [{ type: "create_notification" as const, title: formTitle.trim(), body: formBody.trim() || undefined }],
    };
    const done = () => {
      setSaving(false);
      setDrawerOpen(false);
      loadRules();
    };
    if (editingId) {
      followupApi
        .updateAutomationRule(editingId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          window.alert(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createAutomationRule(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          window.alert(err?.message ?? "Errore creazione");
        });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Eliminare questa regola?")) return;
    followupApi
      .deleteAutomationRule(id)
      .then(() => loadRules())
      .catch((err) => window.alert(err?.message ?? "Errore eliminazione"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Regole if/then: quando un evento si verifica (es. trattativa passa a stato X, nuovo cliente)
          esegui un&apos;azione (notifica, webhook). Le notifiche create compariranno in Inbox.
        </p>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuova regola
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  Quando: {EVENT_LABELS[r.trigger.event_type]}
                  {r.trigger.toStatus && ` → ${r.trigger.toStatus}`} · Azione: crea notifica
                  {!r.enabled && " · Disabilitata"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(r._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && rules.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <GitBranch className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3 text-sm">Nessuna regola configurata. Crea la prima regola per automatizzare azioni su eventi.</p>
        </div>
      )}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{editingId ? "Modifica regola" : "Nuova regola"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div>
              <label htmlFor="rule-name" className="text-sm font-medium text-foreground">Nome</label>
              <Input
                id="rule-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Es. Notifica su vinto"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Trigger</label>
              <Select value={formEventType} onValueChange={(v) => setFormEventType(v as AutomationEventType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_LABELS) as AutomationEventType[]).map((k) => (
                    <SelectItem key={k} value={k}>{EVENT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formEventType === "request.status_changed" && (
                <Input
                  placeholder="Stato di destinazione (opzionale)"
                  value={formToStatus}
                  onChange={(e) => setFormToStatus(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <label htmlFor="notif-title" className="text-sm font-medium text-foreground">Titolo notifica</label>
              <Input
                id="notif-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Es. Trattativa vinta"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="notif-body" className="text-sm font-medium text-foreground">Corpo (opzionale)</label>
              <Input
                id="notif-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Testo della notifica"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rule-enabled" checked={formEnabled} onCheckedChange={(c) => setFormEnabled(c === true)} />
              <label htmlFor="rule-enabled" className="text-sm font-normal text-foreground cursor-pointer">Regola attiva</label>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function WebhookTab({ workspaceId }: { workspaceId: string }) {
  const [configs, setConfigs] = useState<WebhookConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<AutomationEventType[]>(["request.created", "request.status_changed"]);
  const [formEnabled, setFormEnabled] = useState(true);

  const loadConfigs = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    followupApi
      .listWebhookConfigs(workspaceId)
      .then((res) => setConfigs(res.data ?? []))
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const toggleEvent = (e: AutomationEventType) => {
    setFormEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setFormUrl("");
    setFormSecret("");
    setFormEvents(["request.created", "request.status_changed"]);
    setFormEnabled(true);
    setDrawerOpen(true);
  };

  const openEdit = (c: WebhookConfigRow) => {
    setEditingId(c._id);
    setFormUrl(c.url);
    setFormSecret(c.secret ?? "");
    setFormEvents(c.events.length ? c.events : ["request.created", "request.status_changed"]);
    setFormEnabled(c.enabled);
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (!formUrl.trim()) return;
    if (formEvents.length === 0) {
      window.alert("Seleziona almeno un evento.");
      return;
    }
    setSaving(true);
    const payload = {
      url: formUrl.trim(),
      secret: formSecret.trim() || undefined,
      events: formEvents,
      enabled: formEnabled,
    };
    const done = () => {
      setSaving(false);
      setDrawerOpen(false);
      loadConfigs();
    };
    if (editingId) {
      followupApi
        .updateWebhookConfig(editingId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          window.alert(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createWebhookConfig(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          window.alert(err?.message ?? "Errore creazione");
        });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Eliminare questo webhook?")) return;
    followupApi
      .deleteWebhookConfig(id)
      .then(() => loadConfigs())
      .catch((err) => window.alert(err?.message ?? "Errore eliminazione"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Endpoint configurabile per workspace: il backend invierà payload su eventi (nuova trattativa,
          cambio stato). Configura URL, secret e eventi abilitati.
        </p>
        <Button size="sm" variant="outline" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Aggiungi webhook
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!loading && configs.length > 0 && (
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <div className="font-medium text-foreground">{c.url}</div>
                <div className="text-xs text-muted-foreground">
                  Eventi: {c.events.map((e) => EVENT_LABELS[e]).join(", ")}
                  {!c.enabled && " · Disabilitato"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(c._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && configs.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Webhook className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3 text-sm">Nessun webhook configurato. Aggiungi un endpoint per ricevere eventi in tempo reale.</p>
        </div>
      )}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{editingId ? "Modifica webhook" : "Aggiungi webhook"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div>
              <label htmlFor="wh-url" className="text-sm font-medium text-foreground">URL</label>
              <Input
                id="wh-url"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="wh-secret" className="text-sm font-medium text-foreground">Secret (opzionale, per firma HMAC)</label>
              <Input
                id="wh-secret"
                type="password"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Secret per X-Webhook-Signature"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Eventi</label>
              <div className="mt-2 flex flex-col gap-2">
                {(Object.keys(EVENT_LABELS) as AutomationEventType[]).map((e) => (
                  <div key={e} className="flex items-center gap-2">
                    <Checkbox
                      id={`ev-${e}`}
                      checked={formEvents.includes(e)}
                      onCheckedChange={() => toggleEvent(e)}
                    />
                    <label htmlFor={`ev-${e}`} className="text-sm font-normal text-foreground cursor-pointer">{EVENT_LABELS[e]}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="wh-enabled" checked={formEnabled} onCheckedChange={(c) => setFormEnabled(c === true)} />
              <label htmlFor="wh-enabled" className="text-sm font-normal text-foreground cursor-pointer">Webhook attivo</label>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ComunicazioniTab({ workspaceId }: { workspaceId: string }) {
  const [templates, setTemplates] = useState<Array<{ _id: string; name: string; channel: string; subject?: string; bodyText: string }>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<{ _id: string; channel: string; templateId: string; recipientMasked: string; status: string; sentAt: string }>>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<{ config: { accountSid: string; fromNumber: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [waAccountSid, setWaAccountSid] = useState("");
  const [waAuthToken, setWaAuthToken] = useState("");
  const [waFromNumber, setWaFromNumber] = useState("");

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      followupApi.listCommunicationTemplates(workspaceId).then((r) => setTemplates(r.data ?? [])).catch(() => setTemplates([])),
      followupApi.listCommunicationRules(workspaceId).then((r) => setRules(r.data ?? [])).catch(() => setRules([])),
      followupApi.listCommunicationDeliveries(workspaceId, 30).then((r) => setDeliveries(r.data ?? [])).catch(() => setDeliveries([])),
      followupApi.getWhatsAppConfig(workspaceId).then((r) => { setWhatsappConfig(r.config ? { config: r.config.config } : null); if (r.config?.config) { setWaAccountSid(r.config.config.accountSid); setWaFromNumber(r.config.config.fromNumber); } }).catch(() => setWhatsappConfig(null)),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const saveWhatsApp = () => {
    if (!workspaceId || !waAccountSid.trim() || !waAuthToken.trim() || !waFromNumber.trim()) {
      window.alert("Compila Account SID, Auth Token e Numero mittente.");
      return;
    }
    setWaSaving(true);
    followupApi.saveWhatsAppConfig(workspaceId, { accountSid: waAccountSid.trim(), authToken: waAuthToken.trim(), fromNumber: waFromNumber.trim() })
      .then(() => { load(); setWaAuthToken(""); })
      .catch((e) => window.alert(e?.message ?? "Errore salvataggio"))
      .finally(() => setWaSaving(false));
  };

  const removeWhatsApp = () => {
    if (!workspaceId || !window.confirm("Rimuovere la configurazione WhatsApp?")) return;
    followupApi.deleteWhatsAppConfig(workspaceId).then(() => { setWhatsappConfig(null); setWaAccountSid(""); setWaAuthToken(""); setWaFromNumber(""); }).catch((e) => window.alert(e?.message ?? "Errore"));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Template</h3>
        <p className="text-sm text-muted-foreground mt-1">Template per email, WhatsApp, SMS e notifiche in-app (variabili: {"{{client_name}}"}, {"{{apartment_name}}"}, {"{{visit_date}}"}, ecc.).</p>
        {loading ? <p className="text-sm text-muted-foreground mt-2">Caricamento...</p> : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nome</th><th className="px-3 py-2 text-left font-medium">Canale</th><th className="px-3 py-2 text-left font-medium">Oggetto</th></tr></thead>
              <tbody>
                {templates.length === 0 ? <tr><td colSpan={3} className="px-3 py-4 text-muted-foreground">Nessun template. Crea un template via API o da interfaccia dedicata.</td></tr> :
                  templates.map((t) => (
                    <tr key={t._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2">{t.channel}</td>
                      <td className="px-3 py-2">{t.subject ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Regole di comunicazione</h3>
        <p className="text-sm text-muted-foreground mt-1">Evento → azioni (email, WhatsApp, notifica in-app).</p>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nome</th><th className="px-3 py-2 text-left font-medium">Stato</th><th className="px-3 py-2 text-left font-medium">Evento</th><th className="px-3 py-2 text-left font-medium">Azioni</th></tr></thead>
              <tbody>
                {rules.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Nessuna regola. Crea una regola via API.</td></tr> :
                  rules.map((r) => (
                    <tr key={String(r._id)} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{String(r.name ?? "")}</td>
                      <td className="px-3 py-2">{r.enabled ? "Attiva" : "Disattiva"}</td>
                      <td className="px-3 py-2">{typeof r.trigger === "object" && r.trigger && "eventType" in r.trigger ? String((r.trigger as { eventType: string }).eventType) : "—"}</td>
                      <td className="px-3 py-2">{Array.isArray(r.actions) ? r.actions.length : 0} azioni</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Ultime comunicazioni (Notification Center)</h3>
        <p className="text-sm text-muted-foreground mt-1">Log degli invii recenti (email, WhatsApp).</p>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Canale</th><th className="px-3 py-2 text-left font-medium">Destinatario</th><th className="px-3 py-2 text-left font-medium">Stato</th><th className="px-3 py-2 text-left font-medium">Data</th></tr></thead>
              <tbody>
                {deliveries.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Nessun invio recente.</td></tr> :
                  deliveries.map((d) => (
                    <tr key={d._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{d.channel}</td>
                      <td className="px-3 py-2">{d.recipientMasked}</td>
                      <td className="px-3 py-2">{d.status}</td>
                      <td className="px-3 py-2">{d.sentAt ? new Date(d.sentAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-lg font-semibold text-foreground">Canali</h3>
        <p className="text-sm text-muted-foreground mt-1">Configurazione WhatsApp (Twilio) per workspace. SMTP email da variabili d&apos;ambiente (SMTP_HOST, SMTP_FROM, ecc.).</p>
        <div className="mt-4 space-y-3 max-w-md">
          <div>
            <label className="text-sm font-medium text-foreground">Account SID (Twilio)</label>
            <Input className="mt-1" value={waAccountSid} onChange={(e) => setWaAccountSid(e.target.value)} placeholder="AC..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Auth Token</label>
            <Input type="password" className="mt-1" value={waAuthToken} onChange={(e) => setWaAuthToken(e.target.value)} placeholder={whatsappConfig ? "•••••••• (lascia vuoto per non modificare)" : "Token"} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Numero mittente (es. +39...)</label>
            <Input className="mt-1" value={waFromNumber} onChange={(e) => setWaFromNumber(e.target.value)} placeholder="+39..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveWhatsApp} disabled={waSaving}>{waSaving ? "Salvataggio..." : "Salva WhatsApp"}</Button>
            {whatsappConfig && <Button variant="outline" onClick={removeWhatsApp}>Rimuovi config</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Base URL assoluta per le API (per copia negli strumenti esterni). */
function getPublicApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === "string" && base.startsWith("http")) return base.replace(/\/$/, "");
  const path = (base && base.startsWith("/") ? base : `/${(base || "v1").replace(/^\//, "")}`).replace(/\/$/, "");
  return `${window.location.origin}${path}`;
}

const PUBLIC_ENDPOINTS: Array<{
  method: string;
  path: string;
  auth: string;
  rateLimit?: string;
  description: string;
}> = [
  { method: "GET", path: "/public/listings", auth: "Nessuna", rateLimit: "60 req/min per IP", description: "Listati (query: workspaceId, projectIds, page, perPage). Per Looker Studio, GAS, widget." },
  { method: "POST", path: "/public/listings", auth: "Nessuna", rateLimit: "60 req/min per IP", description: "Listati appartamenti (body ListQuery). Stesso contratto del GET." },
  { method: "POST", path: "/apartments/query", auth: "JWT Bearer", description: "Elenco appartamenti con filtri e paginazione (ListQuery)." },
  { method: "POST", path: "/clients/lite/query", auth: "JWT Bearer", description: "Lista light clienti (id, fullName, email) per dropdown e integrazioni." },
];

function ApiTab() {
  const baseUrl = getPublicApiBaseUrl();
  const openApiUrl = baseUrl ? `${baseUrl}/openapi.json` : "";

  const copyBaseUrl = () => { if (baseUrl) navigator.clipboard.writeText(baseUrl); };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">API pubbliche e riusabili</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Endpoint per listati, clienti light e integrazioni esterne (connettori, Looker Studio, n8n, siti web).
              Regole: autenticazione e rate limit sotto; spec OpenAPI per contratti completi.
            </p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">URL base</h4>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm">
            <code className="flex-1 truncate text-foreground">{baseUrl || "—"}</code>
            {baseUrl && (
              <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={copyBaseUrl}>
                <Copy className="h-3.5 w-3.5" />
                Copia
              </Button>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Endpoint (Riusabili)</h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-foreground">Metodo</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Path</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Auth</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Rate limit</th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">Descrizione</th>
                </tr>
              </thead>
              <tbody>
                {PUBLIC_ENDPOINTS.map((ep) => (
                  <tr key={`${ep.method} ${ep.path}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-foreground">{ep.method}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{ep.path}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ep.auth}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ep.rateLimit ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ep.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Regole</h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>API senza JWT:</strong> <code className="rounded bg-muted px-1">GET /v1/public/listings</code> e <code className="rounded bg-muted px-1">POST /v1/public/listings</code> — rate limit 60 req/min per IP; 429 se superato.</li>
            <li><strong>API con JWT:</strong> header <code className="rounded bg-muted px-1">Authorization: Bearer &lt;token&gt;</code> (token da login o SSO).</li>
            <li>Login / SSO: 10 richieste / 15 minuti per IP.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Looker Studio</h4>
          <p className="text-sm text-muted-foreground mb-2">
            Per usare i listati in Looker Studio: (1) endpoint <code className="rounded bg-muted px-1">GET /v1/public/listings</code> con parametri in query (vedi tabella sopra); (2) codice <strong>Community Connector</strong> (Google Apps Script) nel repo, cartella <code className="rounded bg-muted px-1">connectors/looker-studio</code>, con README per deploy e uso in Looker (Aggiungi dati → Connettore personalizzato).
          </p>
          <p className="text-xs text-muted-foreground">
            Documentazione completa: <code className="rounded bg-muted px-1">docs/API_RIUSABILI.md</code> nel repository.
          </p>
        </div>
        {openApiUrl && (
          <a href={openApiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Apri spec OpenAPI (openapi.json)
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

interface IntegrationsPageProps {
  workspaceId: string;
}

export const IntegrationsPage = ({ workspaceId }: IntegrationsPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = isValidTab(tabParam) ? tabParam : "connettori";
  const [connectors, setConnectors] = useState<ConnectorCatalogItem[]>(CONNECTOR_CATALOG);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfigRow[]>([]);
  const [n8nConfig, setN8nConfig] = useState<N8nConfigSnapshot>(null);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const { selectedProjectIds: projectIds } = useWorkspace();

  const loadWebhooks = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .listWebhookConfigs(workspaceId)
      .then((res) => setWebhookConfigs(res.data ?? []))
      .catch(() => setWebhookConfigs([]));
  }, [workspaceId]);

  const loadN8nConfig = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getN8nConfig(workspaceId)
      .then((res) => setN8nConfig(res.config?.config ?? null))
      .catch(() => setN8nConfig(null));
  }, [workspaceId]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const loadOutlookStatus = useCallback(() => {
    followupApi
      .getOutlookStatus()
      .then((r) => setOutlookConnected(r.connected))
      .catch(() => setOutlookConnected(false));
  }, []);

  useEffect(() => {
    loadN8nConfig();
  }, [loadN8nConfig]);

  useEffect(() => {
    loadOutlookStatus();
  }, [loadOutlookStatus]);

  useEffect(() => {
    if (searchParams.get("outlook") === "connected") {
      loadOutlookStatus();
      setConnectors((prev) => prev.map((c) => (c.id === "connector_outlook" ? { ...c, status: "configured" } : c)));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("outlook");
        return next;
      });
    }
  }, [searchParams, loadOutlookStatus]);

  useEffect(() => {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id === "connector_n8n") {
          const hasN8nApi = !!n8nConfig?.baseUrl;
          const hasN8nWebhook = webhookConfigs.some((w) => w.connectorId === "n8n");
          return { ...c, status: hasN8nApi || hasN8nWebhook ? "configured" : "available" };
        }
        if (c.id === "connector_outlook") {
          const hasOutlookOAuth = outlookConnected;
          const hasOutlookWebhook = webhookConfigs.some((w) => w.connectorId === "outlook");
          return { ...c, status: hasOutlookOAuth || hasOutlookWebhook ? "configured" : "beta" };
        }
        if (c.id === "connector_looker") {
          try {
            const stored = typeof window !== "undefined" && workspaceId
              ? window.localStorage?.getItem(`${LOOKER_CONNECTOR_STORAGE_KEY}.${workspaceId}`)
              : null;
            return { ...c, status: stored === "true" ? "configured" : "available" };
          } catch {
            return c;
          }
        }
        return c;
      })
    );
  }, [workspaceId, webhookConfigs, n8nConfig, outlookConnected]);

  const setTab = (value: TabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  const configuredCount = useMemo(
    () => connectors.filter((c) => c.status === "configured").length,
    [connectors]
  );

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">
              Integrazioni e automazioni
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connettori, regole if/then, webhook e API per estendere il CRM.
            </p>
          </div>
          {activeTab === "connettori" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{configuredCount} configurato/i</span>
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setTab(v as TabKey)}
          className="mt-6"
        >
          <TabsList className="w-full justify-start border-0 bg-transparent p-0" role="tablist">
            <TabsTrigger value="connettori" role="tab" aria-selected={activeTab === "connettori"}>
              Connettori
            </TabsTrigger>
            <TabsTrigger value="comunicazioni" role="tab" aria-selected={activeTab === "comunicazioni"}>
              Comunicazioni
            </TabsTrigger>
            <TabsTrigger value="regole" role="tab" aria-selected={activeTab === "regole"}>
              Regole
            </TabsTrigger>
            <TabsTrigger value="webhook" role="tab" aria-selected={activeTab === "webhook"}>
              Webhook
            </TabsTrigger>
            <TabsTrigger value="api" role="tab" aria-selected={activeTab === "api"}>
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connettori" className="mt-6" role="tabpanel">
            <ConnettoriTab
              connectors={connectors}
              setConnectors={setConnectors}
              onOpenTab={(tab) => setTab(tab)}
              workspaceId={workspaceId}
              webhookConfigs={webhookConfigs}
              loadWebhooks={loadWebhooks}
              projectIds={projectIds}
              n8nConfig={n8nConfig}
              loadN8nConfig={loadN8nConfig}
              outlookConnected={outlookConnected}
              loadOutlookStatus={loadOutlookStatus}
            />
          </TabsContent>
          <TabsContent value="comunicazioni" className="mt-6" role="tabpanel">
            <ComunicazioniTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="regole" className="mt-6" role="tabpanel">
            <RegoleTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="webhook" className="mt-6" role="tabpanel">
            <WebhookTab workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="api" className="mt-6" role="tabpanel">
            <ApiTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
