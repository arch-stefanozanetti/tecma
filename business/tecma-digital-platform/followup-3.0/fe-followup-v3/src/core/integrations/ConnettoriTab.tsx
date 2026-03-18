import { useState, useMemo } from "react";
import {
  Search,
  RefreshCcw,
  Plug,
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
import type { WebhookConfigRow, AutomationEventType } from "../../types/domain";
import { cn } from "../../lib/utils";
import {
  LOOKER_CONNECTOR_STORAGE_KEY,
  STATUS_CONFIG,
  ALL_GROUPS,
  CONNECTOR_EVENT_LABELS,
  type ConnectorCatalogItem,
  type ConnectorGroup,
  type ConnectorRelatedTab,
  type N8nConfigSnapshot,
} from "./integrationsCatalog";

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
  const { toastError, toastSuccess } = useToast();
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
