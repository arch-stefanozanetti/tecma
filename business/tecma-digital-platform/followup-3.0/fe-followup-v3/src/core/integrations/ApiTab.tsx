import { FileText, Copy, ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button";

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

export function ApiTab() {
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
