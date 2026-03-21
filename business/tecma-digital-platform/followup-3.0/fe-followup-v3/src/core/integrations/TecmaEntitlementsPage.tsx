import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type {
  WorkspaceEntitlementEffectiveRow,
  WorkspaceEntitlementFeature,
  WorkspaceEntitlementStatus,
} from "../../types/domain";

const FEATURE_LABELS: Record<WorkspaceEntitlementFeature, string> = {
  publicApi: "Public API / Platform keys",
  twilio: "Twilio (WhatsApp)",
  mailchimp: "Mailchimp",
  activecampaign: "ActiveCampaign",
};

const STATUSES: WorkspaceEntitlementStatus[] = [
  "inactive",
  "pending_approval",
  "active",
  "suspended",
];

const STATUS_LABELS: Record<WorkspaceEntitlementStatus, string> = {
  inactive: "Inattivo",
  pending_approval: "In approvazione",
  active: "Attivo",
  suspended: "Sospeso",
};

interface TecmaEntitlementsPageProps {
  workspaceId: string;
}

export function TecmaEntitlementsPage({ workspaceId }: TecmaEntitlementsPageProps) {
  const [rows, setRows] = useState<WorkspaceEntitlementEffectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingFeature, setSavingFeature] = useState<WorkspaceEntitlementFeature | null>(null);
  /** Stato persistito da inviare al PATCH (non l’effettivo “implicit”). */
  const [draftStatus, setDraftStatus] = useState<Partial<Record<WorkspaceEntitlementFeature, WorkspaceEntitlementStatus>>>({});
  const [draftNotes, setDraftNotes] = useState<Partial<Record<WorkspaceEntitlementFeature, string>>>({});

  const load = useCallback(async () => {
    if (!workspaceId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await followupApi.getWorkspaceEntitlements(workspaceId);
      const data = res.data ?? [];
      setRows(data);
      const st: Partial<Record<WorkspaceEntitlementFeature, WorkspaceEntitlementStatus>> = {};
      const nt: Partial<Record<WorkspaceEntitlementFeature, string>> = {};
      for (const r of data) {
        st[r.feature] = r.recordedStatus ?? (r.entitled ? "active" : "inactive");
        nt[r.feature] = "";
      }
      setDraftStatus(st);
      setDraftNotes(nt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caricamento fallito");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFeature = async (feature: WorkspaceEntitlementFeature) => {
    const status = draftStatus[feature];
    if (!status) return;
    setSavingFeature(feature);
    setError("");
    try {
      await followupApi.patchWorkspaceEntitlement(workspaceId, feature, {
        status,
        notes: draftNotes[feature]?.trim() || undefined,
        billingMode: "manual_invoice",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSavingFeature(null);
    }
  };

  if (!workspaceId.trim()) {
    return (
      <p className="text-sm text-muted-foreground">Seleziona un workspace dall’header per gestire gli entitlement.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom text-primary" aria-hidden />
          Attiva o sospendi i moduli a consumo per il workspace selezionato nell’header. Le modifiche sono tracciate in audit.
          Assenza di riga in DB equivale a <strong className="text-foreground">attivo</strong> (compatibilità deploy).
        </p>
        <Button variant="outline" size="sm" className="min-h-11 gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Aggiorna
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Modulo</th>
              <th className="px-3 py-2 text-left font-medium">Uso consentito</th>
              <th className="px-3 py-2 text-left font-medium">Implicito</th>
              <th className="px-3 py-2 text-left font-medium">Stato da salvare</th>
              <th className="px-3 py-2 text-left font-medium">Note (opz.)</th>
              <th className="px-3 py-2 text-left font-medium">Azione</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Caricamento…
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 font-medium text-foreground">{FEATURE_LABELS[row.feature]}</td>
                  <td className="px-3 py-3">
                    <span className={row.entitled ? "text-green-700 dark:text-green-400" : "text-amber-800 dark:text-amber-200"}>
                      {row.entitled ? "Sì" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.implicit ? "Sì (nessuna riga)" : "No"}</td>
                  <td className="px-3 py-3">
                    <Select
                      value={draftStatus[row.feature] ?? "active"}
                      onValueChange={(v) =>
                        setDraftStatus((prev) => ({ ...prev, [row.feature]: v as WorkspaceEntitlementStatus }))
                      }
                    >
                      <SelectTrigger className="h-10 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      value={draftNotes[row.feature] ?? ""}
                      onChange={(e) =>
                        setDraftNotes((prev) => ({ ...prev, [row.feature]: e.target.value }))
                      }
                      placeholder="Note interne / fatturazione"
                      className="min-w-[200px]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      className="min-h-11"
                      disabled={savingFeature === row.feature}
                      onClick={() => void saveFeature(row.feature)}
                    >
                      {savingFeature === row.feature ? "Salvataggio…" : "Salva"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
