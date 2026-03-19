/**
 * Pagina Report: pipeline, clienti per stato, appartamenti per disponibilità. Export CSV.
 */
import { useCallback, useEffect, useState } from "react";
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

type ReportType =
  | "pipeline"
  | "clients_by_status"
  | "apartments_by_availability"
  | "kpi_summary"
  | "activity_per_period"
  | "conversions_per_project"
  | "avg_times";

const REPORT_LABELS: Record<ReportType, string> = {
  pipeline: "Pipeline vendita/affitto",
  clients_by_status: "Clienti per stato",
  apartments_by_availability: "Appartamenti per disponibilità",
  kpi_summary: "KPI sintetici (5 metriche core)",
  activity_per_period: "Attività per periodo",
  conversions_per_project: "Conversioni per progetto",
  avg_times: "Tempi medi (giorni a vinto)",
};

export const ReportsPage = () => {
  const { workspaceId, selectedProjectIds } = useWorkspace();
  const [reportType, setReportType] = useState<ReportType>("pipeline");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId || selectedProjectIds.length === 0) return;
    setLoading(true);
    try {
      const res = await followupApi.runReport(reportType, {
        workspaceId,
        projectIds: selectedProjectIds,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(res.data ?? []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedProjectIds, reportType, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportCsv = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((r) => headers.map((h) => String((r as Record<string, unknown>)[h] ?? "")));
    const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isKpiSummary = reportType === "kpi_summary";
  const kpiCards = isKpiSummary
    ? data.map((row) => ({
        metric: String(row.metric ?? ""),
        value: Number(row.value ?? 0),
        unit: String(row.unit ?? "count"),
      }))
    : [];

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline, KPI sintetici, clienti per stato, appartamenti per disponibilità.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo report</label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="h-10 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                  <SelectItem key={t} value={t}>{REPORT_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Da data</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">A data</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          </div>
          <Button variant="outline" onClick={() => void load()}>Aggiorna</Button>
          <Button onClick={handleExportCsv} disabled={data.length === 0}>Export CSV</Button>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          {isKpiSummary && kpiCards.length > 0 && (
            <div className="grid gap-3 border-b border-border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-5">
              {kpiCards.map((kpi) => (
                <div key={kpi.metric} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.metric.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-xl font-semibold">
                    {kpi.value}
                    {kpi.unit === "percent" ? "%" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Caricamento…</div>
          ) : data.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nessun dato.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {Object.keys(data[0] as Record<string, unknown>).map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium capitalize">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    {Object.values(row as Record<string, unknown>).map((v, j) => (
                      <td key={j} className="px-4 py-2">{String(v ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
