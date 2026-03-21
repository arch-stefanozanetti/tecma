import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert } from "../../components/ui/alert";
import { useWorkspace } from "../../auth/projectScope";
import type { WebhookConfigRow } from "../../types/domain";
import {
  isValidTab,
  CONNECTOR_CATALOG,
  LOOKER_CONNECTOR_STORAGE_KEY,
  type TabKey,
  type ConnectorCatalogItem,
  type N8nConfigSnapshot,
} from "./integrationsCatalog";
import { ConnettoriTab } from "./ConnettoriTab";
import { ComunicazioniTab } from "./ComunicazioniTab";
import { RegoleTab } from "./RegoleTab";
import { WebhookTab } from "./WebhookTab";
import { ApiTab } from "./ApiTab";
import { followupApi } from "../../api/followupApi";
import { PageSimple } from "../shared/PageSimple";
import type { WorkspaceEntitlementEffectiveRow } from "../../types/domain";
import { workspaceFeatureEntitled } from "./workspaceEntitlementUi";
import { commercialContactInlineNode } from "./tecmaCommercialContact";

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
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [metaWhatsAppConfigured, setMetaWhatsAppConfigured] = useState(false);
  const [mailchimpConfigured, setMailchimpConfigured] = useState(false);
  const [activeCampaignConfigured, setActiveCampaignConfigured] = useState(false);
  const [autoOpenTwilio, setAutoOpenTwilio] = useState(false);
  const [autoOpenMetaWhatsapp, setAutoOpenMetaWhatsapp] = useState(false);
  const [workspaceEntitlements, setWorkspaceEntitlements] = useState<
    WorkspaceEntitlementEffectiveRow[] | undefined
  >(undefined);
  const twilioQueryConsumedRef = useRef(false);
  const metaWhatsappQueryConsumedRef = useRef(false);
  const { selectedProjectIds: projectIds, isAdmin, hasPermission } = useWorkspace();
  const canReadIntegrations = hasPermission("integrations.read");
  const canMutateIntegrations = hasPermission("integrations.update");

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

  useEffect(() => {
    if (!workspaceId) return;
    followupApi
      .getWorkspaceEntitlements(workspaceId)
      .then((r) => setWorkspaceEntitlements(r.data ?? []))
      .catch(() => setWorkspaceEntitlements(undefined));
  }, [workspaceId]);

  const loadOutlookStatus = useCallback(() => {
    followupApi
      .getOutlookStatus()
      .then((r) => setOutlookConnected(r.connected))
      .catch(() => setOutlookConnected(false));
  }, []);

  const loadTwilioStatus = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getWhatsAppConfig(workspaceId)
      .then((r) => setTwilioConfigured(!!r.config))
      .catch(() => setTwilioConfigured(false));
  }, [workspaceId]);

  const loadMetaWhatsAppStatus = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getMetaWhatsAppConfig(workspaceId)
      .then((r) => setMetaWhatsAppConfigured(!!r.config))
      .catch(() => setMetaWhatsAppConfigured(false));
  }, [workspaceId]);

  const loadMailchimpStatus = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getMailchimpConnectorConfig(workspaceId)
      .then((r) => setMailchimpConfigured(!!r.config))
      .catch(() => setMailchimpConfigured(false));
  }, [workspaceId]);

  const loadActiveCampaignStatus = useCallback(() => {
    if (!workspaceId) return;
    followupApi
      .getActiveCampaignConnectorConfig(workspaceId)
      .then((r) => setActiveCampaignConfigured(!!r.config))
      .catch(() => setActiveCampaignConfigured(false));
  }, [workspaceId]);

  useEffect(() => {
    loadN8nConfig();
  }, [loadN8nConfig]);

  useEffect(() => {
    loadOutlookStatus();
  }, [loadOutlookStatus]);

  useEffect(() => {
    loadTwilioStatus();
  }, [loadTwilioStatus]);

  useEffect(() => {
    loadMetaWhatsAppStatus();
  }, [loadMetaWhatsAppStatus]);

  useEffect(() => {
    loadMailchimpStatus();
  }, [loadMailchimpStatus]);

  useEffect(() => {
    loadActiveCampaignStatus();
  }, [loadActiveCampaignStatus]);

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
  }, [searchParams, loadOutlookStatus, setSearchParams]);

  useEffect(() => {
    if (activeTab !== "connettori") {
      twilioQueryConsumedRef.current = false;
      metaWhatsappQueryConsumedRef.current = false;
      setAutoOpenTwilio(false);
      setAutoOpenMetaWhatsapp(false);
      return;
    }
    const connector = searchParams.get("connector");
    if (connector === "twilio" && !twilioQueryConsumedRef.current) {
      setAutoOpenTwilio(true);
    } else {
      if (connector !== "twilio") {
        twilioQueryConsumedRef.current = false;
        setAutoOpenTwilio(false);
      }
    }
    if (connector === "meta_whatsapp" && !metaWhatsappQueryConsumedRef.current) {
      setAutoOpenMetaWhatsapp(true);
    } else {
      if (connector !== "meta_whatsapp") {
        metaWhatsappQueryConsumedRef.current = false;
        setAutoOpenMetaWhatsapp(false);
      }
    }
  }, [activeTab, searchParams]);

  const consumeTwilioConnectorQuery = useCallback(() => {
    twilioQueryConsumedRef.current = true;
    setAutoOpenTwilio(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("connector") === "twilio") next.delete("connector");
      return next;
    });
  }, [setSearchParams]);

  const consumeMetaWhatsappConnectorQuery = useCallback(() => {
    metaWhatsappQueryConsumedRef.current = true;
    setAutoOpenMetaWhatsapp(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("connector") === "meta_whatsapp") next.delete("connector");
      return next;
    });
  }, [setSearchParams]);

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
        if (c.id === "connector_twilio") {
          return { ...c, status: twilioConfigured ? "configured" : "available" };
        }
        if (c.id === "connector_meta_whatsapp") {
          return { ...c, status: metaWhatsAppConfigured ? "configured" : "available" };
        }
        if (c.id === "connector_mailchimp") {
          return { ...c, status: mailchimpConfigured ? "configured" : "beta" };
        }
        if (c.id === "connector_activecampaign") {
          return { ...c, status: activeCampaignConfigured ? "configured" : "beta" };
        }
        return c;
      })
    );
  }, [
    workspaceId,
    webhookConfigs,
    n8nConfig,
    outlookConnected,
    twilioConfigured,
    metaWhatsAppConfigured,
    mailchimpConfigured,
    activeCampaignConfigured,
  ]);

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

  if (!canReadIntegrations) {
    return (
      <PageSimple
        title="Accesso negato"
        description="Non hai il permesso per Integrazioni e automazioni (integrations.read)."
      >
        <p className="text-sm text-muted-foreground">
          Contatta un amministratore o effettua di nuovo login / refresh del token se i ruoli sono stati aggiornati.
        </p>
      </PageSimple>
    );
  }

  const integrationsReadOnly = !canMutateIntegrations;
  const publicApiEntitled = workspaceFeatureEntitled(workspaceEntitlements, "publicApi");
  const twilioEntitled = workspaceFeatureEntitled(workspaceEntitlements, "twilio");
  const mailchimpEntitled = workspaceFeatureEntitled(workspaceEntitlements, "mailchimp");
  const activecampaignEntitled = workspaceFeatureEntitled(workspaceEntitlements, "activecampaign");
  const marketingAutomationEntitled =
    workspaceFeatureEntitled(workspaceEntitlements, "mailchimp") ||
    workspaceFeatureEntitled(workspaceEntitlements, "activecampaign");

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
            <Alert variant="info" title="Attivazioni commerciali (Tecma)" className="mt-4 max-w-3xl">
              <span className="block leading-relaxed">
                Moduli a consumo — Public API, Twilio, automazioni marketing collegate a Mailchimp/ActiveCampaign e altre capability in elenco — si
                attivano solo dopo accordo con Tecma.{" "}
                <strong className="font-medium text-foreground">Non è possibile auto-abilitarli dal portale.</strong>{" "}
                Contatta il referente commerciale o il supporto per richiedere l’attivazione sul workspace.
                {commercialContactInlineNode()}
              </span>
            </Alert>
            {integrationsReadOnly && (
              <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                Sola lettura: non puoi salvare o modificare configurazioni (manca integrations.update).
              </p>
            )}
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
            <TabsTrigger value="regole" role="tab" aria-selected={activeTab === "regole"} title="Regole su eventi con notifiche in-app">
              Automazioni
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
              isAdmin={isAdmin}
              readOnly={integrationsReadOnly}
              autoOpenTwilio={autoOpenTwilio}
              onTwilioAutoOpenConsumed={consumeTwilioConnectorQuery}
              reloadTwilioStatus={loadTwilioStatus}
              autoOpenMetaWhatsapp={autoOpenMetaWhatsapp}
              onMetaAutoOpenConsumed={consumeMetaWhatsappConnectorQuery}
              reloadMetaWhatsAppStatus={loadMetaWhatsAppStatus}
              twilioEntitled={twilioEntitled}
              mailchimpEntitled={mailchimpEntitled}
              activecampaignEntitled={activecampaignEntitled}
              reloadMailchimpStatus={loadMailchimpStatus}
              reloadActiveCampaignStatus={loadActiveCampaignStatus}
              workspaceEntitlements={workspaceEntitlements}
            />
          </TabsContent>
          <TabsContent value="comunicazioni" className="mt-6" role="tabpanel">
            <ComunicazioniTab workspaceId={workspaceId} isAdmin={isAdmin} readOnly={integrationsReadOnly} />
          </TabsContent>
          <TabsContent value="regole" className="mt-6" role="tabpanel">
            <RegoleTab workspaceId={workspaceId} readOnly={integrationsReadOnly} />
          </TabsContent>
          <TabsContent value="webhook" className="mt-6" role="tabpanel">
            <WebhookTab workspaceId={workspaceId} readOnly={integrationsReadOnly} />
          </TabsContent>
          <TabsContent value="api" className="mt-6" role="tabpanel">
            <ApiTab
              workspaceId={workspaceId}
              isAdmin={isAdmin}
              publicApiEntitled={publicApiEntitled}
              marketingAutomationEntitled={marketingAutomationEntitled}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
