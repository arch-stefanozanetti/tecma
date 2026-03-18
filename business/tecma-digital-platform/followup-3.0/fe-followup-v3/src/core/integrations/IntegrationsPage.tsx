import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
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
