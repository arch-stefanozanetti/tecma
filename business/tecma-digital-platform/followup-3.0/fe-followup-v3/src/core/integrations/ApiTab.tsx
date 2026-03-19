import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Copy, ExternalLink, RefreshCw, Shield, Trash2, KeyRound } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { followupApi } from "../../api/followupApi";

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

/** Base URL assoluta per le API (per copia negli strumenti esterni). */
function getPublicApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === "string" && base.startsWith("http")) return base.replace(/\/$/, "");
  const path = (base && base.startsWith("/") ? base : `/${(base || "v1").replace(/^\//, "")}`).replace(/\/$/, "");
  return `${window.location.origin}${path}`;
}

interface ApiTabProps {
  workspaceId: string;
  isAdmin: boolean;
}

type PlatformApiKeyRow = {
  _id: string;
  label: string;
  projectIds: string[];
  scopes: string[];
  quotaPerDay: number | null;
  active: boolean;
  lastUsedAt?: string;
  createdAt: string;
};

type PlatformApiUsageRow = {
  keyRef: string;
  count: number;
  date: string;
};

export function ApiTab({ workspaceId, isAdmin }: ApiTabProps) {
  const baseUrl = getPublicApiBaseUrl();
  const openApiUrl = baseUrl ? `${baseUrl}/openapi.json` : "";
  const [keys, setKeys] = useState<PlatformApiKeyRow[]>([]);
  const [usage, setUsage] = useState<PlatformApiUsageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [generatedSecret, setGeneratedSecret] = useState<string>("");
  const [generatedMasked, setGeneratedMasked] = useState<string>("");
  const [formLabel, setFormLabel] = useState("");
  const [formScopes, setFormScopes] = useState("platform.capabilities.read,platform.listings.read,platform.reports.read");
  const [formProjectIds, setFormProjectIds] = useState("");
  const [formQuota, setFormQuota] = useState("");

  const copyBaseUrl = () => { if (baseUrl) navigator.clipboard.writeText(baseUrl); };
  const copyGeneratedSecret = () => { if (generatedSecret) navigator.clipboard.writeText(generatedSecret); };

  const canManageKeys = isAdmin && workspaceId.length > 0;

  const fetchPlatformData = useCallback(async () => {
    if (!canManageKeys) return;
    setLoading(true);
    setError("");
    try {
      const [keysRes, usageRes] = await Promise.all([
        followupApi.listPlatformApiKeys(workspaceId),
        followupApi.getPlatformApiKeyUsage(workspaceId),
      ]);
      setKeys((keysRes.data ?? []) as PlatformApiKeyRow[]);
      setUsage((usageRes.data ?? []) as PlatformApiUsageRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare API keys platform");
      setKeys([]);
      setUsage([]);
    } finally {
      setLoading(false);
    }
  }, [canManageKeys, workspaceId]);

  useEffect(() => {
    void fetchPlatformData();
  }, [fetchPlatformData]);

  const createKey = async () => {
    if (!workspaceId || !formLabel.trim()) return;
    setError("");
    try {
      const payload = {
        label: formLabel.trim(),
        scopes: formScopes
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        projectIds: formProjectIds
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        quotaPerDay: formQuota.trim() ? Number(formQuota) : null,
      };
      const res = await followupApi.createPlatformApiKey(workspaceId, payload);
      setGeneratedSecret(res.apiKey);
      setGeneratedMasked(res.apiKeyMasked);
      setFormLabel("");
      setFormProjectIds("");
      setFormQuota("");
      await fetchPlatformData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione API key fallita");
    }
  };

  const rotateKey = async (keyId: string) => {
    if (!workspaceId) return;
    setError("");
    try {
      const res = await followupApi.rotatePlatformApiKey(workspaceId, keyId);
      setGeneratedSecret(res.apiKey);
      setGeneratedMasked(res.apiKeyMasked);
      await fetchPlatformData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotazione API key fallita");
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!workspaceId) return;
    setError("");
    try {
      await followupApi.revokePlatformApiKey(workspaceId, keyId);
      await fetchPlatformData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoca API key fallita");
    }
  };

  const totalUsageToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return usage
      .filter((row) => row.date === today)
      .reduce((sum, row) => sum + row.count, 0);
  }, [usage]);

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
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">Platform API Governance</h4>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            API key tenant-aware con scope, filtro progetti e quota giornaliera. Gestione disponibile solo admin.
          </p>
          {!isAdmin && (
            <p className="mt-2 text-xs text-muted-foreground">
              Vista in sola lettura: richiedi ruolo admin per creare/ruotare/revocare le API key.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        {canManageKeys && (
          <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Label key</span>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Mini app esterna / BI connector" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Quota/day (opzionale)</span>
                <Input
                  type="number"
                  min={1}
                  value={formQuota}
                  onChange={(e) => setFormQuota(e.target.value)}
                  placeholder="es. 5000"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Scopes (comma-separated)</span>
                <Input
                  value={formScopes}
                  onChange={(e) => setFormScopes(e.target.value)}
                  placeholder="platform.capabilities.read,platform.listings.read"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Project IDs (comma-separated, opzionale)</span>
                <Input
                  value={formProjectIds}
                  onChange={(e) => setFormProjectIds(e.target.value)}
                  placeholder="project-a,project-b"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={() => void createKey()} disabled={!formLabel.trim()}>
                <KeyRound className="h-4 w-4" />
                Crea API key
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => void fetchPlatformData()} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </Button>
              <span className="text-xs text-muted-foreground">Usage oggi: {totalUsageToday} richieste</span>
            </div>
            {generatedSecret && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">Nuova API key generata (visibile una sola volta)</p>
                <p className="mt-1 font-mono text-xs text-amber-900 break-all">{generatedSecret}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-amber-800">Mask: {generatedMasked}</span>
                  <Button variant="outline" size="sm" onClick={copyGeneratedSecret}>Copia secret</Button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left">Label</th>
                    <th className="px-3 py-2 text-left">Scopes</th>
                    <th className="px-3 py-2 text-left">Projects</th>
                    <th className="px-3 py-2 text-left">Quota/day</th>
                    <th className="px-3 py-2 text-left">Last used</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{key.label}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{key.scopes.join(", ") || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{key.projectIds.join(", ") || "Tutti"}</td>
                      <td className="px-3 py-2">{key.quotaPerDay ?? "∞"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("it-IT") : "Mai"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => void rotateKey(key._id)}>
                            Ruota
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-1" onClick={() => void revokeKey(key._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoca
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && keys.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={6}>Nessuna API key platform configurata.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
