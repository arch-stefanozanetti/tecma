/**
 * Dashboard sintetica ricavi affitto: MRR stimato, trattative chiuse nel periodo, pipeline aperta.
 * Dati aggregati lato server (nessuna query libera su DB dal browser).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { useWorkspace } from "../../auth/projectScope";
import { projectIsRentContext, isPriceAvailabilityRelevant } from "../features";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { DateInput } from "../../components/ui/date-input";

function eur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export const RentRevenuePage = () => {
  const { workspaceId, selectedProjectIds, projects, hasPermission } = useWorkspace();
  const canRead = hasPermission("reports.read");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState("Quanto stiamo facendo di ricavi affitti nel periodo?");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof followupApi.getRentRevenueSummary>>["data"] | null>(
    null
  );

  const rentProjectIds = useMemo(
    () =>
      selectedProjectIds.filter((id) => {
        const p = projects.find((x) => x.id === id);
        return p ? projectIsRentContext(p) : false;
      }),
    [selectedProjectIds, projects]
  );

  const scopeOk = isPriceAvailabilityRelevant(projects, selectedProjectIds);

  const load = useCallback(async () => {
    if (!workspaceId || selectedProjectIds.length === 0) return;
    const projectIds = rentProjectIds.length > 0 ? rentProjectIds : selectedProjectIds;
    setLoading(true);
    setError(null);
    try {
      const res = await followupApi.getRentRevenueSummary({
        workspaceId,
        projectIds,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setSummary(res.data ?? null);
      setAiAnswer(null);
      setAiError(null);
    } catch (e) {
      const msg =
        e instanceof HttpApiError ? e.message : e instanceof Error ? e.message : "Impossibile caricare i ricavi affitto.";
      setError(msg);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedProjectIds, rentProjectIds, dateFrom, dateTo]);

  const reloadKey = `${workspaceId}|${selectedProjectIds.join(",")}|${rentProjectIds.join(",")}|${dateFrom}|${dateTo}`;

  useEffect(() => {
    if (!canRead || !workspaceId || selectedProjectIds.length === 0) return;
    void load();
    // reloadKey consente di evitare dipendenze instabili su array; load resta allineato ai campi nel reloadKey
  }, [canRead, reloadKey, load]);

  if (!canRead) {
    return (
      <Alert variant="error" title="Accesso negato" className="mt-4">
        Permesso <code className="text-xs">reports.read</code> richiesto per visualizzare i ricavi affitto.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ricavi affitti</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Vista economica V2: trattative affitto vinte con importi da quote (fallback richiesta) + MRR stimato da
          canoni mensili correnti sulle unità locate.
        </p>
      </div>

      {!scopeOk && (
        <Alert variant="warning" title="Contesto progetti">
          Nessun progetto in contesto affitto tra quelli selezionati. Estendi il filtro progetti oppure apri un
          progetto rent: i numeri sotto potrebbero essere incompleti.
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="rr-from">
            Da
          </label>
          <DateInput id="rr-from" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="rr-to">
            A
          </label>
          <DateInput id="rr-to" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Caricamento…" : "Aggiorna"}
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Errore caricamento" className="whitespace-pre-wrap">
          {error}
        </Alert>
      )}

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">MRR stimato</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{eur(summary.estimatedMrr)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Somma canoni mensili attuali su unità in stato locato</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trattative chiuse (periodo)</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{eur(summary.periodWonDealsValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.periodWonDealsCount} affari · importo quote/valore trattativa
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cumulato fino a periodo</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{eur(summary.cumulativeWonDealsValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.cumulativeWonDealsCount} affari vinti totali</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline affitti aperta</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{eur(summary.openRentPipelineValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.openRentPipelineDeals} trattative non chiuse</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unità rent / locate</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {summary.rentUnitsRented}
                <span className="text-base font-normal text-muted-foreground"> / {summary.rentUnitsListed}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Locate vs annunciate in modalità affitto</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-1 text-sm font-medium">Scenario canoni (MRR × mesi nel periodo)</p>
            <p className="text-2xl font-semibold tabular-nums">{eur(summary.theoreticalPeriodCanoni)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.monthsInPeriod} mesi nel periodo · riferimento canoni alla data {summary.asOf.slice(0, 10)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Andamento mensile</p>
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={summary.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "wonDealsValue") return [eur(value), "Valore chiuso"];
                      if (name === "estimatedMrr") return [eur(value), "MRR stimato"];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="wonDealsValue" name="Valore chiuso" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="estimatedMrr"
                    name="MRR stimato"
                    stroke="hsl(142 72% 40%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium">AI read-only su dataset ricavi</p>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Es. Quanto abbiamo fatto di cumulato quest'anno?"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={aiLoading || aiQuery.trim().length === 0}
                onClick={async () => {
                  if (!workspaceId || selectedProjectIds.length === 0) return;
                  const projectIds = rentProjectIds.length > 0 ? rentProjectIds : selectedProjectIds;
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const res = await followupApi.runRentRevenueAiQuery({
                      workspaceId,
                      projectIds,
                      query: aiQuery.trim(),
                      dateFrom: dateFrom || undefined,
                      dateTo: dateTo || undefined,
                    });
                    setAiAnswer(res.data.answer);
                  } catch (e) {
                    const msg =
                      e instanceof HttpApiError
                        ? e.message
                        : e instanceof Error
                          ? e.message
                          : "Errore durante l'interrogazione AI.";
                    setAiError(msg);
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                {aiLoading ? "Analizzo…" : "Chiedi all'AI"}
              </Button>
            </div>
            {aiError && <p className="mt-2 text-xs text-destructive">{aiError}</p>}
            {aiAnswer && <p className="mt-3 text-sm text-foreground">{aiAnswer}</p>}
          </div>

          <Alert
            variant={
              summary.dataQuality.wonDealsWithoutQuoteLink > 0 ||
              summary.dataQuality.wonDealsWithoutAmount > 0 ||
              summary.dataQuality.wonDealsWithoutEffectiveDate > 0
                ? "warning"
                : "info"
            }
            title="Qualità dati (spike V2)"
          >
            <p className="text-xs text-muted-foreground">
              Won senza quote collegate: {summary.dataQuality.wonDealsWithoutQuoteLink} ·
              senza importo: {summary.dataQuality.wonDealsWithoutAmount} ·
              senza data effetto: {summary.dataQuality.wonDealsWithoutEffectiveDate}
            </p>
            {summary.dataQuality.notes.map((note) => (
              <p key={note} className="mt-1 text-xs text-muted-foreground">
                - {note}
              </p>
            ))}
          </Alert>

          <Alert variant="info" title="Metodologia">
            <p className="text-xs text-muted-foreground">{summary.methodology}</p>
            <p className="mt-2 text-xs text-muted-foreground">Calcolo server: {summary.computedAt}</p>
          </Alert>
        </>
      )}
    </div>
  );
};
