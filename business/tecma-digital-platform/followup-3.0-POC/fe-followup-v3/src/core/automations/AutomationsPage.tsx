import { Zap, Webhook, FileText } from "lucide-react";
import { PageSimple } from "../shared/PageSimple";

export const AutomationsPage = () => (
  <PageSimple
    title="Automazioni e API"
    description="Regole if/then e webhook per integrazioni esterne. In arrivo."
  >
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Zap className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Automazioni</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura regole del tipo &quot;quando trattativa passa a stato X → crea notifica&quot; o
            &quot;quando nuovo cliente → assegna a ruolo Y&quot;. Trigger (cambio stato, nuovo cliente) e
            azioni (notifica, webhook) saranno disponibili in una prossima release.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Webhook className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Webhook</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Endpoint configurabile per workspace: il backend invierà payload su eventi (nuova trattativa,
            cambio stato). Modello WebhookConfig (url, secret, eventi) e coda asincrona in arrivo.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">API pubbliche</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Endpoint esistenti per listing (apartments/query, clients) sono documentati per uso da siti
            web e connettori. Autenticazione API key o OAuth e OpenAPI:{" "}
            <code className="mx-1 rounded bg-muted px-1 text-xs">be-followup-v3/openapi/openapi.v1.yaml</code> e{" "}
            <code className="mx-1 rounded bg-muted px-1 text-xs">GET /v1/openapi.json</code> (vedi anche{" "}
            <code className="mx-1 rounded bg-muted px-1 text-xs">docs/PIANO_GLOBALE_FOLLOWUP_3.md</code>).
          </p>
        </div>
      </div>
    </div>
  </PageSimple>
);
