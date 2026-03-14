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
import type {
  AutomationRuleRow,
  AutomationRuleTrigger,
  CreateNotificationAction,
  WebhookConfigRow,
  AutomationEventType,
} from "../../types/domain";
import { cn } from "../../lib/utils";

const TAB_KEYS = ["connettori", "regole", "webhook", "api"] as const;
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

interface ConnectorCatalogItem {
  id: string;
  name: string;
  group: ConnectorGroup;
  status: ConnectorStatus;
  description: string;
  capabilities: string[];
  prerequisites: string[];
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

function ConnettoriTab({
  connectors,
  setConnectors,
}: {
  connectors: ConnectorCatalogItem[];
  setConnectors: React.Dispatch<React.SetStateAction<ConnectorCatalogItem[]>>;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | ConnectorGroup>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const toggleConnector = (id: string) => {
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

function ApiTab() {
  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">API pubbliche</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Endpoint esistenti per listing (apartments/query, clients/lite/query) sono disponibili per
            siti web e connettori. Autenticazione API key o OAuth; documentazione OpenAPI e piani in
            <code className="mx-1 rounded bg-muted px-1 text-xs">docs/plans/</code>.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
            <li>apartments/query — ricerca appartamenti con filtri</li>
            <li>clients/lite/query — clienti light per integrazioni</li>
          </ul>
        </div>
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
            <ConnettoriTab connectors={connectors} setConnectors={setConnectors} />
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
