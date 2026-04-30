import { useCallback, useEffect, useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../lib/formatDate";
import type { ClientRow } from "../../types/domain";
import { cn } from "../../lib/utils";

export interface AmlCheckListItem {
  _id: string;
  status: string;
  providerId: string;
  updatedAt: string;
  createdAt: string;
}

function amlStatusLabel(status: string | undefined): string {
  switch (status) {
    case "approved":
      return "Approvato";
    case "rejected":
      return "Respinto";
    case "manual_review":
      return "Revisione manuale";
    case "pending":
      return "In verifica";
    case "not_started":
    default:
      return "Non avviato";
  }
}

function amlStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
    case "manual_review":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
    case "pending":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export interface ClientDetailAmlSectionProps {
  workspaceId: string;
  clientId: string;
  client: ClientRow;
  onRefreshClient: () => Promise<void>;
}

export function ClientDetailAmlSection({ workspaceId, clientId, client, onRefreshClient }: ClientDetailAmlSectionProps) {
  const { hasPermission } = useWorkspace();
  const { toastError, toastSuccess } = useToast();
  const canStart = hasPermission("clients.update") && hasPermission("integrations.update");
  const [checks, setChecks] = useState<AmlCheckListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadChecks = useCallback(() => {
    if (!workspaceId || !clientId) return;
    setLoading(true);
    followupApi
      .listClientAmlChecks(workspaceId, clientId)
      .then((r) => setChecks((r.data ?? []) as AmlCheckListItem[]))
      .catch(() => setChecks([]))
      .finally(() => setLoading(false));
  }, [workspaceId, clientId]);

  useEffect(() => {
    loadChecks();
  }, [loadChecks]);

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      await followupApi.startClientAmlCheck(workspaceId, clientId, { providerId: "sumsub" });
      toastSuccess("Verifica AML avviata. L’esito si aggiorna quando Sumsub invia il webhook o puoi ricaricare la pagina.");
      await onRefreshClient();
      loadChecks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore avvio verifica";
      toastError(msg);
    } finally {
      setStarting(false);
    }
  };

  const pending = client.amlStatus === "pending";

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">AML / KYC</h2>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
            amlStatusBadgeClass(client.amlStatus)
          )}
        >
          {amlStatusLabel(client.amlStatus)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Verifica identità e screening tramite Sumsub (se configurato in Integrazioni). L&apos;esito non sostituisce le
        valutazioni di compliance del soggetto obbligato.
      </p>
      {!canStart && (
        <Alert variant="info" title="Permessi richiesti" className="text-sm">
          Per avviare una verifica servono i permessi su cliente e integrazioni (clients.update e integrations.update), e il
          modulo Integrazioni abilitato sul workspace.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11 gap-2"
          disabled={!canStart || starting || pending}
          onClick={() => void handleStart()}
          title={pending ? "È già in corso una verifica" : undefined}
        >
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Avvia verifica AML
        </Button>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => loadChecks()} disabled={loading}>
          Aggiorna elenco
        </Button>
      </div>
      {pending && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Verifica in corso: completa eventuali passi nel flusso Sumsub (documenti / selfie) se richiesto dal processo
          configurato.
        </p>
      )}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Storico verifiche</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna verifica registrata.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {checks.slice(0, 8).map((c) => (
              <li key={c._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", amlStatusBadgeClass(c.status))}>
                  {amlStatusLabel(c.status)}
                </span>
                <span className="text-muted-foreground">{c.providerId}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(c.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
