import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Search,
  RefreshCcw,
  Plug,
  ExternalLink,
  Sparkles,
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
import { useToast } from "../../contexts/ToastContext";
import type {
  WebhookConfigRow,
  AutomationEventType,
  WorkspaceEntitlementEffectiveRow,
  WorkspaceAiConfig,
} from "../../types/domain";
import { connectorEntitlementFootnote, workspaceFeatureEntitled } from "./workspaceEntitlementUi";
import { commercialContactInlineNode } from "./tecmaCommercialContact";
import { cn } from "../../lib/utils";
import {
  LOOKER_CONNECTOR_STORAGE_KEY,
  STATUS_CONFIG,
  ALL_GROUPS,
  CONNECTOR_CLUSTER_ORDER,
  CONNECTOR_CLUSTER_LABELS,
  CONNECTOR_CLUSTER_SECTION_INTRO,
  getConnectorCluster,
  CONNECTOR_EVENT_LABELS,
  type ConnectorCatalogItem,
  type ConnectorCluster,
  type ConnectorGroup,
  type ConnectorRelatedTab,
  type N8nConfigSnapshot,
  type SumsubConfigSnapshot,
} from "./integrationsCatalog";
import { resolveApiBaseUrl } from "../../api/http";
import { ConnectorBrandLogo } from "./ConnectorBrandLogo";
import { Alert } from "../../components/ui/alert";
import { INTEGRATION_LABELS } from "./integrationUiLabels";

const WHATSAPP_CONNECTOR_IDS = new Set<string>(["connector_twilio", "connector_meta_whatsapp"]);
const WHATSAPP_CONNECTOR_ORDER = ["connector_twilio", "connector_meta_whatsapp"] as const;

/** Template di esempio spesso pre-approvato su nuovi account Meta / WhatsApp Cloud API (cfr. documentazione Meta). */
const META_DEFAULT_TEST_TEMPLATE_NAME = "hello_world";
const META_DEFAULT_TEST_LANGUAGE_CODE = "en_US";

