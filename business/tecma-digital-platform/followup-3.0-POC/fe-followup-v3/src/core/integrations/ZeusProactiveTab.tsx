import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Alert } from "../../components/ui/alert";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";

type OppRow = {
  id: string;
  clientId: string;
  projectId: string;
  triggerType: "lead_silent" | "hot_lead";
  score: number;
  status: string;
  suggestedSubject: string | null;
  suggestedBody: string;
  createdAt: string;
};

function triggerLabel(t: OppRow["triggerType"]): string {
  if (t === "hot_lead") return "Lead caldo (richieste recenti)";
  return "Lead silenzioso";
}

export function ZeusProactiveTab({ workspaceId, readOnly = false }: { workspaceId: string; readOnly?: boolean }) {
  const { toastSuccess, toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [silentDays, setSilentDays] = useState(10);
  const [hotDays, setHotDays] = useState(14);
  const [hotMin, setHotMin] = useState(2);
  const [maxPerWeek, setMaxPerWeek] = useState(2);
  const [minScore, setMinScore] = useState(35);
  const [opps, setOpps] = useState<OppRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback((): Promise<void> => {
    if (!workspaceId) return Promise.resolve();
    setLoading(true);
    return Promise.all([
      followupApi.getZeusProactiveConfig(workspaceId),
      followupApi.listZeusProactiveOpportunities(workspaceId, { status: "pending_review", limit: 50 })
    ])
      .then(([cfg, list]) => {
        const c = cfg.data;
        setEnabled(c.enabled);
        setSilentDays(c.silentDaysThreshold);
        setHotDays(c.hotLeadRequestDays);
        setHotMin(c.hotLeadMinRequests);
        setMaxPerWeek(c.maxMessagesPerWeekPerLead);
        setMinScore(c.minScoreToCreate);
        setOpps((list.data ?? []) as OppRow[]);
      })
      .catch(() => {
        toastError("Impossibile caricare Proactive Sales");
      })
      .finally(() => setLoading(false));
  }, [workspaceId, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (readOnly) return;
    setSaving(true);
    followupApi
      .patchZeusProactiveConfig(workspaceId, {
        enabled,
        silentDaysThreshold: silentDays,
        hotLeadRequestDays: hotDays,
        hotLeadMinRequests: hotMin,
        maxMessagesPerWeekPerLead: maxPerWeek,
        minScoreToCreate: minScore,
        mode: "suggestion"
      })
      .then(() => toastSuccess("Configurazione Proactive salvata"))
      .catch(() => toastError("Salvataggio fallito"))
      .finally(() => setSaving(false));
  };

  const runScan = (manual: boolean) => {
    if (readOnly) return;
    setScanning(true);
    followupApi
      .runZeusProactiveScan(workspaceId, manual ? { manual: true } : undefined)
      .then((r) => {
        toastSuccess(`Scansione: ${r.data.created} nuove, ${r.data.skipped} saltate (${r.data.evaluated} clienti valutati)`);
        return load();
      })
      .catch(() => toastError("Scansione fallita (collega progetti al workspace e verifica clienti/richieste)"))
      .finally(() => setScanning(false));
  };

  const dismiss = (id: string) => {
    if (readOnly) return;
    setBusyId(id);
    followupApi
      .dismissZeusProactiveOpportunity(workspaceId, id)
      .then(() => {
        toastSuccess("Ignorata");
        void load();
      })
      .catch(() => toastError("Operazione fallita"))
      .finally(() => setBusyId(null));
  };

  const sendEmail = (id: string) => {
    if (readOnly) return;
    setBusyId(id);
    followupApi
      .sendZeusProactiveOpportunity(workspaceId, id, { channel: "email" })
      .then(() => {
        toastSuccess("Email inviata");
        void load();
      })
      .catch(() => toastError("Invio fallito (email cliente o SMTP)"))
      .finally(() => setBusyId(null));
  };

  const regenerate = (id: string) => {
    if (readOnly) return;
    setBusyId(id);
    followupApi
      .regenerateZeusProactiveOpportunity(workspaceId, id)
      .then(() => {
        toastSuccess("Testo rigenerato");
        void load();
      })
      .catch(() => toastError("Rigenerazione fallita"))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Alert variant="info" title="Proactive Sales (seconda anima di ZEUS)">
        <span className="text-sm">
          Suggerisce contatti quando un lead è silenzioso o mostra forte interesse (richieste multiple). Le proposte restano in
          coda per approvazione umana prima dell&apos;invio email (usa la stessa pipeline SMTP delle altre email).
        </span>
      </Alert>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-sm font-medium">Motore e limiti</h3>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} disabled={readOnly} />
              Abilita scansione automatica (anche dal job-runner se <code className="rounded bg-muted px-1">PROACTIVE_SALES_JOB_ENABLED=true</code>)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Giorni senza aggiornamento → &quot;lead silenzioso&quot;</label>
                <Input
                  type="number"
                  min={3}
                  max={90}
                  value={silentDays}
                  onChange={(e) => setSilentDays(parseInt(e.target.value, 10) || 10)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Finestra richieste (giorni) per hot lead</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={hotDays}
                  onChange={(e) => setHotDays(parseInt(e.target.value, 10) || 14)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Min. richieste nella finestra → hot lead</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={hotMin}
                  onChange={(e) => setHotMin(parseInt(e.target.value, 10) || 2)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max messaggi proactive / lead / settimana</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxPerWeek}
                  onChange={(e) => setMaxPerWeek(parseInt(e.target.value, 10) || 2)}
                  disabled={readOnly}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Score minimo per creare opportunità (0–100)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(parseInt(e.target.value, 10) || 35)}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={readOnly || saving}>
                Salva
              </Button>
              <Button type="button" variant="secondary" onClick={() => runScan(true)} disabled={readOnly || scanning}>
                <Zap className="h-4 w-4 mr-1" />
                {scanning ? "Scansione…" : "Esegui scansione ora"}
              </Button>
              {!enabled ? (
                <span className="text-xs text-muted-foreground self-center">
                  Motore disattivato per il cron; la scansione manuale funziona comunque.
                </span>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Aggiorna lista
              </Button>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium mb-2">In coda (revisione umana)</h3>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-2 font-medium">Creato</th>
                    <th className="p-2 font-medium">Trigger</th>
                    <th className="p-2 font-medium">Score</th>
                    <th className="p-2 font-medium">Anteprima</th>
                    <th className="p-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {opps.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-muted-foreground text-center">
                        Nessuna opportunità in attesa. Abilita il motore ed esegui una scansione.
                      </td>
                    </tr>
                  ) : (
                    opps.map((row) => (
                      <tr key={row.id} className="border-b border-border/80 align-top">
                        <td className="p-2 whitespace-nowrap text-xs">{row.createdAt}</td>
                        <td className="p-2 text-xs">{triggerLabel(row.triggerType)}</td>
                        <td className="p-2">{row.score}</td>
                        <td className="p-2 max-w-md">
                          <div className="text-xs font-medium text-foreground">{row.suggestedSubject ?? "—"}</div>
                          <div className="text-xs text-muted-foreground line-clamp-3">{row.suggestedBody}</div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              disabled={readOnly || busyId === row.id}
                              onClick={() => sendEmail(row.id)}
                            >
                              Invia email
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={readOnly || busyId === row.id}
                              onClick={() => regenerate(row.id)}
                            >
                              Rigenera
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={readOnly || busyId === row.id}
                              onClick={() => dismiss(row.id)}
                            >
                              Ignora
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
