import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ReportType =
  | "pipeline"
  | "clients_by_status"
  | "apartments_by_availability"
  | "kpi_summary"
  | "activity_per_period"
  | "conversions_per_project"
  | "avg_times";

type PipelineRow = { status: string; count: number };
type PipelineProjectRow = { projectId: string; count: number };
type PipelineTypeRow = { type: string; count: number };
type StatusDistributionRow = { status: string; count: number };
type KpiChartRow = { metric: string; value: number; unit: string };
type ActivityRow = { period: string; count: number };
type ConversionRow = { projectId: string; total: number; won: number; conversionRate: number };
type AvgTimesRow = { metric: string; value: number };

const chartPalette = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--foreground) / 0.7)",
  success: "hsl(142 72% 40%)",
  warning: "hsl(35 92% 50%)",
  danger: "hsl(0 84% 60%)",
  grid: "hsl(var(--border))",
  tick: "hsl(var(--muted-foreground))",
} as const;

export function ReportsChartsSection({
  reportType,
  pipelineByStatus,
  pipelineByProject,
  pipelineByType,
  statusDistribution,
  kpiChartData,
  activitySeries,
  conversionsByProject,
  avgTimesData,
}: {
  reportType: ReportType;
  pipelineByStatus: PipelineRow[];
  pipelineByProject: PipelineProjectRow[];
  pipelineByType: PipelineTypeRow[];
  statusDistribution: StatusDistributionRow[];
  kpiChartData: KpiChartRow[];
  activitySeries: ActivityRow[];
  conversionsByProject: ConversionRow[];
  avgTimesData: AvgTimesRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {reportType === "pipeline" && (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline per stato</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineByStatus}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={chartPalette.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline per progetto</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineByProject}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="projectId" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={chartPalette.secondary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 lg:col-span-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mix vendita / affitto</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pipelineByType}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke={chartPalette.warning} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {(reportType === "clients_by_status" || reportType === "apartments_by_availability") && (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Distribuzione per stato</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={chartPalette.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ranking stato (line)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statusDistribution}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="status" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={chartPalette.success} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {reportType === "kpi_summary" && (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">KPI confronto valori</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiChartData}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={chartPalette.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">KPI trend comparativo (line)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpiChartData}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke={chartPalette.danger} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {reportType === "activity_per_period" && (
        <div className="rounded-lg border border-border bg-card p-3 lg:col-span-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trend attivita per periodo</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activitySeries}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={chartPalette.primary} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {reportType === "conversions_per_project" && (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversione per progetto (%)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionsByProject}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="projectId" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="conversionRate" fill={chartPalette.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Volumi totale vs vinte</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionsByProject}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="projectId" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill={chartPalette.secondary} />
                  <Bar dataKey="won" fill={chartPalette.success} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {reportType === "avg_times" && (
        <div className="rounded-lg border border-border bg-card p-3 lg:col-span-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tempi medi operativi (giorni)</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgTimesData}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis dataKey="metric" tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={chartPalette.warning} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
