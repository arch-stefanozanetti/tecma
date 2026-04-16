/**
 * Pagina Report: pipeline, clienti per stato, appartamenti per disponibilità. Export CSV.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { updateSelectedProjectIds, useWorkspace } from "../../auth/projectScope";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DateInput } from "../../components/ui/date-input";
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

const AI_QUERY_TEMPLATES = [
  "Mostrami il funnel commerciale del periodo e il collo di bottiglia principale",
  "Quali sono gli stati clienti in crescita rispetto agli altri?",
  "Dammi un riepilogo KPI con priorita operative immediate",
  "Quali segmenti di appartamenti sono meno performanti?",
];

const PERSONA_REPORT_PRESETS: Record<
  "owner" | "sales_manager" | "agent",
  Array<{ report: ReportType; label: string; description: string }>
> = {
  owner: [
    { report: "kpi_summary", label: "Executive KPI", description: "Panoramica direzionale sintetica" },
    { report: "conversions_per_project", label: "Conversioni per progetto", description: "Confronto performance per progetto" },
    { report: "activity_per_period", label: "Trend attività", description: "Andamento operativo nel tempo" },
  ],
  sales_manager: [
    { report: "pipeline", label: "Pipeline commerciale", description: "Stati, mix e volumi trattative" },
    { report: "clients_by_status", label: "Clienti per stato", description: "Dove il funnel clienti si concentra" },
    { report: "conversions_per_project", label: "Conversioni", description: "Progetti con gap di conversione" },
  ],
  agent: [
    { report: "activity_per_period", label: "Attività operative", description: "Ritmo giornaliero azioni" },
    { report: "avg_times", label: "Tempi medi", description: "Velocità presa in carico/chiusura" },
    { report: "apartments_by_availability", label: "Disponibilità immobili", description: "Stock e distribuzione stato" },
  ],
};

export const ReportsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, selectedProjectIds, projects, hasPermission } = useWorkspace();
  const canUseReports = hasPermission("reports.read");
  const canExportReports = hasPermission("reports.export");
  const [reportType, setReportType] = useState<ReportType>("pipeline");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiTableData, setAiTableData] = useState<Array<Record<string, unknown>>>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<{ lastEventAt: string | null; lagMs: number | null; updatedAt: string | null } | null>(null);
  const [sharedSnapshots, setSharedSnapshots] = useState<
    Array<{ _id: string; query: string; createdAt: string; expiresAt: string; revokedAt: string | null }>
  >([]);
  const [personaView, setPersonaView] = useState<"owner" | "sales_manager" | "agent">("owner");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentTodayAppointments, setAgentTodayAppointments] = useState(0);
  const [agentActiveRequests, setAgentActiveRequests] = useState(0);
  const [agentHotLeads, setAgentHotLeads] = useState(0);
  const [showCriticalityBreakdown, setShowCriticalityBreakdown] = useState(false);
  const [, setScopeBump] = useState(0);
  const [savedDefinitions, setSavedDefinitions] = useState<
    Array<{
      _id: string;
      name: string;
      reportType: string;
      projectIds: string[];
      dateFrom: string | null;
      dateTo: string | null;
    }>
  >([]);
  const [saveFavoriteName, setSaveFavoriteName] = useState("");
  const [savedDefsLoading, setSavedDefsLoading] = useState(false);

  const topStatusFromAi = (() => {
    if (aiTableData.length === 0) return "";
    const row = aiTableData[0] as Record<string, unknown>;
    if (typeof row.status === "string" && row.status.trim().length > 0) return row.status.trim();
    return "";
  })();

  const load = useCallback(async () => {
    if (!workspaceId || selectedProjectIds.length === 0) return;
    setLoading(true);
    setLoadError(null);
    try {
      const useRealtime = !dateFrom && !dateTo;
      const res:
        | { data: Array<Record<string, unknown>>; source?: string; freshness?: { lastEventAt: string | null; lagMs: number | null; updatedAt: string | null } }
        | { data: Array<Record<string, unknown>> } =
        useRealtime && reportType === "kpi_summary"
          ? await followupApi.getRealtimeKpiSummary(workspaceId, selectedProjectIds)
          : useRealtime && reportType === "pipeline"
            ? await followupApi.getRealtimeFunnel(workspaceId, selectedProjectIds)
            : useRealtime && reportType === "clients_by_status"
              ? await followupApi.getRealtimeConversions(workspaceId, selectedProjectIds)
              : await followupApi.runReport(reportType, {
                  workspaceId,
                  projectIds: selectedProjectIds,
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                });
      setData(res.data ?? []);
      if ("freshness" in res && res.freshness) {
        setFreshness(res.freshness);
      } else {
        setFreshness(null);
      }
    } catch (e) {
      const message =
        e instanceof HttpApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Impossibile caricare il report.";
      setLoadError(message);
      setData([]);
      setFreshness(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedProjectIds, reportType, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!workspaceId || selectedProjectIds.length === 0) return;
    const unsubscribe = followupApi.subscribeRealtimeEvents(
      workspaceId,
      { eventTypes: ["metrics.updated"], projectId: selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined },
      () => {
        void load();
      }
    );
    return () => unsubscribe();
  }, [workspaceId, selectedProjectIds, load]);

  useEffect(() => {
    if (!workspaceId) return;
    followupApi
      .listSharedAiReportQueries(workspaceId, 20)
      .then((res) => setSharedSnapshots(res.data ?? []))
      .catch(() => setSharedSnapshots([]));
  }, [workspaceId, shareUrl]);

  useEffect(() => {
    if (!workspaceId || !canUseReports) return;
    setSavedDefsLoading(true);
    followupApi
      .listReportDefinitions(workspaceId)
      .then((res) => setSavedDefinitions(res.data ?? []))
      .catch(() => setSavedDefinitions([]))
      .finally(() => setSavedDefsLoading(false));
  }, [workspaceId, canUseReports]);

  useEffect(() => {
    if (personaView === "owner") {
      setReportType("kpi_summary");
      return;
    }
    if (personaView === "sales_manager") {
      setReportType("pipeline");
      return;
    }
    setReportType("activity_per_period");
  }, [personaView]);

  useEffect(() => {
    if (personaView !== "agent" || !workspaceId || selectedProjectIds.length === 0) return;
    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    let cancelled = false;
    setAgentLoading(true);
    Promise.all([
      followupApi.queryCalendar({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 1,
        searchText: "",
        filters: { dateFrom: from.toISOString(), dateTo: to.toISOString() },
      }),
      followupApi.queryRequests({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 1,
        searchText: "",
        filters: { status: ["new", "in_progress", "qualified"] },
      }),
      followupApi.clients.queryClients({
        workspaceId,
        projectIds: selectedProjectIds,
        page: 1,
        perPage: 1,
        searchText: "",
        filters: { status: ["lead"] },
      }),
    ])
      .then(([calendarRes, requestsRes, leadsRes]) => {
        if (cancelled) return;
        setAgentTodayAppointments(calendarRes.pagination.total ?? 0);
        setAgentActiveRequests(requestsRes.pagination.total ?? 0);
        setAgentHotLeads(leadsRes.pagination.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setAgentTodayAppointments(0);
        setAgentActiveRequests(0);
        setAgentHotLeads(0);
      })
      .finally(() => {
        if (!cancelled) setAgentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaView, workspaceId, selectedProjectIds]);

  const handleAiQuery = async () => {
    if (!workspaceId || selectedProjectIds.length === 0 || !aiQuery.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);
    setShareUrl(null);
    try {
      const res = await followupApi.runAiReportQuery({
        workspaceId,
        projectIds: selectedProjectIds,
        query: aiQuery.trim(),
      });
      setAiAnswer(res.data.answer);
      setAiTableData(res.data.tableData ?? []);
    } catch (error) {
      console.error(error);
      setAiAnswer("Non sono riuscito a elaborare la query AI.");
      setAiTableData([]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleShareAiQuery = async () => {
    if (!workspaceId || selectedProjectIds.length === 0 || !aiQuery.trim()) return;
    try {
      const res = await followupApi.shareAiReportQuery({
        workspaceId,
        projectIds: selectedProjectIds,
        query: aiQuery.trim(),
      });
      const absolute = `${window.location.origin}/r/${res.data.token}`;
      setShareUrl(absolute);
      await navigator.clipboard.writeText(absolute);
    } catch (error) {
      console.error(error);
      setShareUrl("Errore nella creazione del magic link");
    }
  };

  const handleShareSavedDefinition = async (reportDefinitionId: string) => {
    if (!workspaceId) return;
    try {
      const res = await followupApi.shareReportDefinitionSnapshot({ workspaceId, reportDefinitionId });
      const token = res?.data?.token;
      if (!token) {
        setShareUrl("Errore: risposta API senza token.");
        return;
      }
      const absolute = `${window.location.origin}/r/${token}`;
      setShareUrl(absolute);
      try {
        await navigator.clipboard.writeText(absolute);
      } catch {
        /* clipboard non disponibile (es. permessi): l'URL resta mostrato sotto */
      }
    } catch (error) {
      console.error(error);
      const msg =
        error instanceof HttpApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Errore sconosciuto";
      setShareUrl(`Errore link pubblico: ${msg}`);
    }
  };

  const handleRevokeSnapshot = async (snapshotId: string) => {
    if (!workspaceId) return;
    try {
      await followupApi.revokeSharedAiReportQuery(snapshotId, workspaceId);
      const refreshed = await followupApi.listSharedAiReportQueries(workspaceId, 20);
      setSharedSnapshots(refreshed.data ?? []);
    } catch (error) {
      console.error(error);
    }
  };

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

  const refreshSavedDefinitions = () => {
    if (!workspaceId || !canUseReports) return;
    void followupApi.listReportDefinitions(workspaceId).then((res) => setSavedDefinitions(res.data ?? []));
  };

  const applySavedDefinition = (def: (typeof savedDefinitions)[0]) => {
    const rt = def.reportType as ReportType;
    if (REPORT_LABELS[rt]) setReportType(rt);
    setDateFrom(def.dateFrom ? def.dateFrom.slice(0, 10) : "");
    setDateTo(def.dateTo ? def.dateTo.slice(0, 10) : "");
    const valid = new Set(projects.map((p) => p.id));
    const nextIds = def.projectIds.filter((id) => valid.has(id));
    updateSelectedProjectIds(nextIds.length > 0 ? nextIds : selectedProjectIds);
    setScopeBump((n) => n + 1);
  };

  const saveCurrentAsFavorite = async () => {
    if (!workspaceId || selectedProjectIds.length === 0 || !saveFavoriteName.trim()) return;
    try {
      await followupApi.createReportDefinition({
        workspaceId,
        name: saveFavoriteName.trim(),
        reportType,
        projectIds: selectedProjectIds,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setSaveFavoriteName("");
      refreshSavedDefinitions();
    } catch {
      /* toast optional */
    }
  };

  const deleteSavedDefinition = async (id: string) => {
    if (!workspaceId) return;
    try {
      await followupApi.deleteReportDefinition(id, workspaceId);
      refreshSavedDefinitions();
    } catch {
      /* ignore */
    }
  };

  const isKpiSummary = reportType === "kpi_summary";
  const kpiCards = isKpiSummary
    ? data.map((row) => ({
        metric: String(row.metric ?? ""),
        value: Number(row.value ?? 0),
        unit: String(row.unit ?? "count"),
      }))
    : [];
  const kpiMap = Object.fromEntries(kpiCards.map((k) => [k.metric, k]));
  const pipelineRows = reportType === "pipeline" ? data : [];
  const pipelineTotal = pipelineRows.reduce((acc, row) => acc + Number((row as Record<string, unknown>).count ?? 0), 0);

  const pipelineByStatus = (() => {
    if (reportType !== "pipeline") return [] as Array<{ status: string; count: number }>;
    const map = new Map<string, number>();
    for (const row of data) {
      const status = String((row as Record<string, unknown>).status ?? "unknown");
      const count = Number((row as Record<string, unknown>).count ?? 0);
      map.set(status, (map.get(status) ?? 0) + count);
    }
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const pipelineByProject = (() => {
    if (reportType !== "pipeline") return [] as Array<{ projectId: string; count: number }>;
    const map = new Map<string, number>();
    for (const row of data) {
      const projectId = String((row as Record<string, unknown>).projectId ?? "unknown");
      const count = Number((row as Record<string, unknown>).count ?? 0);
      map.set(projectId, (map.get(projectId) ?? 0) + count);
    }
    return Array.from(map.entries())
      .map(([projectId, count]) => ({ projectId, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const pipelineByType = (() => {
    if (reportType !== "pipeline") return [] as Array<{ type: string; count: number }>;
    const map = new Map<string, number>();
    for (const row of data) {
      const type = String((row as Record<string, unknown>).type ?? "unknown");
      const count = Number((row as Record<string, unknown>).count ?? 0);
      map.set(type, (map.get(type) ?? 0) + count);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const statusDistribution =
    reportType === "clients_by_status" || reportType === "apartments_by_availability"
      ? data.map((row) => ({
          status: String((row as Record<string, unknown>).status ?? "unknown"),
          count: Number((row as Record<string, unknown>).count ?? 0),
        }))
      : [];

  const kpiChartData =
    reportType === "kpi_summary"
      ? data.map((row) => ({
          metric: String((row as Record<string, unknown>).metric ?? ""),
          value: Number((row as Record<string, unknown>).value ?? 0),
          unit: String((row as Record<string, unknown>).unit ?? ""),
        }))
      : [];
  const activitySeries =
    reportType === "activity_per_period"
      ? data
          .map((row) => ({
            period: String((row as Record<string, unknown>).period ?? ""),
            count: Number((row as Record<string, unknown>).count ?? 0),
          }))
          .filter((row) => row.period.length > 0)
          .sort((a, b) => a.period.localeCompare(b.period))
      : [];
  const conversionsByProject =
    reportType === "conversions_per_project"
      ? data
          .map((row) => ({
            projectId: String((row as Record<string, unknown>).projectId ?? "unknown"),
            total: Number((row as Record<string, unknown>).total ?? 0),
            won: Number((row as Record<string, unknown>).won ?? 0),
            conversionRate: Number((row as Record<string, unknown>).conversionRate ?? 0),
          }))
          .sort((a, b) => b.conversionRate - a.conversionRate)
      : [];
  const avgTimesData =
    reportType === "avg_times"
      ? data.map((row) => ({
          metric: String((row as Record<string, unknown>).metric ?? "metric"),
          value: Number((row as Record<string, unknown>).value ?? 0),
        }))
      : [];

  const topStatus = pipelineByStatus[0];
  const topProject = pipelineByProject[0];
  const dominantType = pipelineByType[0];
  const statusTotal = statusDistribution.reduce((acc, row) => acc + row.count, 0);
  const topStatusShare =
    statusDistribution.length > 0 && statusTotal > 0
      ? Number(((statusDistribution[0]?.count ?? 0) / statusTotal * 100).toFixed(1))
      : 0;
  const top3Share =
    statusDistribution.length > 0 && statusTotal > 0
      ? Number(
          (statusDistribution.slice(0, 3).reduce((acc, row) => acc + row.count, 0) / statusTotal * 100).toFixed(1)
        )
      : 0;
  const avgKpiValue =
    kpiChartData.length > 0
      ? Number((kpiChartData.reduce((acc, row) => acc + row.value, 0) / kpiChartData.length).toFixed(2))
      : 0;
  const totalActivities = activitySeries.reduce((acc, row) => acc + row.count, 0);
  const peakActivity = activitySeries.reduce(
    (best, row) => (row.count > best.count ? row : best),
    { period: "", count: 0 }
  );
  const topConversionProject = conversionsByProject[0];
  const avgConversionRate =
    conversionsByProject.length > 0
      ? Number((conversionsByProject.reduce((acc, row) => acc + row.conversionRate, 0) / conversionsByProject.length).toFixed(2))
      : 0;
  const avgTimesMap = Object.fromEntries(avgTimesData.map((row) => [row.metric, row.value]));
  const personaAlerts = (() => {
    const alerts: Array<{ level: "warning" | "info"; text: string; action?: () => void; actionLabel?: string }> = [];
    const conversionRate = Number(kpiMap.conversion_rate?.value ?? avgConversionRate ?? 0);
    const pipelineValue = Number(kpiMap.pipeline_value?.value ?? 0);
    const activePipeline = Number(kpiMap.pipeline_funnel?.value ?? pipelineTotal ?? 0);
    const avgDaysToWon = Number(avgTimesMap.avg_days_to_won ?? 0);

    if (personaView === "owner") {
      if (conversionRate > 0 && conversionRate < 10) {
        alerts.push({
          level: "warning",
          text: `Conversione bassa (${conversionRate}%). Verifica pipeline e conversioni per progetto.`,
          action: () => setReportType("conversions_per_project"),
          actionLabel: "Apri conversioni",
        });
      }
      if (pipelineValue <= 0 && activePipeline > 0) {
        alerts.push({
          level: "warning",
          text: "Pipeline attiva senza valore economico valorizzato.",
          action: () => setReportType("kpi_summary"),
          actionLabel: "Apri KPI",
        });
      }
      if (alerts.length === 0) {
        alerts.push({ level: "info", text: "Nessuna anomalia critica rilevata su KPI direzionali." });
      }
      return alerts.slice(0, 3);
    }

    if (personaView === "sales_manager") {
      if (statusDistribution.length > 0 && topStatusShare > 50) {
        alerts.push({
          level: "warning",
          text: `Forte concentrazione su uno stato (${topStatusShare}%). Possibile collo di bottiglia.`,
          action: () => setReportType("pipeline"),
          actionLabel: "Apri pipeline",
        });
      }
      if (conversionsByProject.length > 0 && avgConversionRate < 15) {
        alerts.push({
          level: "warning",
          text: `Conversione media progetti bassa (${avgConversionRate}%).`,
          action: () => setReportType("conversions_per_project"),
          actionLabel: "Apri conversioni",
        });
      }
      if (alerts.length === 0) {
        alerts.push({ level: "info", text: "Trend commerciale stabile nelle viste correnti." });
      }
      return alerts.slice(0, 3);
    }

    if (activitySeries.length > 0 && totalActivities < 5) {
      alerts.push({
        level: "warning",
        text: `Attivita operative ridotte (${totalActivities} nel periodo).`,
        action: () => setReportType("activity_per_period"),
        actionLabel: "Apri attivita",
      });
    }
    if (avgDaysToWon > 30) {
      alerts.push({
        level: "warning",
        text: `Tempo medio a vinto alto (${avgDaysToWon} giorni).`,
        action: () => setReportType("avg_times"),
        actionLabel: "Apri tempi medi",
      });
    }
    if (agentHotLeads > 0) {
      alerts.push({
        level: "info",
        text: `Lead caldi da lavorare: ${agentHotLeads}.`,
        action: () => navigate("/clients", { state: { presetFilters: { status: "lead" } } }),
        actionLabel: "Apri lead",
      });
    }
    if (alerts.length === 0) {
      alerts.push({ level: "info", text: "Operativita sotto controllo per la giornata corrente." });
    }
    return alerts.slice(0, 3);
  })();
  const criticalAlertsCount = personaAlerts.filter((a) => a.level === "warning").length;
  const criticalityIndex = Math.min(100, criticalAlertsCount * 35 + (personaAlerts.length >= 3 ? 10 : 0));
  const criticalityTone =
    criticalityIndex >= 70 ? "text-red-500" : criticalityIndex >= 40 ? "text-amber-500" : "text-emerald-500";
  const criticalityBreakdown = [
    { label: "Warning attivi", points: criticalAlertsCount * 35 },
    { label: "Copertura segnali (3 alert)", points: personaAlerts.length >= 3 ? 10 : 0 },
  ];

  const chartPalette = {
    primary: "hsl(var(--primary))",
    secondary: "hsl(var(--foreground) / 0.7)",
    accent: "hsl(var(--foreground) / 0.45)",
    success: "hsl(142 72% 40%)",
    warning: "hsl(35 92% 50%)",
    danger: "hsl(0 84% 60%)",
    grid: "hsl(var(--border))",
    tick: "hsl(var(--muted-foreground))",
  } as const;

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline, KPI sintetici, clienti per stato, appartamenti per disponibilità.
        </p>
        {canUseReports && workspaceId && (
          <section className="mt-6 rounded-xl border border-border bg-card/40 px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Preferiti salvati</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Salva la combinazione tipo report, progetti e intervallo date per riaprirla con un clic (FASE 4 — definizioni persistite).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 min-w-[12rem]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="report-favorite-name">
                  Nome preferito
                </label>
                <Input
                  id="report-favorite-name"
                  value={saveFavoriteName}
                  onChange={(e) => setSaveFavoriteName(e.target.value)}
                  placeholder="es. KPI mensile — progetto X"
                  className="h-10"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={!saveFavoriteName.trim() || selectedProjectIds.length === 0}
                onClick={() => void saveCurrentAsFavorite()}
              >
                Salva vista corrente
              </Button>
            </div>
            {savedDefsLoading ? (
              <p className="mt-3 text-xs text-muted-foreground">Caricamento preferiti…</p>
            ) : savedDefinitions.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Nessun preferito salvato.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {savedDefinitions.map((def) => (
                  <li
                    key={def._id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{def.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {REPORT_LABELS[def.reportType as ReportType] ?? def.reportType}
                        {def.dateFrom || def.dateTo
                          ? ` · ${def.dateFrom?.slice(0, 10) ?? "…"} → ${def.dateTo?.slice(0, 10) ?? "…"}`
                          : " · senza filtro date"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => applySavedDefinition(def)}>
                        Applica
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        title="Crea uno snapshot read-only dei dati del report e copia il link pubblico"
                        onClick={() => void handleShareSavedDefinition(def._id)}
                      >
                        Link pubblico
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteSavedDefinition(def._id)}>
                        Elimina
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {loadError && (
          <div className="mt-4">
            <Alert
              variant="error"
              title="Caricamento report non riuscito"
              onClose={() => setLoadError(null)}
            >
              {loadError}
            </Alert>
          </div>
        )}
        <div className="mt-4 inline-flex rounded-md border border-border bg-muted/20 p-1">
          <Button
            type="button"
            size="sm"
            variant={personaView === "owner" ? "default" : "ghost"}
            className="min-h-9 px-3"
            onClick={() => setPersonaView("owner")}
          >
            Vista Direzione
          </Button>
          <Button
            type="button"
            size="sm"
            variant={personaView === "sales_manager" ? "default" : "ghost"}
            className="min-h-9 px-3"
            onClick={() => setPersonaView("sales_manager")}
          >
            Vista Sales Manager
          </Button>
          <Button
            type="button"
            size="sm"
            variant={personaView === "agent" ? "default" : "ghost"}
            className="min-h-9 px-3"
            onClick={() => setPersonaView("agent")}
          >
            Vista Operativo
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Pipeline attiva</p>
            <p className="mt-1 text-xl font-semibold">{Number(kpiMap.pipeline_funnel?.value ?? pipelineTotal)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Conversione</p>
            <p className="mt-1 text-xl font-semibold">
              {Number(kpiMap.conversion_rate?.value ?? 0)}
              %
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Valore pipeline</p>
            <p className="mt-1 text-xl font-semibold">
              {Number(kpiMap.pipeline_value?.value ?? 0).toLocaleString("it-IT")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{personaView === "owner" ? "Performance commerciale" : "Performance team"}</p>
            <p className="mt-1 text-xl font-semibold">{Number(kpiMap.agent_performance?.value ?? 0)}</p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">
            {personaView === "owner" ? "Executive focus" : "Sales manager focus"}
          </p>
          {personaView === "owner" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Obiettivo: andamento target, conversione e valore pipeline. Usa i filtri data + query AI per trovare gap e condividere il report.
            </p>
          ) : personaView === "sales_manager" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Obiettivo: capire dove il team perde trattative e intervenire subito. Usa i pulsanti “Vai a Trattative/Clienti (filtrato)” dopo la query AI.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Obiettivo: sapere cosa fare adesso. Focus su appuntamenti del giorno, trattative calde e lead da contattare.
            </p>
          )}
        </div>
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">
            {personaView === "owner"
              ? "Viste Direzione"
              : personaView === "sales_manager"
                ? "Viste Sales Manager"
                : "Viste Operativo"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Selezioni rapide report pensate per la vista corrente: cambiano solo il contenuto, non la UX.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {PERSONA_REPORT_PRESETS[personaView].map((preset) => (
              <button
                key={preset.report}
                type="button"
                onClick={() => setReportType(preset.report)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  reportType === preset.report
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/20 hover:bg-muted/30"
                }`}
              >
                <p className="text-sm font-medium text-foreground">{preset.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Alert operativi</p>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowCriticalityBreakdown((v) => !v)}
            >
              Indice criticita: <span className={`font-semibold ${criticalityTone}`}>{criticalityIndex}/100</span>
              <span className="ml-1 underline">{showCriticalityBreakdown ? "nascondi dettaglio" : "vedi dettaglio"}</span>
            </button>
          </div>
          {showCriticalityBreakdown && (
            <div className="mt-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Breakdown indice</p>
              <div className="mt-1 grid gap-1">
                {criticalityBreakdown.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-foreground">+{row.points}</span>
                  </div>
                ))}
                <div className="mt-1 border-t border-border pt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Totale (max 100)</span>
                  <span className={`font-semibold ${criticalityTone}`}>{criticalityIndex}</span>
                </div>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-2">
            {personaAlerts.map((alert, idx) => (
              <div
                key={`${alert.text}-${idx}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                  alert.level === "warning" ? "border-amber-300/60 bg-amber-500/10" : "border-border bg-muted/20"
                }`}
              >
                <p className="text-xs text-foreground">{alert.text}</p>
                {alert.action && alert.actionLabel && (
                  <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={alert.action}>
                    {alert.actionLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        {personaView === "agent" && (
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">My Day Board</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Appuntamenti oggi</p>
                <p className="mt-1 text-lg font-semibold">{agentLoading ? "..." : agentTodayAppointments}</p>
                <Button variant="outline" className="mt-2 h-8 px-2 text-xs" onClick={() => navigate("/calendar")}>
                  Apri calendario
                </Button>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Trattative attive</p>
                <p className="mt-1 text-lg font-semibold">{agentLoading ? "..." : agentActiveRequests}</p>
                <Button
                  variant="outline"
                  className="mt-2 h-8 px-2 text-xs"
                  onClick={() =>
                    navigate("/requests", {
                      state: { presetFilters: { status: "in_progress" } },
                    })
                  }
                >
                  Apri trattative
                </Button>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Lead da lavorare</p>
                <p className="mt-1 text-lg font-semibold">{agentLoading ? "..." : agentHotLeads}</p>
                <Button
                  variant="outline"
                  className="mt-2 h-8 px-2 text-xs"
                  onClick={() =>
                    navigate("/clients", {
                      state: { presetFilters: { status: "lead" } },
                    })
                  }
                >
                  Apri lead
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="report-type-select" className="block text-xs font-medium text-muted-foreground mb-1">
              Tipo report
            </label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger id="report-type-select" className="min-h-11 w-56">
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
            <DateInput
              aria-label="Report da data"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40 min-w-[10rem]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">A data</label>
            <DateInput
              aria-label="Report a data"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40 min-w-[10rem]"
            />
          </div>
          <Button variant="outline" className="min-h-11" onClick={() => void load()}>Aggiorna</Button>
          <Button
            className="min-h-11"
            onClick={handleExportCsv}
            disabled={data.length === 0 || !canExportReports}
            title={!canExportReports ? "Non hai il permesso di esportare i report" : undefined}
          >
            Export CSV
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground md:hidden">Scorri orizzontalmente per vedere tutte le colonne.</p>
        {freshness && (
          <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Stato realtime: aggiornato{" "}
            <span className="font-medium text-foreground">
              {freshness.updatedAt ? new Date(freshness.updatedAt).toLocaleString() : "n/d"}
            </span>
            {" · "}lag massimo:{" "}
            <span className="font-medium text-foreground">{freshness.lagMs != null ? `${freshness.lagMs} ms` : "n/d"}</span>
          </div>
        )}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Interroga i report con AI</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Usa una domanda in linguaggio naturale. La risposta è pronta per grafici e può essere condivisa con magic link.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Domanda</label>
              <Input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Es: mostrami il funnel commerciale e le anomalie principali"
              />
            </div>
            <Button className="min-h-11" onClick={() => void handleAiQuery()} disabled={aiLoading || !aiQuery.trim()}>
              {aiLoading ? "Elaborazione..." : "Esegui query AI"}
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => void handleShareAiQuery()} disabled={!aiQuery.trim()}>
              Crea magic link
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {AI_QUERY_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setAiQuery(template)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/30"
              >
                {template}
              </button>
            ))}
          </div>
          {aiAnswer && <p className="mt-3 text-sm text-foreground">{aiAnswer}</p>}
          {aiAnswer && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-10"
                onClick={() =>
                  navigate("/requests", {
                    state: {
                      presetFilters: {
                        ...(topStatusFromAi ? { status: topStatusFromAi } : {}),
                        searchText: aiQuery.trim(),
                      },
                    },
                  })
                }
              >
                Vai a Trattative (filtrato)
              </Button>
              <Button
                variant="outline"
                className="min-h-10"
                onClick={() =>
                  navigate("/clients", {
                    state: {
                      presetFilters: {
                        ...(topStatusFromAi ? { status: topStatusFromAi } : {}),
                        searchText: aiQuery.trim(),
                      },
                    },
                  })
                }
              >
                Vai a Clienti (filtrato)
              </Button>
            </div>
          )}
          {shareUrl && <p className="mt-2 break-all text-xs text-muted-foreground">Link condivisibile: {shareUrl}</p>}
          {aiTableData.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {Object.keys(aiTableData[0] as Record<string, unknown>).map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-medium capitalize">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aiTableData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      {Object.values(row as Record<string, unknown>).map((v, j) => (
                        <td key={j} className="px-4 py-2">
                          {String(v ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Link condivisi recenti</p>
          {sharedSnapshots.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nessun link condiviso disponibile.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left text-xs font-medium">Query</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Creato</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Scadenza</th>
                    <th className="px-3 py-2 text-left text-xs font-medium">Stato</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedSnapshots.map((row) => (
                    <tr key={row._id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-xs text-foreground">{row.query}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(row.expiresAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.revokedAt ? (
                          <span className="text-destructive">Revocato</span>
                        ) : (
                          <span className="text-emerald-600">Attivo</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!row.revokedAt && (
                          <Button variant="outline" className="h-8 px-2 text-xs" onClick={() => void handleRevokeSnapshot(row._id)}>
                            Revoca
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-1 overflow-x-auto rounded-lg border border-border">
          {!loading && data.length > 0 && (
            <div className="border-b border-border bg-muted/10 p-4">
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {reportType === "pipeline" && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Stato dominante</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {topStatus?.status ?? "n/d"}{" "}
                        <span className="text-sm font-normal text-muted-foreground">({topStatus?.count ?? 0})</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Progetto dominante</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {topProject?.projectId ?? "n/d"}{" "}
                        <span className="text-sm font-normal text-muted-foreground">({topProject?.count ?? 0})</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Tipo dominante</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {dominantType?.type ?? "n/d"}{" "}
                        <span className="text-sm font-normal text-muted-foreground">({dominantType?.count ?? 0})</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Totale pipeline</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{pipelineTotal}</p>
                    </div>
                  </>
                )}
                {(reportType === "clients_by_status" || reportType === "apartments_by_availability") && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Totale elementi</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{statusTotal}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Numero stati</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{statusDistribution.length}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Peso top stato</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{topStatusShare}%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Concentrazione top 3</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{top3Share}%</p>
                    </div>
                  </>
                )}
                {reportType === "kpi_summary" && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Media KPI (valore)</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{avgKpiValue}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Conversione (KPI)</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{Number(kpiMap.conversion_rate?.value ?? 0)}%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Pipeline value (KPI)</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {Number(kpiMap.pipeline_value?.value ?? 0).toLocaleString("it-IT")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Performance (KPI)</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{Number(kpiMap.agent_performance?.value ?? 0)}</p>
                    </div>
                  </>
                )}
                {reportType === "activity_per_period" && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Attivita totali</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{totalActivities}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Picco giornaliero</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{peakActivity.count}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Giorno picco</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{peakActivity.period || "n/d"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Media giornaliera</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {activitySeries.length > 0 ? Number((totalActivities / activitySeries.length).toFixed(2)) : 0}
                      </p>
                    </div>
                  </>
                )}
                {reportType === "conversions_per_project" && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Progetti monitorati</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{conversionsByProject.length}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Miglior conversione</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{topConversionProject?.conversionRate ?? 0}%</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Top progetto</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{topConversionProject?.projectId ?? "n/d"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Conversione media</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{avgConversionRate}%</p>
                    </div>
                  </>
                )}
                {reportType === "avg_times" && (
                  <>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Tempo medio a vinto</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{Number(avgTimesMap.avg_days_to_won ?? 0)} gg</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Tempo medio ultimo update</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{Number(avgTimesMap.avg_days_to_update ?? 0)} gg</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Gap update-vinto</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {Number(((avgTimesMap.avg_days_to_update ?? 0) - (avgTimesMap.avg_days_to_won ?? 0)).toFixed(2))} gg
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">Metriche temporali</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{avgTimesData.length}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
              {reportType === "pipeline" && (
                <>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Pipeline per stato
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Pipeline per progetto
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mix vendita / affitto
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Distribuzione per stato
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Ranking stato (line)
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      KPI confronto valori
                    </p>
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
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      KPI trend comparativo (line)
                    </p>
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
            </div>
          )}
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
