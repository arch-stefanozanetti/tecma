/**
 * Big Data: funnel CRM per canale (attribuzione) + stato connettori marketing (stub).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type BigDataPayload = {
  projectId?: string;
  dateRange?: { from?: string; to?: string };
  attributionModel?: string;
  definitions?: Record<string, string>;
  crm?: {
    channels?: Array<{
      key?: string;
      utmSource?: string;
      utmCampaign?: string;
      leads?: number;
      withAppointment?: number;
      withProposal?: number;
      sales?: number;
    }>;
    funnelTotals?: {
      leads?: number;
      appointments?: number;
      proposals?: number;
      sales?: number;
    };
    topApartments?: Array<{ apartmentId?: string; apartmentCode?: string; requestCount?: number }>;
  };
  marketing?: {
    googleAds?: { configured?: boolean; error?: string };
    meta?: { configured?: boolean; error?: string };
    ga4?: { configured?: boolean; error?: string };
  };
  reconciliationNotes?: string[];
  cachedAt?: string;
  cacheExpiresAt?: string;
};

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const BigDataPage = () => {
  const { workspaceId, selectedProjectIds } = useWorkspace();
  const [projectId, setProjectId] = useState<string>("");
  const dr = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(dr.from);
  const [dateTo, setDateTo] = useState(dr.to);
  const [attributionModel, setAttributionModel] = useState<"last_touch" | "first_touch">("last_touch");
  const [data, setData] = useState<BigDataPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProjectIds.length > 0 && !projectId) {
      setProjectId(selectedProjectIds[0] ?? "");
    }
  }, [selectedProjectIds, projectId]);

  const load = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const fromIso = `${dateFrom}T00:00:00.000Z`;
      const toIso = `${dateTo}T23:59:59.999Z`;
      const res = await followupApi.getBigDataProject(projectId, {
        workspaceId,
        dateFrom: fromIso,
        dateTo: toIso,
        attributionModel,
      });
      setData((res.data as BigDataPayload) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento Big Data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, dateFrom, dateTo, attributionModel]);

  const totals = data?.crm?.funnelTotals;
  const channels = data?.crm?.channels ?? [];
  const topApt = data?.crm?.topApartments ?? [];

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Big Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Funnel CRM per canale (UTM / click id) e integrazione marketing. I connettori Google Ads / GA4 / Meta sono attivi
          quando configurate le variabili d’ambiente sul backend.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold text-foreground">Definizioni</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{data?.definitions?.lead ?? "Lead = nuovo cliente creato nel periodo."}</li>
            <li>{data?.definitions?.appointment ?? "Appuntamento = evento calendario con cliente nel periodo."}</li>
            <li>{data?.definitions?.proposal ?? "Proposta = trattativa in preventivo/offerta aggiornata nel periodo."}</li>
            <li>{data?.definitions?.sale ?? "Vendita = trattativa vinta (won) aggiornata nel periodo."}</li>
            <li>{data?.definitions?.attribution ?? "Attribuzione: last o first touch salvato sul cliente."}</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Progetto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona progetto" />
              </SelectTrigger>
              <SelectContent>
                {selectedProjectIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Da</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">A</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Modello</label>
            <Select value={attributionModel} onValueChange={(v) => setAttributionModel(v as "last_touch" | "first_touch")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_touch">Last touch</SelectItem>
                <SelectItem value="first_touch">First touch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading || !workspaceId || !projectId}>
            {loading ? "Caricamento…" : "Aggiorna"}
          </Button>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {data && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Lead (nuovi clienti)", value: totals?.leads ?? 0 },
                { label: "Appuntamenti", value: totals?.appointments ?? 0 },
                { label: "Proposte", value: totals?.proposals ?? 0 },
                { label: "Vendite", value: totals?.sales ?? 0 },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Canali (CRM)</h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3">Sorgente</th>
                      <th className="p-3">Campagna</th>
                      <th className="p-3 text-right">Lead</th>
                      <th className="p-3 text-right">Con appuntamento</th>
                      <th className="p-3 text-right">Con proposta</th>
                      <th className="p-3 text-right">Vendite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-muted-foreground">
                          Nessun lead nel periodo con dati di attribuzione.
                        </td>
                      </tr>
                    ) : (
                      channels.map((row) => (
                        <tr key={row.key} className="border-t border-border">
                          <td className="p-3 font-mono text-xs">{row.utmSource}</td>
                          <td className="p-3 font-mono text-xs">{row.utmCampaign}</td>
                          <td className="p-3 text-right tabular-nums">{row.leads}</td>
                          <td className="p-3 text-right tabular-nums">{row.withAppointment}</td>
                          <td className="p-3 text-right tabular-nums">{row.withProposal}</td>
                          <td className="p-3 text-right tabular-nums">{row.sales}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold">Appartamenti più richiesti (trattative)</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {topApt.length === 0 ? (
                  <li>Nessun dato nel periodo.</li>
                ) : (
                  topApt.map((a) => (
                    <li key={a.apartmentId}>
                      <span className="font-mono text-foreground">{a.apartmentCode ?? a.apartmentId}</span> — {a.requestCount}{" "}
                      trattative
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="mt-8 rounded-lg border border-border bg-card/40 p-4">
              <h2 className="text-sm font-semibold">Marketing (stato connettori)</h2>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  Google Ads: {data.marketing?.googleAds?.configured ? "configurato" : "non configurato"}
                  {data.marketing?.googleAds?.error ? ` — ${data.marketing.googleAds.error}` : ""}
                </li>
                <li>
                  Meta: {data.marketing?.meta?.configured ? "configurato" : "non configurato"}
                  {data.marketing?.meta?.error ? ` — ${data.marketing.meta.error}` : ""}
                </li>
                <li>
                  GA4: {data.marketing?.ga4?.configured ? "configurato" : "non configurato"}
                  {data.marketing?.ga4?.error ? ` — ${data.marketing.ga4.error}` : ""}
                </li>
              </ul>
            </div>

            {(data.reconciliationNotes?.length ?? 0) > 0 && (
              <div className="mt-6 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Note</p>
                <ul className="mt-1 list-disc pl-5">
                  {data.reconciliationNotes!.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Cache fino a {data.cacheExpiresAt ? new Date(data.cacheExpiresAt).toLocaleString() : "—"}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
