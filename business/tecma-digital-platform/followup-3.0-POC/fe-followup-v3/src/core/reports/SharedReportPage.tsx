import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { AppBarChart } from "../../components/charts/AppBarChart";
import { AppLineChart } from "../../components/charts/AppLineChart";
import { KpiCards } from "../../components/charts/KpiCards";
import { normalizeChartData } from "../../components/charts/chartData";

type SharedResponse = {
  found: boolean;
  query?: string;
  response?: {
    kind?: string;
    definitionName?: string;
    reportType?: string;
    answer?: string;
    tableData?: Array<Record<string, unknown>>;
    chartSpec?: Record<string, unknown>;
  };
  expiresAt?: string;
};

function tokenFromPath(pathname: string, param?: string): string | undefined {
  if (param && param.length > 0) return param;
  const m = pathname.match(/\/r\/([^/?#]+)/);
  return m?.[1];
}

export const SharedReportPage = () => {
  const { pathname } = useLocation();
  const { token: tokenParam } = useParams<{ token: string }>();
  const token = tokenFromPath(pathname, tokenParam);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharedResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setData({ found: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    followupApi
      .getSharedAiReportQuery(token)
      .then((res) => setData(res.data))
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const tableData = useMemo(() => data?.response?.tableData ?? [], [data?.response?.tableData]);
  const headers = useMemo(
    () => (tableData.length > 0 ? Object.keys(tableData[0] as Record<string, unknown>) : []),
    [tableData]
  );
  const chartType = String(data?.response?.chartSpec?.chartType ?? "");
  const chartData = useMemo(() => normalizeChartData(tableData, data?.response?.chartSpec), [tableData, data?.response?.chartSpec]);
  const cardsData = useMemo(() => {
    if (tableData.length === 0) return [];
    return tableData
      .map((row) => {
        const metric = String((row as Record<string, unknown>).metric ?? "");
        const value = Number((row as Record<string, unknown>).value ?? 0);
        const unit = String((row as Record<string, unknown>).unit ?? "");
        return { metric, value, unit };
      })
      .filter((row) => row.metric.length > 0);
  }, [tableData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app p-6 text-sm text-muted-foreground">
        Caricamento report condiviso...
      </div>
    );
  }

  if (!data?.found) {
    return (
      <div className="min-h-screen bg-app p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-5">
          <h1 className="text-xl font-semibold text-foreground">Link non valido o scaduto</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Questo magic link non e' piu' disponibile. Richiedi una nuova condivisione dalla pagina Report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h1 className="text-xl font-semibold text-foreground">Report condiviso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.response?.kind === "definition" ? (
              <>
                Preferito salvato:{" "}
                <span className="font-medium text-foreground">{data.response.definitionName ?? data.query ?? "-"}</span>
                {data.response.reportType ? (
                  <span className="text-muted-foreground"> ({String(data.response.reportType)})</span>
                ) : null}
              </>
            ) : (
              <>
                Query: <span className="font-medium text-foreground">{data.query ?? "-"}</span>
              </>
            )}
          </p>
          {data.expiresAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Scadenza link: {new Date(data.expiresAt).toLocaleString()}
            </p>
          )}
          {data.response?.answer && (
            <p className="mt-3 text-sm text-foreground">{data.response.answer}</p>
          )}
          {data.response?.chartSpec && (
            <p className="mt-2 text-xs text-muted-foreground">
              Grafico suggerito: {String(data.response.chartSpec.chartType ?? "n/d")}
            </p>
          )}
          <div className="mt-3">
            <Button variant="outline" onClick={() => window.print()}>
              Stampa pagina
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          {chartType === "cards" && cardsData.length > 0 && (
            <KpiCards rows={cardsData} />
          )}
          {chartType === "bar" && chartData.length > 0 && <AppBarChart data={chartData} />}
          {chartType === "line" && chartData.length > 0 && <AppLineChart data={chartData} />}
          {tableData.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nessun dato tabellare disponibile.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium capitalize">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {headers.map((h) => (
                      <td key={h} className="px-4 py-2">
                        {String((row as Record<string, unknown>)[h] ?? "-")}
                      </td>
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