function ConnectorCatalogCard({
  connector,
  togglingId,
  setTogglingId,
  setupConnectorId,
  setSetupConnectorId,
  onOpenTab,
  toggleConnector,
  onHealthCheck,
  configureLabel,
  readOnly = false,
  entitlementFootnote,
}: {
  connector: ConnectorCatalogItem;
  togglingId: string | null;
  setTogglingId: Dispatch<SetStateAction<string | null>>;
  setupConnectorId: string | null;
  setSetupConnectorId: Dispatch<SetStateAction<string | null>>;
  onOpenTab?: (tab: ConnectorRelatedTab) => void;
  toggleConnector: (id: string) => void;
  onHealthCheck?: (id: string) => void;
  /** Etichetta del pulsante primario quando il connettore non è ancora configurato (es. Meta API). */
  configureLabel?: string;
  readOnly?: boolean;
  /** Vetrina: modulo commerciale non attivo (contatta Tecma). */
  entitlementFootnote?: ReactNode;
}) {
  const cfg = STATUS_CONFIG[connector.status];
  const StatusIcon = cfg.icon;
  const isConfigured = connector.status === "configured";
  const isComingSoon = connector.status === "coming_soon";
  const primaryConfigureLabel =
    configureLabel ?? (connector.connectionMode === "manualFallback" ? "Configura" : "Connetti");

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
        isConfigured ? "border-green-200" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ConnectorBrandLogo brandId={connector.brandId} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">{connector.name}</h3>
            <p className="text-xs text-muted-foreground">{connector.group}</p>
          </div>
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

      <p className="mt-2 flex-1 text-sm text-muted-foreground">{connector.description}</p>
      {entitlementFootnote && (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-50">
          {entitlementFootnote}
        </p>
      )}

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
        <p className="mt-2 text-xs text-muted-foreground">Richiede: {connector.prerequisites.join(", ")}</p>
      )}

      {(connector.setupSummary ?? connector.relatedTab) && (
        <div className="mt-3 space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-xs text-primary hover:text-primary"
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
                  className="mt-2 min-h-11 h-auto p-2 text-xs font-medium text-primary"
                  onClick={() => {
                    onOpenTab(connector.relatedTab!);
                    setSetupConnectorId(null);
                  }}
                >
                  Vai al tab{" "}
                  {connector.relatedTab === "webhook"
                    ? "Webhook"
                    : connector.relatedTab === "api"
                      ? "API"
                      : "Comunicazioni"}
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
          className="min-h-11 flex-1 gap-1.5"
          disabled={isComingSoon || togglingId === connector.id || readOnly}
          onClick={() => toggleConnector(connector.id)}
        >
          {togglingId === connector.id ? (
            <>
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              {isConfigured ? INTEGRATION_LABELS.disconnectLoading : "Configurazione..."}
            </>
          ) : isConfigured ? (
            INTEGRATION_LABELS.disconnect
          ) : isComingSoon ? (
            "Non disponibile"
          ) : (
            primaryConfigureLabel
          )}
        </Button>
        {isConfigured && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5"
            disabled={togglingId === connector.id || readOnly}
            onClick={() => {
              if (onHealthCheck) {
                onHealthCheck(connector.id);
                return;
              }
              setTogglingId(connector.id);
              setTimeout(() => setTogglingId(null), 800);
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {INTEGRATION_LABELS.healthStatus}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConnettoriTab({
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
  isAdmin = false,
  /** Nessuna modifica connettori (permesso integrations.update assente). */
  readOnly = false,
  autoOpenTwilio = false,
  onTwilioAutoOpenConsumed,
  reloadTwilioStatus,
  autoOpenMetaWhatsapp = false,
  onMetaAutoOpenConsumed,
  reloadMetaWhatsAppStatus,
  autoOpenConnectorId = null,
  onAutoOpenConnectorConsumed,
  /** false se il modulo Twilio non è abilitato (entitlement). Default true. */
  twilioEntitled = true,
  mailchimpEntitled = true,
  activecampaignEntitled = true,
  reloadMailchimpStatus,
  reloadActiveCampaignStatus,
  reloadStripeStatus,
  reloadPayPalStatus,
  reloadWebflowStatus,
  reloadTeamsIncomingStatus,
  workspaceAiConfig = null,
  reloadWorkspaceAiConfig,
  workspaceEntitlements,
  sumsubConfig = null,
  loadSumsubConfig,
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
  isAdmin?: boolean;
  readOnly?: boolean;
  /** Apri una volta il drawer Twilio (es. da query ?connector=twilio). */
  autoOpenTwilio?: boolean;
  onTwilioAutoOpenConsumed?: () => void;
  /** Aggiorna stato Twilio lato parent (badge configurato). */
  reloadTwilioStatus?: () => void;
  autoOpenMetaWhatsapp?: boolean;
  onMetaAutoOpenConsumed?: () => void;
  reloadMetaWhatsAppStatus?: () => void;
  /** Auto-open drawer via query generica (?connector=...). */
  autoOpenConnectorId?: string | null;
  onAutoOpenConnectorConsumed?: () => void;
  twilioEntitled?: boolean;
  mailchimpEntitled?: boolean;
  activecampaignEntitled?: boolean;
  reloadMailchimpStatus?: () => void;
  reloadActiveCampaignStatus?: () => void;
  reloadStripeStatus?: () => void;
  reloadPayPalStatus?: () => void;
  reloadWebflowStatus?: () => void;
  reloadTeamsIncomingStatus?: () => void;
  workspaceAiConfig?: WorkspaceAiConfig | null;
  reloadWorkspaceAiConfig?: () => void;
  /** Per vetrina: stato commerciale per connettori mappati (Twilio, Mailchimp, Looker…). */
  workspaceEntitlements?: WorkspaceEntitlementEffectiveRow[];
  sumsubConfig?: SumsubConfigSnapshot;
  loadSumsubConfig?: () => void;
}) {
  const { toastError, toastSuccess } = useToast();
  const ro = readOnly;
  const integrationsEntitled = workspaceFeatureEntitled(workspaceEntitlements, "integrations");
  const mailchimpSaveOk = integrationsEntitled && mailchimpEntitled;
  const activeCampaignSaveOk = integrationsEntitled && activecampaignEntitled;
  const [search, setSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState<"all" | ConnectorCluster>("all");
  const [groupFilter, setGroupFilter] = useState<"all" | ConnectorGroup>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [setupConnectorId, setSetupConnectorId] = useState<string | null>(null);
  const [connectorConfigDrawer, setConnectorConfigDrawer] = useState<
    | "connector_n8n"
    | "connector_outlook"
    | "connector_looker"
    | "connector_twilio"
    | "connector_meta_whatsapp"
    | "connector_mailchimp"
    | "connector_activecampaign"
    | "connector_stripe"
    | "connector_paypal"
    | "connector_webflow"
    | "connector_microsoft_teams"
    | "connector_workspace_ai"
    | "connector_sumsub"
    | null
  >(null);
  const [sumsubAppToken, setSumsubAppToken] = useState("");
  const [sumsubSecretKey, setSumsubSecretKey] = useState("");
  const [sumsubLevelName, setSumsubLevelName] = useState("");
  const [sumsubWebhookSecret, setSumsubWebhookSecret] = useState("");
  const [sumsubSaving, setSumsubSaving] = useState(false);
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
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [twilioHasSavedConfig, setTwilioHasSavedConfig] = useState(false);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioTestTo, setTwilioTestTo] = useState("");
  const [twilioTestBody, setTwilioTestBody] = useState("");
  const [twilioTestSending, setTwilioTestSending] = useState(false);
  const [twilioDrawerError, setTwilioDrawerError] = useState<string | null>(null);
  const [twilioShowAdvanced, setTwilioShowAdvanced] = useState(false);
  const [twilioVerifying, setTwilioVerifying] = useState(false);
  const twilioAutoOpenDoneRef = useRef(false);
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaHasSavedConfig, setMetaHasSavedConfig] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaDrawerError, setMetaDrawerError] = useState<string | null>(null);
  const [metaTestTo, setMetaTestTo] = useState("");
  const [metaTestTemplateName, setMetaTestTemplateName] = useState(META_DEFAULT_TEST_TEMPLATE_NAME);
  const [metaTestLanguage, setMetaTestLanguage] = useState(META_DEFAULT_TEST_LANGUAGE_CODE);
  const [metaTestParamsRaw, setMetaTestParamsRaw] = useState("");
  const [metaTestSending, setMetaTestSending] = useState(false);
  const metaAutoOpenDoneRef = useRef(false);
  const [mailchimpApiKey, setMailchimpApiKey] = useState("");
  const [mailchimpHasSavedConfig, setMailchimpHasSavedConfig] = useState(false);
  const [mailchimpSaving, setMailchimpSaving] = useState(false);
  const [mailchimpDrawerError, setMailchimpDrawerError] = useState<string | null>(null);
  const [activeCampaignApiKey, setActiveCampaignApiKey] = useState("");
  const [activeCampaignApiBaseUrl, setActiveCampaignApiBaseUrl] = useState("");
  const [activeCampaignHasSavedConfig, setActiveCampaignHasSavedConfig] = useState(false);
  const [activeCampaignSaving, setActiveCampaignSaving] = useState(false);
  const [activeCampaignDrawerError, setActiveCampaignDrawerError] = useState<string | null>(null);
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeHasSavedConfig, setStripeHasSavedConfig] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeDrawerError, setStripeDrawerError] = useState<string | null>(null);
  const [stripeWebhookUrlTemplate, setStripeWebhookUrlTemplate] = useState("/v1/webhooks/stripe/:workspaceId");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalWebhookId, setPaypalWebhookId] = useState("");
  const [paypalMode, setPaypalMode] = useState<"sandbox" | "live">("live");
  const [paypalHasSavedConfig, setPaypalHasSavedConfig] = useState(false);
  const [paypalSaving, setPaypalSaving] = useState(false);
  const [paypalDrawerError, setPaypalDrawerError] = useState<string | null>(null);
  const [paypalWebhookUrlTemplate, setPaypalWebhookUrlTemplate] = useState("/v1/webhooks/paypal/:workspaceId");
  const [webflowApiToken, setWebflowApiToken] = useState("");
  const [webflowSiteId, setWebflowSiteId] = useState("");
  const [webflowCollectionId, setWebflowCollectionId] = useState("");
  const [webflowHasSavedConfig, setWebflowHasSavedConfig] = useState(false);
  const [webflowSaving, setWebflowSaving] = useState(false);
  const [webflowDrawerError, setWebflowDrawerError] = useState<string | null>(null);
  const [webflowSyncing, setWebflowSyncing] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsLabel, setTeamsLabel] = useState("");
  const [teamsHasSavedConfig, setTeamsHasSavedConfig] = useState(false);
  const [teamsSaving, setTeamsSaving] = useState(false);
  const [teamsDrawerError, setTeamsDrawerError] = useState<string | null>(null);
  const [teamsTestSending, setTeamsTestSending] = useState(false);
  const [teamsShowAdvanced, setTeamsShowAdvanced] = useState(false);
  const [teamsVerifying, setTeamsVerifying] = useState(false);
  const [workspaceAiFormProvider, setWorkspaceAiFormProvider] = useState<"claude" | "openai" | "gemini">("claude");
  const [workspaceAiFormApiKey, setWorkspaceAiFormApiKey] = useState("");
  const [workspaceAiSaving, setWorkspaceAiSaving] = useState(false);
  const [workspaceAiDrawerError, setWorkspaceAiDrawerError] = useState<string | null>(null);

  const openMetaDrawer = useCallback(() => {
    if (!workspaceId) return;
    setMetaDrawerError(null);
    followupApi
      .getMetaWhatsAppConfig(workspaceId)
      .then((r) => {
        if (r.config?.config) {
          const cfg = r.config.config as { phoneNumberId?: string };
          setMetaPhoneNumberId(cfg.phoneNumberId ?? "");
          setMetaHasSavedConfig(true);
        } else {
          setMetaPhoneNumberId("");
          setMetaHasSavedConfig(false);
        }
        setMetaAccessToken("");
        setConnectorConfigDrawer("connector_meta_whatsapp");
      })
      .catch(() => {
        setMetaPhoneNumberId("");
        setMetaAccessToken("");
        setMetaHasSavedConfig(false);
        setConnectorConfigDrawer("connector_meta_whatsapp");
      });
  }, [workspaceId]);

  useEffect(() => {
    if (!autoOpenMetaWhatsapp || metaAutoOpenDoneRef.current) return;
    if (!workspaceId) return;
    metaAutoOpenDoneRef.current = true;
    openMetaDrawer();
    onMetaAutoOpenConsumed?.();
  }, [autoOpenMetaWhatsapp, workspaceId, onMetaAutoOpenConsumed, openMetaDrawer]);

  const openTwilioDrawer = useCallback(() => {
    if (!workspaceId) return;
    setTwilioDrawerError(null);
    setTwilioShowAdvanced(false);
    followupApi
      .getWhatsAppConfig(workspaceId)
      .then((r) => {
        if (r.config?.config) {
          const cfg = r.config.config as { accountSid?: string; fromNumber?: string };
          setTwilioAccountSid(cfg.accountSid ?? "");
          setTwilioFromNumber(cfg.fromNumber ?? "");
          setTwilioHasSavedConfig(true);
        } else {
          setTwilioAccountSid("");
          setTwilioFromNumber("");
          setTwilioHasSavedConfig(false);
        }
        setTwilioAuthToken("");
        setConnectorConfigDrawer("connector_twilio");
      })
      .catch(() => {
        setTwilioAccountSid("");
        setTwilioFromNumber("");
        setTwilioAuthToken("");
        setTwilioHasSavedConfig(false);
        setConnectorConfigDrawer("connector_twilio");
      });
  }, [workspaceId]);

  const openMailchimpDrawer = useCallback(() => {
    if (!workspaceId) return;
    setMailchimpDrawerError(null);
    followupApi
      .getMailchimpConnectorConfig(workspaceId)
      .then((r) => {
        setMailchimpHasSavedConfig(!!r.config);
        setMailchimpApiKey("");
        setConnectorConfigDrawer("connector_mailchimp");
      })
      .catch(() => {
        setMailchimpHasSavedConfig(false);
        setMailchimpApiKey("");
        setConnectorConfigDrawer("connector_mailchimp");
      });
  }, [workspaceId]);

  const openActiveCampaignDrawer = useCallback(() => {
    if (!workspaceId) return;
    setActiveCampaignDrawerError(null);
    followupApi
      .getActiveCampaignConnectorConfig(workspaceId)
      .then((r) => {
        setActiveCampaignHasSavedConfig(!!r.config);
        const pub = r.config?.config as { apiBaseUrl?: string } | undefined;
        setActiveCampaignApiBaseUrl(pub?.apiBaseUrl?.trim() ?? "");
        setActiveCampaignApiKey("");
        setConnectorConfigDrawer("connector_activecampaign");
      })
      .catch(() => {
        setActiveCampaignHasSavedConfig(false);
        setActiveCampaignApiBaseUrl("");
        setActiveCampaignApiKey("");
        setConnectorConfigDrawer("connector_activecampaign");
      });
  }, [workspaceId]);

  const openStripeDrawer = useCallback(() => {
    if (!workspaceId) return;
    setStripeDrawerError(null);
    followupApi
      .getStripeConnectorConfig(workspaceId)
      .then((r) => {
        setStripeHasSavedConfig(!!r.config);
        setStripeWebhookUrlTemplate(r.webhookUrlTemplate ?? "/v1/webhooks/stripe/:workspaceId");
        const pub = r.config?.config?.publishableKey?.trim();
        setStripePublishableKey(pub ?? "");
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setConnectorConfigDrawer("connector_stripe");
      })
      .catch(() => {
        setStripeHasSavedConfig(false);
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setStripePublishableKey("");
        setConnectorConfigDrawer("connector_stripe");
      });
  }, [workspaceId]);

  const openPayPalDrawer = useCallback(() => {
    if (!workspaceId) return;
    setPaypalDrawerError(null);
    followupApi
      .getPayPalConnectorConfig(workspaceId)
      .then((r) => {
        setPaypalHasSavedConfig(!!r.config);
        setPaypalWebhookUrlTemplate(r.webhookUrlTemplate ?? "/v1/webhooks/paypal/:workspaceId");
        const cfg = r.config?.config;
        setPaypalClientId(cfg?.clientId?.trim() ?? "");
        setPaypalWebhookId(cfg?.webhookId?.trim() ?? "");
        setPaypalMode(cfg?.mode === "sandbox" ? "sandbox" : "live");
        setPaypalClientSecret("");
        setConnectorConfigDrawer("connector_paypal");
      })
      .catch(() => {
        setPaypalHasSavedConfig(false);
        setPaypalClientId("");
        setPaypalClientSecret("");
        setPaypalWebhookId("");
        setPaypalMode("live");
        setConnectorConfigDrawer("connector_paypal");
      });
  }, [workspaceId]);

  const openWebflowDrawer = useCallback(() => {
    if (!workspaceId) return;
    setWebflowDrawerError(null);
    followupApi
      .getWebflowConnectorConfig(workspaceId)
      .then((r) => {
        setWebflowHasSavedConfig(!!r.config);
        const cfg = r.config?.config;
        setWebflowSiteId(cfg?.siteId?.trim() ?? "");
        setWebflowCollectionId(cfg?.apartmentsCollectionId?.trim() ?? "");
        setWebflowApiToken("");
        setConnectorConfigDrawer("connector_webflow");
      })
      .catch(() => {
        setWebflowHasSavedConfig(false);
        setWebflowSiteId("");
        setWebflowCollectionId("");
        setWebflowApiToken("");
        setConnectorConfigDrawer("connector_webflow");
      });
  }, [workspaceId]);

  const openTeamsDrawer = useCallback(() => {
    if (!workspaceId) return;
    setTeamsDrawerError(null);
    setTeamsShowAdvanced(false);
    followupApi
      .getTeamsIncomingConnectorConfig(workspaceId)
      .then((r) => {
        setTeamsHasSavedConfig(!!r.config);
        const cfg = r.config?.config;
        setTeamsWebhookUrl(cfg?.incomingWebhookUrl?.trim() ?? "");
        setTeamsLabel(cfg?.label?.trim() ?? "");
        setConnectorConfigDrawer("connector_microsoft_teams");
      })
      .catch(() => {
        setTeamsHasSavedConfig(false);
        setTeamsWebhookUrl("");
        setTeamsLabel("");
        setConnectorConfigDrawer("connector_microsoft_teams");
      });
  }, [workspaceId]);

  useEffect(() => {
    if (!autoOpenTwilio || twilioAutoOpenDoneRef.current) return;
    if (!workspaceId) return;
    twilioAutoOpenDoneRef.current = true;
    openTwilioDrawer();
    onTwilioAutoOpenConsumed?.();
  }, [autoOpenTwilio, workspaceId, onTwilioAutoOpenConsumed, openTwilioDrawer]);

  useEffect(() => {
    if (!autoOpenConnectorId || !workspaceId) return;
    const id = autoOpenConnectorId;
    if (id === "twilio") {
      openTwilioDrawer();
    } else if (id === "meta_whatsapp") {
      openMetaDrawer();
    } else if (id === "microsoft_teams") {
      openTeamsDrawer();
    } else if (id === "mailchimp") {
      openMailchimpDrawer();
    } else if (id === "activecampaign") {
      openActiveCampaignDrawer();
    } else if (id === "stripe") {
      openStripeDrawer();
    } else if (id === "paypal") {
      openPayPalDrawer();
    } else if (id === "webflow") {
      openWebflowDrawer();
    } else if (id === "n8n") {
      setConnectorConfigDrawer("connector_n8n");
    } else if (id === "outlook") {
      setConnectorConfigDrawer("connector_outlook");
    }
    onAutoOpenConnectorConsumed?.();
  }, [
    autoOpenConnectorId,
    workspaceId,
    openTwilioDrawer,
    openMetaDrawer,
    openTeamsDrawer,
    openMailchimpDrawer,
    openActiveCampaignDrawer,
    openStripeDrawer,
    openPayPalDrawer,
    openWebflowDrawer,
    onAutoOpenConnectorConsumed
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connectors.filter((c) => {
      if (clusterFilter !== "all" && getConnectorCluster(c) !== clusterFilter) return false;
      if (groupFilter !== "all" && c.group !== groupFilter) return false;
      if (!q) return true;
      const clusterLabel = CONNECTOR_CLUSTER_LABELS[getConnectorCluster(c)];
      return `${c.name} ${c.group} ${clusterLabel} ${c.description} ${c.capabilities.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [connectors, search, groupFilter, clusterFilter]);

  const { whatsappFiltered, otherFiltered } = useMemo(() => {
    const wa: ConnectorCatalogItem[] = [];
    const other: ConnectorCatalogItem[] = [];
    for (const c of filtered) {
      if (WHATSAPP_CONNECTOR_IDS.has(c.id)) wa.push(c);
      else other.push(c);
    }
    wa.sort(
      (a, b) => WHATSAPP_CONNECTOR_ORDER.indexOf(a.id as (typeof WHATSAPP_CONNECTOR_ORDER)[number]) - WHATSAPP_CONNECTOR_ORDER.indexOf(b.id as (typeof WHATSAPP_CONNECTOR_ORDER)[number])
    );
    return { whatsappFiltered: wa, otherFiltered: other };
  }, [filtered]);

  /** «Altri connettori» raggruppati per macro-area (cluster). */
  const otherByCluster = useMemo(() => {
    const buckets: Record<ConnectorCluster, ConnectorCatalogItem[]> = {} as Record<
      ConnectorCluster,
      ConnectorCatalogItem[]
    >;
    for (const cl of CONNECTOR_CLUSTER_ORDER) {
      buckets[cl] = [];
    }
    for (const c of otherFiltered) {
      buckets[getConnectorCluster(c)].push(c);
    }
    return buckets;
  }, [otherFiltered]);

  const openConnectorConfig = (
    id:
      | "connector_n8n"
      | "connector_outlook"
      | "connector_looker"
      | "connector_twilio"
      | "connector_meta_whatsapp"
      | "connector_mailchimp"
      | "connector_activecampaign"
      | "connector_stripe"
      | "connector_paypal"
      | "connector_webflow"
      | "connector_microsoft_teams"
      | "connector_anthropic_claude"
      | "connector_openai"
      | "connector_google_gemini"
      | "connector_sumsub"
  ) => {
    if (id === "connector_sumsub") {
      setSumsubAppToken("");
      setSumsubSecretKey("");
      setSumsubLevelName(sumsubConfig?.levelName ?? "");
      setSumsubWebhookSecret("");
      setConnectorConfigDrawer("connector_sumsub");
      return;
    }
    if (id === "connector_twilio") {
      openTwilioDrawer();
      return;
    }
    if (id === "connector_meta_whatsapp") {
      openMetaDrawer();
      return;
    }
    if (id === "connector_mailchimp") {
      openMailchimpDrawer();
      return;
    }
    if (id === "connector_activecampaign") {
      openActiveCampaignDrawer();
      return;
    }
    if (id === "connector_stripe") {
      openStripeDrawer();
      return;
    }
    if (id === "connector_paypal") {
      openPayPalDrawer();
      return;
    }
    if (id === "connector_webflow") {
      openWebflowDrawer();
      return;
    }
    if (id === "connector_microsoft_teams") {
      openTeamsDrawer();
      return;
    }
    if (id === "connector_anthropic_claude") {
      setWorkspaceAiFormProvider("claude");
      setWorkspaceAiFormApiKey("");
      setWorkspaceAiDrawerError(null);
      setConnectorConfigDrawer("connector_workspace_ai");
      return;
    }
    if (id === "connector_openai") {
      setWorkspaceAiFormProvider("openai");
      setWorkspaceAiFormApiKey("");
      setWorkspaceAiDrawerError(null);
      setConnectorConfigDrawer("connector_workspace_ai");
      return;
    }
    if (id === "connector_google_gemini") {
      setWorkspaceAiFormProvider("gemini");
      setWorkspaceAiFormApiKey("");
      setWorkspaceAiDrawerError(null);
      setConnectorConfigDrawer("connector_workspace_ai");
      return;
    }
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
    if (
      id === "connector_n8n" ||
      id === "connector_outlook" ||
      id === "connector_looker" ||
      id === "connector_twilio" ||
      id === "connector_meta_whatsapp" ||
      id === "connector_mailchimp" ||
      id === "connector_activecampaign" ||
      id === "connector_stripe" ||
      id === "connector_paypal" ||
      id === "connector_webflow" ||
      id === "connector_microsoft_teams" ||
      id === "connector_anthropic_claude" ||
      id === "connector_openai" ||
      id === "connector_google_gemini" ||
      id === "connector_sumsub"
    ) {
      const conn = connectors.find((c) => c.id === id);
      if (conn?.status === "configured") {
        if (id === "connector_sumsub") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteSumsubConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              loadSumsubConfig?.();
              toastSuccess("Configurazione Sumsub rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Sumsub");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_mailchimp") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteMailchimpConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "beta" } : c)));
              reloadMailchimpStatus?.();
              toastSuccess("Configurazione Mailchimp rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Mailchimp");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_activecampaign") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteActiveCampaignConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "beta" } : c)));
              reloadActiveCampaignStatus?.();
              toastSuccess("Configurazione ActiveCampaign rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione ActiveCampaign");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_stripe") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteStripeConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadStripeStatus?.();
              toastSuccess("Configurazione Stripe rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Stripe");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_paypal") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deletePayPalConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadPayPalStatus?.();
              toastSuccess("Configurazione PayPal rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione PayPal");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_webflow") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteWebflowConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadWebflowStatus?.();
              toastSuccess("Configurazione Webflow rimossa.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Webflow");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_microsoft_teams") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteTeamsIncomingConnectorConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadTeamsIncomingStatus?.();
              toastSuccess("Webhook Teams rimosso.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Teams");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_anthropic_claude" || id === "connector_openai" || id === "connector_google_gemini") {
          const provider =
            id === "connector_anthropic_claude" ? "claude" : id === "connector_openai" ? "openai" : "gemini";
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .putWorkspaceAiConfig(workspaceId, { provider, apiKey: "" })
            .then(() => {
              setConnectors((prev) =>
                prev.map((c) =>
                  c.id === "connector_anthropic_claude" ||
                  c.id === "connector_openai" ||
                  c.id === "connector_google_gemini"
                    ? { ...c, status: "available" }
                    : c
                )
              );
              reloadWorkspaceAiConfig?.();
              toastSuccess("Provider AI scollegato dal workspace.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione provider AI");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_meta_whatsapp") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteMetaWhatsAppConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadMetaWhatsAppStatus?.();
              toastSuccess("Connettore Meta WhatsApp rimosso.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore rimozione Meta WhatsApp");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_twilio") {
          setTogglingId(id);
          if (!workspaceId) {
            setTogglingId(null);
            return;
          }
          followupApi
            .deleteWhatsAppConfig(workspaceId)
            .then(() => {
              setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
              reloadTwilioStatus?.();
              toastSuccess("Connettore Twilio disconnesso.");
            })
            .catch((err) => {
              toastError(err?.message ?? "Errore disconnessione Twilio");
            })
            .finally(() => setTogglingId(null));
          return;
        }
        if (id === "connector_looker") {
          try {
            if (workspaceId) window.localStorage?.removeItem(`${LOOKER_CONNECTOR_STORAGE_KEY}.${workspaceId}`);
          } catch {
            /* localStorage may throw in private mode */
          }
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
            .catch((err) => {
              toastError(err?.message ?? "Errore disconnessione");
            })
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
            .catch((err) => {
              toastError(err?.message ?? "Errore disconnessione");
            })
            .finally(() => setTogglingId(null));
        }
      } else {
        openConnectorConfig(
          id as
            | "connector_n8n"
            | "connector_outlook"
            | "connector_looker"
            | "connector_twilio"
            | "connector_meta_whatsapp"
            | "connector_mailchimp"
            | "connector_activecampaign"
            | "connector_stripe"
            | "connector_paypal"
            | "connector_webflow"
            | "connector_microsoft_teams"
            | "connector_anthropic_claude"
            | "connector_openai"
            | "connector_google_gemini"
            | "connector_sumsub"
        );
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
      toastError("Inserisci l'URL del webhook.");
      return;
    }
    if (connectorFormEvents.length === 0) {
      toastError("Seleziona almeno un evento.");
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
          toastError(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createWebhookConfig(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setConnectorSaving(false);
          toastError(err?.message ?? "Errore creazione");
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
        } catch {
          /* localStorage may throw in private mode */
        }
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
      toastError("Inserisci l'URL base dell'istanza n8n (es. https://n8n.example.com).");
      return;
    }
    const apiKey = n8nFormApiKey.trim();
    if (!apiKey && !n8nConfig?.baseUrl) {
      toastError("Inserisci l'API key n8n (Settings → API in n8n).");
      return;
    }
    if (!apiKey) {
      toastError("Per salvare è necessario inserire l'API key (il backend non conserva la key precedente).");
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
        toastError(err?.message ?? "Errore salvataggio config n8n");
      })
      .finally(() => setConnectorSaving(false));
  };

  const saveSumsubConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_sumsub") return;
    if (!integrationsEntitled) {
      toastError("Integrazioni non abilitate su questo workspace.");
      return;
    }
    const appToken = sumsubAppToken.trim();
    const secretKey = sumsubSecretKey.trim();
    const levelName = sumsubLevelName.trim();
    const webhookSecret = sumsubWebhookSecret.trim();
    if (!levelName) {
      toastError("Inserisci il Level name (come in Sumsub).");
      return;
    }
    if (!appToken || !secretKey || !webhookSecret) {
      toastError("Servono App token, Secret key e Webhook secret (in chiaro al primo salvataggio).");
      return;
    }
    setSumsubSaving(true);
    followupApi
      .saveSumsubConnectorConfig(workspaceId, { appToken, secretKey, levelName, webhookSecret })
      .then(() => {
        loadSumsubConfig?.();
        setConnectors((prev) => prev.map((c) => (c.id === "connector_sumsub" ? { ...c, status: "configured" } : c)));
        setConnectorConfigDrawer(null);
        toastSuccess("Sumsub salvato. Configura lo stesso URL webhook in Sumsub.");
      })
      .catch((err) => {
        toastError(err?.message ?? "Errore salvataggio Sumsub");
      })
      .finally(() => setSumsubSaving(false));
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
        toastError(err?.message ?? "Errore avvio connessione Outlook");
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

  const openProviderPage = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const verifyTwilioConnection = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_twilio") return;
    setTwilioVerifying(true);
    setTwilioDrawerError(null);
    followupApi
      .verifyWhatsAppConfig(workspaceId)
      .then((r) => {
        const hasConfig = Boolean(r.verify.connected);
        setTwilioHasSavedConfig(hasConfig);
        if (hasConfig) {
          toastSuccess("Twilio collegato. Puoi inviare una prova WhatsApp.");
          return;
        }
        setTwilioDrawerError(
          r.verify.hint ?? "Connessione non completata. Apri Twilio Console o usa la modalità avanzata."
        );
        setTwilioShowAdvanced(true);
      })
      .catch((err) => {
        setTwilioDrawerError(err?.message ?? "Verifica Twilio fallita");
        setTwilioShowAdvanced(true);
      })
      .finally(() => setTwilioVerifying(false));
  };

  const verifyTeamsConnection = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_microsoft_teams") return;
    setTeamsVerifying(true);
    setTeamsDrawerError(null);
    followupApi
      .verifyTeamsIncomingConnector(workspaceId)
      .then((r) => {
        const hasConfig = Boolean(r.verify.connected);
        setTeamsHasSavedConfig(hasConfig);
        if (hasConfig) {
          toastSuccess("Teams collegato. Puoi inviare una prova.");
          return;
        }
        setTeamsDrawerError(
          r.verify.hint ?? "Nessun webhook Teams trovato. Completa il setup o usa la modalità avanzata."
        );
        setTeamsShowAdvanced(true);
      })
      .catch((err) => {
        setTeamsDrawerError(err?.message ?? "Verifica Teams fallita");
        setTeamsShowAdvanced(true);
      })
      .finally(() => setTeamsVerifying(false));
  };

  const runConnectorHealthCheck = (connectorId: string) => {
    if (!workspaceId) return;
    const verifyCall =
      connectorId === "connector_twilio"
        ? () => followupApi.verifyWhatsAppConfig(workspaceId)
        : connectorId === "connector_microsoft_teams"
          ? () => followupApi.verifyTeamsIncomingConnector(workspaceId)
          : connectorId === "connector_mailchimp"
            ? () => followupApi.verifyMailchimpConnector(workspaceId)
            : connectorId === "connector_activecampaign"
              ? () => followupApi.verifyActiveCampaignConnector(workspaceId)
              : connectorId === "connector_meta_whatsapp"
                ? () => followupApi.verifyMetaWhatsAppConnector(workspaceId)
                : connectorId === "connector_n8n"
                  ? () => followupApi.verifyN8nConnector(workspaceId)
                  : connectorId === "connector_stripe"
                    ? () => followupApi.verifyStripeConnector(workspaceId)
                    : connectorId === "connector_paypal"
                      ? () => followupApi.verifyPayPalConnector(workspaceId)
                      : connectorId === "connector_webflow"
                        ? () => followupApi.verifyWebflowConnector(workspaceId)
                        : connectorId === "connector_sumsub"
                          ? () => followupApi.verifySumsubConnector(workspaceId)
                          : null;

    if (!verifyCall) {
      toastError("Verifica stato non disponibile per questo connettore.");
      return;
    }

    setTogglingId(connectorId);
    verifyCall()
      .then((res) => {
        if (res.verify.connected) {
          toastSuccess("Connessione verificata.");
          return;
        }
        toastError(res.verify.hint ?? "Connessione non verificata.");
      })
      .catch((err) => toastError(err?.message ?? "Verifica connessione fallita"))
      .finally(() => setTogglingId(null));
  };

  const saveTwilioConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_twilio") return;
    if (!twilioAccountSid.trim() || !twilioAuthToken.trim() || !twilioFromNumber.trim()) {
      toastError("Compila Account SID, Auth Token e numero mittente WhatsApp.");
      return;
    }
    setTwilioSaving(true);
    setTwilioDrawerError(null);
    followupApi
      .saveWhatsAppConfig(workspaceId, {
        accountSid: twilioAccountSid.trim(),
        authToken: twilioAuthToken.trim(),
        fromNumber: twilioFromNumber.trim(),
      })
      .then(() => {
        setTwilioHasSavedConfig(true);
        setTwilioAuthToken("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_twilio" ? { ...c, status: "configured" } : c)));
        reloadTwilioStatus?.();
        toastSuccess("Configurazione Twilio salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setTwilioDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setTwilioSaving(false));
  };

  const removeTwilioConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_twilio") return;
    if (!window.confirm("Rimuovere la configurazione Twilio per questo workspace?")) return;
    setTwilioSaving(true);
    setTwilioDrawerError(null);
    followupApi
      .deleteWhatsAppConfig(workspaceId)
      .then(() => {
        setTwilioHasSavedConfig(false);
        setTwilioAccountSid("");
        setTwilioFromNumber("");
        setTwilioAuthToken("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_twilio" ? { ...c, status: "available" } : c)));
        reloadTwilioStatus?.();
        toastSuccess("Configurazione Twilio rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setTwilioDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setTwilioSaving(false));
  };

  const testTwilioWhatsApp = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_twilio") return;
    if (!twilioTestTo.trim()) {
      toastError("Inserisci il numero di destinazione (E.164).");
      return;
    }
    setTwilioTestSending(true);
    setTwilioDrawerError(null);
    followupApi
      .testWhatsAppMessage(workspaceId, {
        to: twilioTestTo.trim(),
        body: twilioTestBody.trim() || undefined,
      })
      .then(() => {
        toastSuccess("Messaggio di prova inviato.");
        setTwilioTestBody("");
      })
      .catch((err) => setTwilioDrawerError(err?.message ?? "Invio fallito"))
      .finally(() => setTwilioTestSending(false));
  };

  const saveMailchimpConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_mailchimp") return;
    const key = mailchimpApiKey.trim();
    if (!key) {
      toastError(
        mailchimpHasSavedConfig ? "Inserisci una nuova API key per aggiornare." : "Inserisci l’API key Mailchimp."
      );
      return;
    }
    setMailchimpSaving(true);
    setMailchimpDrawerError(null);
    followupApi
      .saveMailchimpConnectorConfig(workspaceId, { apiKey: key })
      .then(() => {
        setMailchimpHasSavedConfig(true);
        setMailchimpApiKey("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_mailchimp" ? { ...c, status: "configured" } : c)));
        reloadMailchimpStatus?.();
        toastSuccess("API key Mailchimp salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setMailchimpDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setMailchimpSaving(false));
  };

  const removeMailchimpConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_mailchimp") return;
    if (!window.confirm("Rimuovere la configurazione Mailchimp per questo workspace?")) return;
    setMailchimpSaving(true);
    setMailchimpDrawerError(null);
    followupApi
      .deleteMailchimpConnectorConfig(workspaceId)
      .then(() => {
        setMailchimpHasSavedConfig(false);
        setMailchimpApiKey("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_mailchimp" ? { ...c, status: "beta" } : c)));
        reloadMailchimpStatus?.();
        toastSuccess("Configurazione Mailchimp rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setMailchimpDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setMailchimpSaving(false));
  };

  const saveActiveCampaignConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_activecampaign") return;
    const key = activeCampaignApiKey.trim();
    const baseUrl = activeCampaignApiBaseUrl.trim().replace(/\/$/, "");
    if (!key) {
      toastError(
        activeCampaignHasSavedConfig
          ? "Inserisci una nuova API key per aggiornare."
          : "Inserisci l’API key ActiveCampaign."
      );
      return;
    }
    if (!activeCampaignHasSavedConfig && !baseUrl) {
      toastError("Inserisci l’URL API (Settings → Developer in ActiveCampaign, es. https://account.api-us1.com).");
      return;
    }
    setActiveCampaignSaving(true);
    setActiveCampaignDrawerError(null);
    const body: { apiKey: string; apiBaseUrl?: string } = { apiKey: key };
    if (!activeCampaignHasSavedConfig) {
      body.apiBaseUrl = baseUrl;
    } else if (baseUrl) {
      body.apiBaseUrl = baseUrl;
    }
    followupApi
      .saveActiveCampaignConnectorConfig(workspaceId, body)
      .then(() => {
        setActiveCampaignHasSavedConfig(true);
        setActiveCampaignApiKey("");
        if (body.apiBaseUrl) setActiveCampaignApiBaseUrl(body.apiBaseUrl);
        setConnectors((prev) =>
          prev.map((c) => (c.id === "connector_activecampaign" ? { ...c, status: "configured" } : c))
        );
        reloadActiveCampaignStatus?.();
        toastSuccess("API key ActiveCampaign salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setActiveCampaignDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setActiveCampaignSaving(false));
  };

  const removeActiveCampaignConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_activecampaign") return;
    if (!window.confirm("Rimuovere la configurazione ActiveCampaign per questo workspace?")) return;
    setActiveCampaignSaving(true);
    setActiveCampaignDrawerError(null);
    followupApi
      .deleteActiveCampaignConnectorConfig(workspaceId)
      .then(() => {
        setActiveCampaignHasSavedConfig(false);
        setActiveCampaignApiKey("");
        setActiveCampaignApiBaseUrl("");
        setConnectors((prev) =>
          prev.map((c) => (c.id === "connector_activecampaign" ? { ...c, status: "beta" } : c))
        );
        reloadActiveCampaignStatus?.();
        toastSuccess("Configurazione ActiveCampaign rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setActiveCampaignDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setActiveCampaignSaving(false));
  };

  const saveStripeConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_stripe") return;
    const sk = stripeSecretKey.trim();
    if (!sk) {
      toastError(stripeHasSavedConfig ? "Inserisci una nuova Secret key (sk_…) per aggiornare." : "Inserisci la Secret key Stripe (sk_…).");
      return;
    }
    if (!integrationsEntitled) {
      toastError("Integrazioni non attive sul workspace.");
      return;
    }
    setStripeSaving(true);
    setStripeDrawerError(null);
    const body: { secretKey: string; webhookSecret?: string; publishableKey?: string } = { secretKey: sk };
    const wh = stripeWebhookSecret.trim();
    if (wh) body.webhookSecret = wh;
    const pk = stripePublishableKey.trim();
    if (pk) body.publishableKey = pk;
    followupApi
      .saveStripeConnectorConfig(workspaceId, body)
      .then(() => {
        setStripeHasSavedConfig(true);
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_stripe" ? { ...c, status: "configured" } : c)));
        reloadStripeStatus?.();
        toastSuccess("Configurazione Stripe salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setStripeDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setStripeSaving(false));
  };

  const removeStripeConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_stripe") return;
    if (!window.confirm("Rimuovere la configurazione Stripe per questo workspace?")) return;
    setStripeSaving(true);
    setStripeDrawerError(null);
    followupApi
      .deleteStripeConnectorConfig(workspaceId)
      .then(() => {
        setStripeHasSavedConfig(false);
        setStripeSecretKey("");
        setStripeWebhookSecret("");
        setStripePublishableKey("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_stripe" ? { ...c, status: "available" } : c)));
        reloadStripeStatus?.();
        toastSuccess("Configurazione Stripe rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setStripeDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setStripeSaving(false));
  };

  const savePayPalConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_paypal") return;
    if (!integrationsEntitled) {
      toastError("Integrazioni non attive sul workspace.");
      return;
    }
    const cid = paypalClientId.trim();
    if (!cid) {
      toastError("Inserisci il Client ID PayPal.");
      return;
    }
    const sec = paypalClientSecret.trim();
    if (!paypalHasSavedConfig && !sec) {
      toastError("Inserisci il Client Secret (obbligatorio al primo salvataggio).");
      return;
    }
    setPaypalSaving(true);
    setPaypalDrawerError(null);
    const body: { clientId: string; clientSecret?: string; webhookId?: string; mode?: "sandbox" | "live" } = {
      clientId: cid,
      mode: paypalMode,
    };
    if (sec) body.clientSecret = sec;
    const wid = paypalWebhookId.trim();
    if (wid) body.webhookId = wid;
    followupApi
      .savePayPalConnectorConfig(workspaceId, body)
      .then(() => {
        setPaypalHasSavedConfig(true);
        setPaypalClientSecret("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_paypal" ? { ...c, status: "configured" } : c)));
        reloadPayPalStatus?.();
        toastSuccess("Configurazione PayPal salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setPaypalDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setPaypalSaving(false));
  };

  const removePayPalConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_paypal") return;
    if (!window.confirm("Rimuovere la configurazione PayPal per questo workspace?")) return;
    setPaypalSaving(true);
    setPaypalDrawerError(null);
    followupApi
      .deletePayPalConnectorConfig(workspaceId)
      .then(() => {
        setPaypalHasSavedConfig(false);
        setPaypalClientId("");
        setPaypalClientSecret("");
        setPaypalWebhookId("");
        setPaypalMode("live");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_paypal" ? { ...c, status: "available" } : c)));
        reloadPayPalStatus?.();
        toastSuccess("Configurazione PayPal rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setPaypalDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setPaypalSaving(false));
  };

  const saveWebflowConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_webflow") return;
    if (!integrationsEntitled) {
      toastError("Integrazioni non attive sul workspace.");
      return;
    }
    const tok = webflowApiToken.trim();
    const sid = webflowSiteId.trim();
    const col = webflowCollectionId.trim();
    if (!tok || !sid || !col) {
      toastError("Compila API token, Site ID e Collection ID appartamenti.");
      return;
    }
    setWebflowSaving(true);
    setWebflowDrawerError(null);
    followupApi
      .saveWebflowConnectorConfig(workspaceId, { apiToken: tok, siteId: sid, apartmentsCollectionId: col })
      .then(() => {
        setWebflowHasSavedConfig(true);
        setWebflowApiToken("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_webflow" ? { ...c, status: "configured" } : c)));
        reloadWebflowStatus?.();
        toastSuccess("Configurazione Webflow salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setWebflowDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setWebflowSaving(false));
  };

  const removeWebflowConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_webflow") return;
    if (!window.confirm("Rimuovere la configurazione Webflow per questo workspace?")) return;
    setWebflowSaving(true);
    setWebflowDrawerError(null);
    followupApi
      .deleteWebflowConnectorConfig(workspaceId)
      .then(() => {
        setWebflowHasSavedConfig(false);
        setWebflowApiToken("");
        setWebflowSiteId("");
        setWebflowCollectionId("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_webflow" ? { ...c, status: "available" } : c)));
        reloadWebflowStatus?.();
        toastSuccess("Configurazione Webflow rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setWebflowDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setWebflowSaving(false));
  };

  const runWebflowSync = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_webflow") return;
    if (!projectIds.length) {
      toastError("Seleziona almeno un progetto nel selettore progetti (sidebar).");
      return;
    }
    setWebflowSyncing(true);
    setWebflowDrawerError(null);
    followupApi
      .syncWebflowApartments(workspaceId, { projectIds })
      .then((r) => {
        const res = r.result;
        const errMsg =
          res.errors.length > 0 ? ` Prime errori: ${res.errors.slice(0, 3).map((e) => e.message).join("; ")}` : "";
        toastSuccess(
          `Sync completato: ${res.synced} processati, creati ${res.created}, aggiornati ${res.updated}.${errMsg}`
        );
        if (res.errors.length > 0) {
          setWebflowDrawerError(`${res.errors.length} errori durante il sync.${errMsg}`);
        }
      })
      .catch((err) => setWebflowDrawerError(err?.message ?? "Sync fallito"))
      .finally(() => setWebflowSyncing(false));
  };

  const saveTeamsConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_microsoft_teams") return;
    if (!integrationsEntitled) {
      toastError("Integrazioni non attive sul workspace.");
      return;
    }
    const url = teamsWebhookUrl.trim();
    if (!url) {
      toastError("Inserisci l’URL del connettore Incoming Webhook.");
      return;
    }
    setTeamsSaving(true);
    setTeamsDrawerError(null);
    followupApi
      .saveTeamsIncomingConnectorConfig(workspaceId, {
        incomingWebhookUrl: url,
        ...(teamsLabel.trim() ? { label: teamsLabel.trim() } : {}),
      })
      .then(() => {
        setTeamsHasSavedConfig(true);
        setConnectors((prev) =>
          prev.map((c) => (c.id === "connector_microsoft_teams" ? { ...c, status: "configured" } : c))
        );
        reloadTeamsIncomingStatus?.();
        toastSuccess("Webhook Teams salvato.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setTeamsDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setTeamsSaving(false));
  };

  const removeTeamsConnector = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_microsoft_teams") return;
    if (!window.confirm("Rimuovere il webhook Teams per questo workspace?")) return;
    setTeamsSaving(true);
    setTeamsDrawerError(null);
    followupApi
      .deleteTeamsIncomingConnectorConfig(workspaceId)
      .then(() => {
        setTeamsHasSavedConfig(false);
        setTeamsWebhookUrl("");
        setTeamsLabel("");
        setConnectors((prev) =>
          prev.map((c) => (c.id === "connector_microsoft_teams" ? { ...c, status: "available" } : c))
        );
        reloadTeamsIncomingStatus?.();
        toastSuccess("Webhook Teams rimosso.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setTeamsDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setTeamsSaving(false));
  };

  const testTeamsWebhook = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_microsoft_teams") return;
    setTeamsTestSending(true);
    setTeamsDrawerError(null);
    followupApi
      .testTeamsIncomingWebhook(workspaceId)
      .then(() => toastSuccess("Messaggio di prova inviato al canale Teams."))
      .catch((err) => setTeamsDrawerError(err?.message ?? "Invio fallito"))
      .finally(() => setTeamsTestSending(false));
  };

  const saveWorkspaceAiIntegration = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_workspace_ai") return;
    if (!isAdmin) {
      toastError("Solo un amministratore workspace può salvare la chiave API (stesso vincolo delle Impostazioni workspace).");
      return;
    }
    const key = workspaceAiFormApiKey.trim();
    if (!key) {
      toastError("Incolla l’API key del provider selezionato.");
      return;
    }
    setWorkspaceAiSaving(true);
    setWorkspaceAiDrawerError(null);
    followupApi
      .putWorkspaceAiConfig(workspaceId, { provider: workspaceAiFormProvider, apiKey: key })
      .then(() => {
        setWorkspaceAiFormApiKey("");
        setConnectors((prev) =>
          prev.map((c) => {
            if (c.id === "connector_anthropic_claude") {
              return { ...c, status: workspaceAiFormProvider === "claude" ? "configured" : "available" };
            }
            if (c.id === "connector_openai") {
              return { ...c, status: workspaceAiFormProvider === "openai" ? "configured" : "available" };
            }
            if (c.id === "connector_google_gemini") {
              return { ...c, status: workspaceAiFormProvider === "gemini" ? "configured" : "available" };
            }
            return c;
          })
        );
        reloadWorkspaceAiConfig?.();
        toastSuccess("Provider AI salvato per il workspace.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setWorkspaceAiDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setWorkspaceAiSaving(false));
  };

  const removeWorkspaceAiIntegration = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_workspace_ai") return;
    if (!isAdmin) {
      toastError("Solo un amministratore workspace può rimuovere la configurazione AI.");
      return;
    }
    if (!window.confirm("Scollegare il provider AI da questo workspace? I suggerimenti che dipendono dall’LLM smetteranno di usare la tua chiave.")) {
      return;
    }
    setWorkspaceAiSaving(true);
    setWorkspaceAiDrawerError(null);
    followupApi
      .putWorkspaceAiConfig(workspaceId, { provider: workspaceAiFormProvider, apiKey: "" })
      .then(() => {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === "connector_anthropic_claude" || c.id === "connector_openai" || c.id === "connector_google_gemini"
              ? { ...c, status: "available" }
              : c
          )
        );
        reloadWorkspaceAiConfig?.();
        toastSuccess("Provider AI rimosso.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setWorkspaceAiDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setWorkspaceAiSaving(false));
  };

  const saveMetaWhatsAppConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_meta_whatsapp") return;
    if (!metaPhoneNumberId.trim() || !metaAccessToken.trim()) {
      toastError("Compila Phone Number ID e Access Token.");
      return;
    }
    setMetaSaving(true);
    setMetaDrawerError(null);
    followupApi
      .saveMetaWhatsAppConfig(workspaceId, {
        phoneNumberId: metaPhoneNumberId.trim(),
        accessToken: metaAccessToken.trim(),
      })
      .then(() => {
        setMetaHasSavedConfig(true);
        setMetaAccessToken("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_meta_whatsapp" ? { ...c, status: "configured" } : c)));
        reloadMetaWhatsAppStatus?.();
        toastSuccess("Configurazione Meta WhatsApp salvata.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setMetaDrawerError(err?.message ?? "Salvataggio fallito"))
      .finally(() => setMetaSaving(false));
  };

  const removeMetaWhatsAppConfig = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_meta_whatsapp") return;
    if (!window.confirm("Rimuovere la configurazione Meta WhatsApp per questo workspace?")) return;
    setMetaSaving(true);
    setMetaDrawerError(null);
    followupApi
      .deleteMetaWhatsAppConfig(workspaceId)
      .then(() => {
        setMetaHasSavedConfig(false);
        setMetaPhoneNumberId("");
        setMetaAccessToken("");
        setConnectors((prev) => prev.map((c) => (c.id === "connector_meta_whatsapp" ? { ...c, status: "available" } : c)));
        reloadMetaWhatsAppStatus?.();
        toastSuccess("Configurazione Meta WhatsApp rimossa.");
        setConnectorConfigDrawer(null);
      })
      .catch((err) => setMetaDrawerError(err?.message ?? "Rimozione fallita"))
      .finally(() => setMetaSaving(false));
  };

  const testMetaWhatsApp = () => {
    if (!workspaceId || connectorConfigDrawer !== "connector_meta_whatsapp") return;
    if (!metaTestTo.trim()) {
      toastError("Inserisci il numero di destinazione (E.164).");
      return;
    }
    if (!metaTestTemplateName.trim() || !metaTestLanguage.trim()) {
      toastError("Nome template e lingua sono obbligatori per la prova Meta.");
      return;
    }
    const bodyParameters = metaTestParamsRaw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setMetaTestSending(true);
    setMetaDrawerError(null);
    followupApi
      .testMetaWhatsAppMessage(workspaceId, {
        to: metaTestTo.trim(),
        templateName: metaTestTemplateName.trim(),
        languageCode: metaTestLanguage.trim(),
        bodyParameters: bodyParameters.length ? bodyParameters : undefined,
      })
      .then(() => {
        toastSuccess("Messaggio template di prova inviato (Meta).");
      })
      .catch((err) => setMetaDrawerError(err?.message ?? "Invio fallito"))
      .finally(() => setMetaTestSending(false));
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
        toastSuccess("Workflow avviato con successo.");
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
            placeholder="Cerca connettore, cluster o categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={clusterFilter} onValueChange={(v) => setClusterFilter(v as "all" | ConnectorCluster)}>
          <SelectTrigger className="h-10 w-[min(100%,220px)] min-w-[180px] rounded-lg border-border text-sm">
            <SelectValue placeholder="Tutti i cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i cluster</SelectItem>
            {CONNECTOR_CLUSTER_ORDER.map((cl) => (
              <SelectItem key={cl} value={cl}>
                {CONNECTOR_CLUSTER_LABELS[cl]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v as "all" | ConnectorGroup)}>
          <SelectTrigger className="h-10 w-[min(100%,220px)] min-w-[180px] rounded-lg border-border text-sm">
            <SelectValue placeholder="Tutti i gruppi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {ALL_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} connettori</span>
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted-foreground leading-relaxed">
        Il catalogo unisce integrazioni configurabili e voci di roadmap: il badge di stato sulla card indica la disponibilità effettiva (molte voci «In arrivo» non hanno ancora un wizard nel portale).
      </p>

      {whatsappFiltered.length > 0 && (
        <>
          <Alert variant="info" className="mt-6 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100" title="WhatsApp: due provider, uno basta">
            <span className="block leading-relaxed">
              Puoi collegare <strong className="font-medium text-foreground">Twilio</strong> oppure{" "}
              <strong className="font-medium text-foreground">Meta Cloud API</strong> (template approvati).{" "}
              <strong className="font-medium text-foreground">Non servono entrambi</strong> per iniziare a inviare. Se configuri i due sullo stesso workspace, il
              backend usa <strong className="font-medium text-foreground">Meta in priorità</strong> per le consegne Whats automatiche.
            </span>
          </Alert>
          <div className="mt-6">
            <h2 className="text-base font-semibold text-foreground">WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Scegli il provider adatto al tuo account. Nome template e lingua per Meta si impostano nel tab Comunicazioni.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whatsappFiltered.map((connector) => (
                <ConnectorCatalogCard
                  key={connector.id}
                  connector={connector}
                  togglingId={togglingId}
                  setTogglingId={setTogglingId}
                  setupConnectorId={setupConnectorId}
                  setSetupConnectorId={setSetupConnectorId}
                  onOpenTab={onOpenTab}
                  toggleConnector={toggleConnector}
                  onHealthCheck={runConnectorHealthCheck}
                  configureLabel={connector.id === "connector_meta_whatsapp" ? "Configura Meta API" : undefined}
                  readOnly={ro}
                  entitlementFootnote={connectorEntitlementFootnote(workspaceEntitlements, connector.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {otherFiltered.length > 0 && (
        <div className={whatsappFiltered.length > 0 ? "mt-10" : "mt-6"}>
          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground">
              {whatsappFiltered.length > 0 ? "Altri connettori" : "Catalogo connettori"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Raggruppati per area di prodotto (cluster). Filtra per cluster o per categoria tecnica dalla barra sopra.
            </p>
          </div>
          <div className="space-y-10">
            {CONNECTOR_CLUSTER_ORDER.map((clusterId) => {
              const items = otherByCluster[clusterId];
              if (!items?.length) return null;
              return (
                <section key={clusterId} aria-labelledby={`cluster-heading-${clusterId}`}>
                  <h3
                    id={`cluster-heading-${clusterId}`}
                    className="mb-3 border-b border-border pb-2 text-sm font-semibold tracking-tight text-foreground"
                  >
                    {CONNECTOR_CLUSTER_LABELS[clusterId]}
                  </h3>
                  {CONNECTOR_CLUSTER_SECTION_INTRO[clusterId] && (
                    <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {CONNECTOR_CLUSTER_SECTION_INTRO[clusterId]}
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((connector) => (
                      <ConnectorCatalogCard
                        key={connector.id}
                        connector={connector}
                        togglingId={togglingId}
                        setTogglingId={setTogglingId}
                        setupConnectorId={setupConnectorId}
                        setSetupConnectorId={setSetupConnectorId}
                        onOpenTab={onOpenTab}
                        toggleConnector={toggleConnector}
                        onHealthCheck={runConnectorHealthCheck}
                        readOnly={ro}
                        entitlementFootnote={connectorEntitlementFootnote(workspaceEntitlements, connector.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

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
              {connectorConfigDrawer === "connector_twilio" && "Collega WhatsApp (Twilio)"}
              {connectorConfigDrawer === "connector_meta_whatsapp" && "Collega WhatsApp (Meta Cloud API)"}
              {connectorConfigDrawer === "connector_mailchimp" && "Mailchimp — API key"}
              {connectorConfigDrawer === "connector_activecampaign" && "ActiveCampaign — credenziali API"}
              {connectorConfigDrawer === "connector_stripe" && "Stripe — pagamenti"}
              {connectorConfigDrawer === "connector_paypal" && "PayPal — REST / webhook"}
              {connectorConfigDrawer === "connector_webflow" && "Webflow — CMS appartamenti"}
              {connectorConfigDrawer === "connector_microsoft_teams" && "Microsoft Teams — Incoming Webhook"}
              {connectorConfigDrawer === "connector_workspace_ai" && "Provider AI (LLM) per workspace"}
              {connectorConfigDrawer === "connector_sumsub" && "Sumsub — AML / KYC"}
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
                <Button className="min-h-11" onClick={testLookerConnection} disabled={lookerTesting || projectIds.length === 0 || ro}>
                  {lookerTesting ? INTEGRATION_LABELS.verifyConnectionLoading : INTEGRATION_LABELS.verifyConnection}
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
            {connectorConfigDrawer === "connector_sumsub" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Credenziali dall&apos;app Sumsub (Development / Production). Il webhook deve puntare al backend FollowUp con il path sotto (sostituisci il base URL con quello del tuo ambiente API).
                </p>
                <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs break-all">
                  {`${resolveApiBaseUrl().replace(/\/$/, "")}/v1/webhooks/sumsub/${workspaceId || "<workspaceId>"}`}
                </p>
                <div>
                  <label htmlFor="sumsub-level" className="text-sm font-medium text-foreground">
                    Level name
                  </label>
                  <Input
                    id="sumsub-level"
                    value={sumsubLevelName}
                    onChange={(e) => setSumsubLevelName(e.target.value)}
                    placeholder="es. id-and-liveness"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="sumsub-app-token" className="text-sm font-medium text-foreground">
                    App token
                  </label>
                  <Input
                    id="sumsub-app-token"
                    type="password"
                    value={sumsubAppToken}
                    onChange={(e) => setSumsubAppToken(e.target.value)}
                    placeholder={sumsubConfig?.appTokenMasked ? `Configurato (${sumsubConfig.appTokenMasked}); incolla nuovo per aggiornare` : "Da Sumsub → App credentials"}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="sumsub-secret" className="text-sm font-medium text-foreground">
                    Secret key (firma API)
                  </label>
                  <Input
                    id="sumsub-secret"
                    type="password"
                    value={sumsubSecretKey}
                    onChange={(e) => setSumsubSecretKey(e.target.value)}
                    placeholder={sumsubConfig?.secretKeyMasked ? `Configurato (${sumsubConfig.secretKeyMasked})` : "Secret key"}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="sumsub-wh" className="text-sm font-medium text-foreground">
                    Webhook secret
                  </label>
                  <Input
                    id="sumsub-wh"
                    type="password"
                    value={sumsubWebhookSecret}
                    onChange={(e) => setSumsubWebhookSecret(e.target.value)}
                    placeholder={sumsubConfig?.webhookSecretMasked ? `Configurato (${sumsubConfig.webhookSecretMasked})` : "Stesso valore configurato in Sumsub per il webhook"}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                {!integrationsEntitled && (
                  <Alert variant="warning" title="Integrazioni non attive" className="text-sm">
                    Il salvataggio richiede il modulo Integrazioni abilitato da Tecma.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
              </>
            )}
            {connectorConfigDrawer === "connector_outlook" && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Connessione calendario (OAuth Microsoft)</p>
                  {outlookConnected ? (
                    <>
                      <p className="text-sm text-muted-foreground">Outlook connesso. Puoi disconnettere dalla scheda o vedere gli eventi.</p>
                      <Button variant="outline" size="sm" className="min-h-11" onClick={loadOutlookCalendar} disabled={outlookCalendarLoading}>
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
                      <p className="text-sm text-muted-foreground">Apri la schermata Microsoft, autorizza l'accesso e torna qui per continuare.</p>
                      <Button className="min-h-11" onClick={connectOutlook} disabled={outlookConnecting || ro}>
                        {outlookConnecting ? INTEGRATION_LABELS.openingProvider : INTEGRATION_LABELS.connectNow}
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
            {connectorConfigDrawer === "connector_twilio" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Collegamento guidato: apri Twilio Console, completa il setup del sender WhatsApp, poi torna qui e verifica. I campi manuali sono disponibili solo come fallback avanzato.
                </p>
                {!twilioEntitled && (
                  <Alert
                    variant="warning"
                    title="Modulo Twilio non attivo"
                    className="mt-2 text-sm"
                  >
                    Non puoi salvare una nuova configurazione né inviare prove finché Tecma non abilita il servizio. Puoi comunque rimuovere una config esistente.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {twilioDrawerError && <p className="text-sm text-destructive">{twilioDrawerError}</p>}
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Step rapido (consigliato)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => openProviderPage("https://console.twilio.com/")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {INTEGRATION_LABELS.connectNow}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={verifyTwilioConnection}
                      disabled={twilioVerifying}
                    >
                      {twilioVerifying ? INTEGRATION_LABELS.verifyShortLoading : INTEGRATION_LABELS.verifyAfterProvider}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se la verifica non trova una config, apri la modalità avanzata e inserisci SID/token/from.
                  </p>
                </div>
                {!twilioShowAdvanced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start px-0"
                    onClick={() => setTwilioShowAdvanced(true)}
                  >
                    {INTEGRATION_LABELS.openAdvanced}
                  </Button>
                )}
                {twilioShowAdvanced && (
                  <>
                    <div>
                      <label htmlFor="twilio-account-sid" className="text-sm font-medium text-foreground">Account SID</label>
                      <Input
                        id="twilio-account-sid"
                        value={twilioAccountSid}
                        onChange={(e) => setTwilioAccountSid(e.target.value)}
                        placeholder="AC…"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="twilio-auth-token" className="text-sm font-medium text-foreground">Auth Token</label>
                      <Input
                        id="twilio-auth-token"
                        type="password"
                        value={twilioAuthToken}
                        onChange={(e) => setTwilioAuthToken(e.target.value)}
                        placeholder={twilioHasSavedConfig ? "•••• (inserisci nuovo token per aggiornare)" : "Token"}
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="twilio-from" className="text-sm font-medium text-foreground">Numero mittente WhatsApp</label>
                      <Input
                        id="twilio-from"
                        value={twilioFromNumber}
                        onChange={(e) => setTwilioFromNumber(e.target.value)}
                        placeholder="+14155238886 o +39…"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                {isAdmin && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-sm font-medium text-foreground">Messaggio di prova (solo admin)</p>
                    <Input
                      placeholder="Destinatario E.164, es. +393331112233"
                      value={twilioTestTo}
                      onChange={(e) => setTwilioTestTo(e.target.value)}
                    />
                    <Input
                      placeholder="Testo (opzionale)"
                      value={twilioTestBody}
                      onChange={(e) => setTwilioTestBody(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      onClick={testTwilioWhatsApp}
                      disabled={twilioTestSending || !twilioHasSavedConfig || !twilioEntitled}
                    >
                      {twilioTestSending ? INTEGRATION_LABELS.sendLoading : INTEGRATION_LABELS.sendTestWhatsapp}
                    </Button>
                    {!twilioHasSavedConfig && (
                      <p className="text-xs text-muted-foreground">Salva la configurazione prima di inviare una prova.</p>
                    )}
                  </div>
                )}
              </>
            )}
            {connectorConfigDrawer === "connector_meta_whatsapp" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Credenziali dalla{" "}
                  <span className="font-medium text-foreground">Meta for Developers</span> (WhatsApp Cloud API). Gli invii usano solo{" "}
                  <span className="font-medium text-foreground">template approvati</span>; configura nome e lingua del template anche nei messaggi del tab{" "}
                  <span className="font-medium text-foreground">Comunicazioni</span>.
                </p>
                {metaDrawerError && <p className="text-sm text-destructive">{metaDrawerError}</p>}
                <div>
                  <label htmlFor="meta-phone-number-id" className="text-sm font-medium text-foreground">
                    Phone Number ID
                  </label>
                  <Input
                    id="meta-phone-number-id"
                    value={metaPhoneNumberId}
                    onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                    placeholder="ID del numero WhatsApp Business"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="meta-access-token" className="text-sm font-medium text-foreground">
                    Access token
                  </label>
                  <Input
                    id="meta-access-token"
                    type="password"
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    placeholder={
                      metaHasSavedConfig
                        ? "•••• (inserisci nuovo token per aggiornare)"
                        : "Token permanente o di sistema utente con whatsapp_business_messaging"
                    }
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="text-sm font-medium text-foreground">Messaggio di prova con template (solo admin)</p>
                    <p className="text-xs text-muted-foreground">
                      Nome e lingua sono precompilati con il template di esempio Meta <strong className="font-medium text-foreground">hello_world</strong> /{" "}
                      <strong className="font-medium text-foreground">en_US</strong>, di solito già disponibile su account nuovi. Inserisci solo il numero di
                      prova; se usi un altro template approvato, modifica nome, lingua e parametri.
                    </p>
                    <Input
                      placeholder="Destinatario E.164 (obbligatorio), es. +393331112233"
                      value={metaTestTo}
                      onChange={(e) => setMetaTestTo(e.target.value)}
                    />
                    <Input
                      placeholder="Nome template su Meta (es. hello_world)"
                      value={metaTestTemplateName}
                      onChange={(e) => setMetaTestTemplateName(e.target.value)}
                    />
                    <Input
                      placeholder="Codice lingua Meta, es. en_US o it"
                      value={metaTestLanguage}
                      onChange={(e) => setMetaTestLanguage(e.target.value)}
                    />
                    <Input
                      placeholder="Parametri corpo (opzionale), virgola o a capo — hello_world di solito non ne ha"
                      value={metaTestParamsRaw}
                      onChange={(e) => setMetaTestParamsRaw(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      onClick={testMetaWhatsApp}
                      disabled={metaTestSending || !metaHasSavedConfig}
                    >
                      {metaTestSending ? INTEGRATION_LABELS.sendLoading : INTEGRATION_LABELS.sendTestMeta}
                    </Button>
                    {!metaHasSavedConfig && (
                      <p className="text-xs text-muted-foreground">Salva la configurazione prima di inviare una prova.</p>
                    )}
                  </div>
                )}
              </>
            )}
            {connectorConfigDrawer === "connector_mailchimp" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Inserisci l&apos;API key del tuo account Mailchimp (Account → Extras → API keys). La chiave viene conservata in modo cifrato lato
                  infrastruttura; in questa schermata vedi solo un valore mascherato dopo il salvataggio.
                </p>
                {!mailchimpSaveOk && (
                  <Alert variant="warning" title="Modulo Mailchimp o Integrazioni non attivo" className="mt-2 text-sm">
                    Non puoi salvare una nuova API key senza Integrazioni e Mailchimp abilitati da Tecma. Puoi rimuovere una config esistente.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {mailchimpDrawerError && <p className="text-sm text-destructive">{mailchimpDrawerError}</p>}
                <div>
                  <label htmlFor="mailchimp-api-key" className="text-sm font-medium text-foreground">
                    API key
                  </label>
                  <Input
                    id="mailchimp-api-key"
                    type="password"
                    value={mailchimpApiKey}
                    onChange={(e) => setMailchimpApiKey(e.target.value)}
                    placeholder={
                      mailchimpHasSavedConfig
                        ? "•••• (inserisci nuova key per aggiornare)"
                        : "Chiave Mailchimp"
                    }
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {connectorConfigDrawer === "connector_activecampaign" && (
              <>
                <p className="text-sm text-muted-foreground">
                  API key e URL base da <span className="font-medium text-foreground">Settings → Developer</span> in ActiveCampaign. La key è mascherata dopo
                  il salvataggio; l&apos;URL viene mostrato in chiaro per verifica. Al primo collegamento servono entrambi; per ruotare solo la key puoi lasciare
                  l&apos;URL com&apos;è.
                </p>
                {!activeCampaignSaveOk && (
                  <Alert variant="warning" title="Modulo ActiveCampaign o Integrazioni non attivo" className="mt-2 text-sm">
                    Non puoi salvare una nuova API key senza Integrazioni e ActiveCampaign abilitati da Tecma. Puoi rimuovere una config esistente.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {activeCampaignDrawerError && <p className="text-sm text-destructive">{activeCampaignDrawerError}</p>}
                <div>
                  <label htmlFor="activecampaign-api-url" className="text-sm font-medium text-foreground">
                    URL API
                  </label>
                  <Input
                    id="activecampaign-api-url"
                    type="url"
                    value={activeCampaignApiBaseUrl}
                    onChange={(e) => setActiveCampaignApiBaseUrl(e.target.value)}
                    placeholder="https://account.api-us1.com"
                    className="mt-1"
                    autoComplete="off"
                  />
                  {!activeCampaignHasSavedConfig && (
                    <p className="mt-1 text-xs text-muted-foreground">Obbligatorio al primo salvataggio (stesso URL indicato nel pannello Developer).</p>
                  )}
                </div>
                <div>
                  <label htmlFor="activecampaign-api-key" className="text-sm font-medium text-foreground">
                    API key
                  </label>
                  <Input
                    id="activecampaign-api-key"
                    type="password"
                    value={activeCampaignApiKey}
                    onChange={(e) => setActiveCampaignApiKey(e.target.value)}
                    placeholder={
                      activeCampaignHasSavedConfig
                        ? "•••• (inserisci nuova key per aggiornare)"
                        : "Chiave ActiveCampaign"
                    }
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {connectorConfigDrawer === "connector_stripe" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Secret key da Stripe Dashboard (Developers → API keys). Per verificare i webhook, aggiungi anche il signing secret (whsec_…) e registra
                  l&apos;endpoint sotto in Stripe.
                </p>
                {!integrationsEntitled && (
                  <Alert variant="warning" title="Integrazioni non attive" className="text-sm">
                    Non puoi salvare senza modulo Integrazioni abilitato da Tecma.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {stripeDrawerError && <p className="text-sm text-destructive">{stripeDrawerError}</p>}
                {workspaceId && (
                  <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs break-all">
                    {`${resolveApiBaseUrl().replace(/\/$/, "")}${stripeWebhookUrlTemplate.replace(":workspaceId", workspaceId)}`}
                  </p>
                )}
                <div>
                  <label htmlFor="stripe-sk" className="text-sm font-medium text-foreground">
                    Secret key (sk_…)
                  </label>
                  <Input
                    id="stripe-sk"
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder={stripeHasSavedConfig ? "•••• (incolla nuova sk_ per aggiornare)" : "sk_live_… o sk_test_…"}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="stripe-whsec" className="text-sm font-medium text-foreground">
                    Webhook signing secret (whsec_…, opzionale)
                  </label>
                  <Input
                    id="stripe-whsec"
                    type="password"
                    value={stripeWebhookSecret}
                    onChange={(e) => setStripeWebhookSecret(e.target.value)}
                    placeholder="Opzionale al primo salvataggio; incolla per aggiungere o ruotare"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="stripe-pk" className="text-sm font-medium text-foreground">
                    Publishable key (pk_…, opzionale)
                  </label>
                  <Input
                    id="stripe-pk"
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                    placeholder="pk_live_… — solo riferimento, resta in chiaro dopo il salvataggio"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {connectorConfigDrawer === "connector_paypal" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Credenziali REST dall&apos;app PayPal Developer. Registra l&apos;URL webhook qui sotto nel dashboard PayPal. In aggiornamento puoi omettere
                  il Secret se non è cambiato.
                </p>
                {!integrationsEntitled && (
                  <Alert variant="warning" title="Integrazioni non attive" className="text-sm">
                    Non puoi salvare senza modulo Integrazioni abilitato da Tecma.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {paypalDrawerError && <p className="text-sm text-destructive">{paypalDrawerError}</p>}
                {workspaceId && (
                  <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs break-all">
                    {`${resolveApiBaseUrl().replace(/\/$/, "")}${paypalWebhookUrlTemplate.replace(":workspaceId", workspaceId)}`}
                  </p>
                )}
                <div>
                  <label htmlFor="paypal-mode" className="text-sm font-medium text-foreground">
                    Ambiente
                  </label>
                  <Select value={paypalMode} onValueChange={(v) => setPaypalMode(v as "sandbox" | "live")}>
                    <SelectTrigger id="paypal-mode" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="paypal-cid" className="text-sm font-medium text-foreground">
                    Client ID
                  </label>
                  <Input
                    id="paypal-cid"
                    value={paypalClientId}
                    onChange={(e) => setPaypalClientId(e.target.value)}
                    placeholder="Client ID dall’app REST"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="paypal-sec" className="text-sm font-medium text-foreground">
                    Client Secret
                  </label>
                  <Input
                    id="paypal-sec"
                    type="password"
                    value={paypalClientSecret}
                    onChange={(e) => setPaypalClientSecret(e.target.value)}
                    placeholder={
                      paypalHasSavedConfig
                        ? "•••• (incolla nuovo secret per aggiornare, o lascia vuoto se invariato)"
                        : "Secret dall’app REST"
                    }
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="paypal-wh" className="text-sm font-medium text-foreground">
                    Webhook ID (opzionale)
                  </label>
                  <Input
                    id="paypal-wh"
                    value={paypalWebhookId}
                    onChange={(e) => setPaypalWebhookId(e.target.value)}
                    placeholder="ID webhook nel Developer Dashboard"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {connectorConfigDrawer === "connector_webflow" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Token API (Data API v2), Site ID e ID della collection CMS «Appartamenti». Slug campi richiesti nella collection:{" "}
                  <span className="font-mono text-xs">tecma-apartment-id</span>, <span className="font-mono text-xs">prezzo-eur</span>,{" "}
                  <span className="font-mono text-xs">stato</span>, <span className="font-mono text-xs">modalita</span>,{" "}
                  <span className="font-mono text-xs">codice-unita</span>, <span className="font-mono text-xs">planimetria-url</span>.
                </p>
                {!integrationsEntitled && (
                  <Alert variant="warning" title="Integrazioni non attive" className="text-sm">
                    Non puoi salvare senza modulo Integrazioni abilitato da Tecma.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {webflowDrawerError && <p className="text-sm text-destructive">{webflowDrawerError}</p>}
                <div>
                  <label htmlFor="wf-token" className="text-sm font-medium text-foreground">
                    API token
                  </label>
                  <Input
                    id="wf-token"
                    type="password"
                    value={webflowApiToken}
                    onChange={(e) => setWebflowApiToken(e.target.value)}
                    placeholder={webflowHasSavedConfig ? "•••• (incolla nuovo token per aggiornare)" : "Token Webflow"}
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="wf-site" className="text-sm font-medium text-foreground">
                    Site ID
                  </label>
                  <Input
                    id="wf-site"
                    value={webflowSiteId}
                    onChange={(e) => setWebflowSiteId(e.target.value)}
                    placeholder="ID sito Webflow"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="wf-coll" className="text-sm font-medium text-foreground">
                    Collection ID (appartamenti)
                  </label>
                  <Input
                    id="wf-coll"
                    value={webflowCollectionId}
                    onChange={(e) => setWebflowCollectionId(e.target.value)}
                    placeholder="ID collection CMS"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Sync verso Webflow</p>
                  <p className="mt-1">
                    Vengono usati i progetti attualmente selezionati nella sidebar ({projectIds.length || 0} progetto/i).{" "}
                    {projectIds.length === 0 && "Seleziona almeno un progetto per sync."}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 min-h-11"
                    onClick={runWebflowSync}
                    disabled={webflowSyncing || !webflowHasSavedConfig || projectIds.length === 0 || ro}
                  >
                    {webflowSyncing ? "Sync in corso…" : "Sync appartamenti → Webflow"}
                  </Button>
                  {!webflowHasSavedConfig && (
                    <p className="mt-2 text-amber-700 dark:text-amber-300">Salva la configurazione prima di eseguire il sync.</p>
                  )}
                </div>
              </>
            )}
            {connectorConfigDrawer === "connector_microsoft_teams" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Connessione guidata: apri Teams, crea Incoming Webhook e torna qui per la verifica. L&apos;incolla manuale resta disponibile solo come fallback.
                </p>
                {!integrationsEntitled && (
                  <Alert variant="warning" title="Integrazioni non attive" className="text-sm">
                    Non puoi salvare senza modulo Integrazioni abilitato da Tecma.
                    {commercialContactInlineNode()}
                  </Alert>
                )}
                {teamsDrawerError && <p className="text-sm text-destructive">{teamsDrawerError}</p>}
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Step rapido (consigliato)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11"
                      onClick={() =>
                        openProviderPage(
                          "https://learn.microsoft.com/it-it/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {INTEGRATION_LABELS.connectNow}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={verifyTeamsConnection}
                      disabled={teamsVerifying}
                    >
                      {teamsVerifying ? INTEGRATION_LABELS.verifyShortLoading : INTEGRATION_LABELS.verifyAfterProvider}
                    </Button>
                  </div>
                </div>
                {!teamsShowAdvanced && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start px-0"
                    onClick={() => setTeamsShowAdvanced(true)}
                  >
                    {INTEGRATION_LABELS.openAdvanced}
                  </Button>
                )}
                {teamsShowAdvanced && (
                  <>
                    <div>
                      <label htmlFor="teams-url" className="text-sm font-medium text-foreground">
                        URL Incoming Webhook
                      </label>
                      <Input
                        id="teams-url"
                        type="url"
                        value={teamsWebhookUrl}
                        onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                        placeholder="https://outlook.office.com/webhook/…"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label htmlFor="teams-label" className="text-sm font-medium text-foreground">
                        Etichetta (opzionale)
                      </label>
                      <Input
                        id="teams-label"
                        value={teamsLabel}
                        onChange={(e) => setTeamsLabel(e.target.value)}
                        placeholder="es. Canale vendite"
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={testTeamsWebhook}
                  disabled={teamsTestSending || !teamsHasSavedConfig || ro}
                >
                  {teamsTestSending ? INTEGRATION_LABELS.sendLoading : INTEGRATION_LABELS.sendTestMessage}
                </Button>
                {!teamsHasSavedConfig && (
                  <p className="text-xs text-muted-foreground">Salva la configurazione prima di inviare una prova.</p>
                )}
              </>
            )}
            {connectorConfigDrawer === "connector_workspace_ai" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Un solo provider LLM attivo per workspace (stessa configurazione delle Impostazioni workspace → Provider AI). La chiave è custodita lato server e
                  non viene mai mostrata in chiaro dopo il salvataggio.
                </p>
                {workspaceAiConfig?.configured && workspaceAiConfig.provider && (
                  <p className="text-sm text-foreground">
                    Stato attuale:{" "}
                    <span className="font-medium">
                      {workspaceAiConfig.provider === "claude"
                        ? "Claude (Anthropic)"
                        : workspaceAiConfig.provider === "openai"
                          ? "OpenAI"
                          : workspaceAiConfig.provider === "gemini"
                            ? "Gemini (Google)"
                            : workspaceAiConfig.provider}
                    </span>
                    {workspaceAiConfig.apiKeyMasked && (
                      <span className="ml-1 text-xs text-muted-foreground">({workspaceAiConfig.apiKeyMasked})</span>
                    )}
                  </p>
                )}
                {!isAdmin && (
                  <Alert variant="warning" title="Solo amministratore" className="text-sm">
                    Salvataggio e rimozione della chiave API richiedono un amministratore workspace (allineato all’API e alla pagina Workspaces).
                  </Alert>
                )}
                {workspaceAiDrawerError && <p className="text-sm text-destructive">{workspaceAiDrawerError}</p>}
                <div>
                  <label htmlFor="ai-provider" className="text-sm font-medium text-foreground">
                    Provider
                  </label>
                  <Select
                    value={workspaceAiFormProvider}
                    onValueChange={(v) => setWorkspaceAiFormProvider(v as "claude" | "openai" | "gemini")}
                  >
                    <SelectTrigger id="ai-provider" className="mt-1 min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                      <SelectItem value="openai">OpenAI (ChatGPT API)</SelectItem>
                      <SelectItem value="gemini">Gemini (Google)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="ai-api-key" className="text-sm font-medium text-foreground">
                    API key
                  </label>
                  <Input
                    id="ai-api-key"
                    type="password"
                    value={workspaceAiFormApiKey}
                    onChange={(e) => setWorkspaceAiFormApiKey(e.target.value)}
                    placeholder="Incolla la chiave del provider selezionato"
                    className="mt-1 min-h-11"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </DrawerBody>
          {connectorConfigDrawer === "connector_n8n" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveN8nConfig} disabled={connectorSaving || ro}>
                {connectorSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              <Button variant="outline" className="min-h-11" onClick={testN8nTrigger} disabled={n8nTestTriggering || connectorSaving || ro}>
                {n8nTestTriggering ? INTEGRATION_LABELS.n8nTrialLoading : INTEGRATION_LABELS.n8nTrialRun}
              </Button>
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_outlook" && (
            <DrawerFooter>
              <Button className="min-h-11" onClick={saveConnectorWebhook} disabled={connectorSaving || ro}>
                {connectorSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_twilio" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveTwilioConfig} disabled={twilioSaving || ro || !twilioEntitled}>
                {twilioSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {twilioHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeTwilioConfig} disabled={twilioSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_meta_whatsapp" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveMetaWhatsAppConfig} disabled={metaSaving || ro}>
                {metaSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {metaHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeMetaWhatsAppConfig} disabled={metaSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_mailchimp" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveMailchimpConfig} disabled={mailchimpSaving || ro || !mailchimpSaveOk}>
                {mailchimpSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {mailchimpHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeMailchimpConfig} disabled={mailchimpSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_activecampaign" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                onClick={saveActiveCampaignConfig}
                disabled={activeCampaignSaving || ro || !activeCampaignSaveOk}
              >
                {activeCampaignSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {activeCampaignHasSavedConfig && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={removeActiveCampaignConfig}
                  disabled={activeCampaignSaving || ro}
                >
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_stripe" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveStripeConnector} disabled={stripeSaving || ro || !integrationsEntitled}>
                {stripeSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {stripeHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeStripeConnector} disabled={stripeSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_paypal" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={savePayPalConnector} disabled={paypalSaving || ro || !integrationsEntitled}>
                {paypalSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {paypalHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removePayPalConnector} disabled={paypalSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_webflow" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveWebflowConnector} disabled={webflowSaving || ro || !integrationsEntitled}>
                {webflowSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {webflowHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeWebflowConnector} disabled={webflowSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_microsoft_teams" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button className="min-h-11" onClick={saveTeamsConnector} disabled={teamsSaving || ro || !integrationsEntitled}>
                {teamsSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
              {teamsHasSavedConfig && (
                <Button variant="outline" className="min-h-11" onClick={removeTeamsConnector} disabled={teamsSaving || ro}>
                  {INTEGRATION_LABELS.removeSavedConfig}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_workspace_ai" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button
                className="min-h-11 gap-1"
                onClick={saveWorkspaceAiIntegration}
                disabled={workspaceAiSaving || ro || !isAdmin || !workspaceAiFormApiKey.trim()}
              >
                {workspaceAiSaving ? (
                  INTEGRATION_LABELS.saving
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {INTEGRATION_LABELS.saveProvider}
                  </>
                )}
              </Button>
              {workspaceAiConfig?.configured && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={removeWorkspaceAiIntegration}
                  disabled={workspaceAiSaving || ro || !isAdmin}
                >
                  {INTEGRATION_LABELS.disconnectAiProvider}
                </Button>
              )}
            </DrawerFooter>
          )}
          {connectorConfigDrawer === "connector_sumsub" && (
            <DrawerFooter className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                onClick={saveSumsubConnector}
                disabled={sumsubSaving || ro || !integrationsEntitled}
              >
                {sumsubSaving ? INTEGRATION_LABELS.saving : INTEGRATION_LABELS.save}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
