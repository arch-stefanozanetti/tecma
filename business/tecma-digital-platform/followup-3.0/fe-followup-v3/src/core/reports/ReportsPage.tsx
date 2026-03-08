/**
 * Pagina Report: pipeline, clienti per stato, appartamenti per disponibilità. Export CSV.
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

type ReportType = "pipeline" | "clients_by_status" | "apartments_by_availability";

const REPORT_LABELS: Record<ReportType, string> = {
  pipeline: "Pipeline vendita/affitto",
  clients_by_status: "Clienti per stato",
  apartments_by_availability: "Appartamenti per disponibilità",
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

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline, clienti per stato, appartamenti per disponibilità.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo report</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm w-56"
            >
              {(Object.keys(REPORT_LABELS) as ReportType[]).map((t) => (
                <option key={t} value={t}>{REPORT_LABELS[t]}</option>
              ))}
            </select>
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
