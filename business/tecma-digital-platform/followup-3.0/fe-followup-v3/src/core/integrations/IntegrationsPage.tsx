import { useState, useMemo } from "react";
import { Search, Zap, CheckCircle2, AlertCircle, Clock, RefreshCcw, Plug } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";

type ConnectorStatus = "available" | "beta" | "coming_soon" | "configured" | "error";
type ConnectorGroup = "Communication" | "Marketing" | "Workflow Automation" | "CRM/Lead Sources" | "Website/CMS" | "Data/BI" | "Docs/Signature" | "Productivity/Collab";

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

const STATUS_CONFIG: Record<ConnectorStatus, { label: string; badgeClass: string; icon: React.ElementType }> = {
  configured: { label: "Configurato", badgeClass: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  beta: { label: "Beta", badgeClass: "bg-amber-50 text-amber-700 border-amber-200", icon: Zap },
  available: { label: "Disponibile", badgeClass: "bg-blue-50 text-blue-700 border-blue-200", icon: Plug },
  error: { label: "Errore", badgeClass: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  coming_soon: { label: "In arrivo", badgeClass: "bg-muted text-muted-foreground border-border", icon: Clock },
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

export const IntegrationsPage = () => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<"all" | ConnectorGroup>("all");
  const [connectors, setConnectors] = useState<ConnectorCatalogItem[]>(CONNECTOR_CATALOG);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connectors.filter((c) => {
      if (groupFilter !== "all" && c.group !== groupFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.group} ${c.description} ${c.capabilities.join(" ")}`.toLowerCase().includes(q);
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
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">Integrazioni</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Catalogo connettori per estendere il CRM. Configura i servizi esterni da cui vuoi ricevere dati.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>{configuredCount} configurato/i</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
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
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filtered.length} connettori
          </span>
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

                <p className="mt-2 text-sm text-muted-foreground flex-1">{connector.description}</p>

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
      </div>
    </div>
  );
};
