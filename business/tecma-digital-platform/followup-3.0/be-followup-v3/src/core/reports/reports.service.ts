/**
 * Reportistica: aggregazioni MongoDB per pipeline, clienti, appartamenti.
 * Solo main DB (test-zanetti).
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const ReportInputSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ReportType =
  | "pipeline"
  | "clients_by_status"
  | "apartments_by_availability"
  | "kpi_summary"
  | "activity_per_period"
  | "conversions_per_project"
  | "avg_times";

export interface PipelineRow {
  status: string;
  type: string;
  projectId: string;
  count: number;
}

export interface ClientsByStatusRow {
  status: string;
  count: number;
}

export interface ApartmentsByAvailabilityRow {
  status: string;
  count: number;
}

export interface KpiSummaryRow {
  metric: "pipeline_funnel" | "conversion_rate" | "agent_performance" | "pipeline_value" | "apartments_by_status";
  value: number;
  unit: "count" | "percent" | "currency";
}

export interface ActivityPerPeriodRow {
  period: string;
  count: number;
}

export interface ConversionsPerProjectRow {
  projectId: string;
  total: number;
  won: number;
  conversionRate: number;
}

export interface AvgTimesRow {
  metric: "avg_days_to_won" | "avg_days_to_update";
  value: number;
  unit: "days";
}

const buildDateFilter = (dateFrom?: string, dateTo?: string): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    filter.updatedAt = {};
    if (dateFrom) (filter.updatedAt as Record<string, unknown>).$gte = dateFrom;
    if (dateTo) (filter.updatedAt as Record<string, unknown>).$lte = dateTo;
  }
  return filter;
};

/** Pipeline vendita/affitto: requests per status, progetto, tipo. */
export const runPipelineReport = async (rawInput: unknown): Promise<{ data: PipelineRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_requests");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const pipeline = [
    { $match: match },
    { $group: { _id: { status: "$status", type: "$type", projectId: "$projectId" }, count: { $sum: 1 } } },
    { $sort: { "_id.status": 1, "_id.type": 1 } },
  ];

  const docs = await coll.aggregate(pipeline).toArray();
  const data: PipelineRow[] = docs.map((d: { _id?: { status?: string; type?: string; projectId?: string }; count?: number }) => ({
    status: d._id?.status ?? "",
    type: d._id?.type ?? "",
    projectId: d._id?.projectId ?? "",
    count: d.count ?? 0,
  }));

  return { data };
};

/** Clienti per stato: count per status. */
export const runClientsByStatusReport = async (rawInput: unknown): Promise<{ data: ClientsByStatusRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_clients");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const pipeline = [
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];

  const docs = await coll.aggregate(pipeline).toArray();
  const data: ClientsByStatusRow[] = docs.map((d: { _id?: string; count?: number }) => ({
    status: d._id ?? "unknown",
    count: d.count ?? 0,
  }));

  return { data };
};

/** Appartamenti per disponibilità: count per status. */
export const runApartmentsByAvailabilityReport = async (rawInput: unknown): Promise<{ data: ApartmentsByAvailabilityRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_apartments");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const pipeline = [
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];

  const docs = await coll.aggregate(pipeline).toArray();
  const data: ApartmentsByAvailabilityRow[] = docs.map((d: { _id?: string; count?: number }) => ({
    status: d._id ?? "unknown",
    count: d.count ?? 0,
  }));

  return { data };
};

/** KPI sintetici operativi (5 metriche minime) */
export const runKpiSummaryReport = async (rawInput: unknown): Promise<{ data: KpiSummaryRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const requestMatch: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(requestMatch, buildDateFilter(input.dateFrom, input.dateTo));

  const [requestsAgg, apartmentsAgg] = await Promise.all([
    db.collection("tz_requests").aggregate([
      { $match: requestMatch },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          wonRequests: {
            $sum: {
              $cond: [{ $in: ["$status", ["won", "closed_won", "venduto", "locato"]] }, 1, 0],
            },
          },
          activePipeline: {
            $sum: {
              $cond: [{ $in: ["$status", ["new", "in_progress", "qualified", "quote", "visit", "negotiation"]] }, 1, 0],
            },
          },
          pipelineValue: { $sum: { $ifNull: ["$budgetMax", { $ifNull: ["$budget", 0] }] } },
        },
      },
    ]).toArray(),
    db.collection("tz_apartments").aggregate([
      {
        $match: {
          workspaceId: input.workspaceId,
          projectId: { $in: input.projectIds },
          ...buildDateFilter(input.dateFrom, input.dateTo),
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const reqMetrics = requestsAgg[0] as { totalRequests?: number; wonRequests?: number; activePipeline?: number; pipelineValue?: number } | undefined;
  const totalRequests = reqMetrics?.totalRequests ?? 0;
  const wonRequests = reqMetrics?.wonRequests ?? 0;
  const activePipeline = reqMetrics?.activePipeline ?? 0;
  const pipelineValue = reqMetrics?.pipelineValue ?? 0;
  const apartmentsTotal = apartmentsAgg.reduce((acc, row) => acc + (Number((row as { count?: number }).count) || 0), 0);

  const data: KpiSummaryRow[] = [
    { metric: "pipeline_funnel", value: activePipeline, unit: "count" },
    { metric: "conversion_rate", value: totalRequests > 0 ? Number(((wonRequests / totalRequests) * 100).toFixed(2)) : 0, unit: "percent" },
    { metric: "agent_performance", value: wonRequests, unit: "count" },
    { metric: "pipeline_value", value: Number(pipelineValue.toFixed(2)), unit: "currency" },
    { metric: "apartments_by_status", value: apartmentsTotal, unit: "count" },
  ];
  return { data };
};

/** Attivita per periodo: numero richieste aggiornate per giorno. */
export const runActivityPerPeriodReport = async (rawInput: unknown): Promise<{ data: ActivityPerPeriodRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_requests");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        period: {
          $cond: [
            { $eq: [{ $type: "$updatedAt" }, "date"] },
            { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
            { $substrBytes: [{ $toString: "$updatedAt" }, 0, 10] },
          ],
        },
      },
    },
    { $group: { _id: "$period", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];

  const docs = await coll.aggregate(pipeline).toArray();
  const data: ActivityPerPeriodRow[] = docs.map((d: { _id?: string; count?: number }) => ({
    period: d._id ?? "unknown",
    count: Number(d.count ?? 0),
  }));

  return { data };
};

/** Conversioni per progetto: totale, vinte e tasso conversione. */
export const runConversionsPerProjectReport = async (rawInput: unknown): Promise<{ data: ConversionsPerProjectRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_requests");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$projectId",
        total: { $sum: 1 },
        won: {
          $sum: {
            $cond: [{ $in: ["$status", ["won", "closed_won", "venduto", "locato"]] }, 1, 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const docs = await coll.aggregate(pipeline).toArray();
  const data: ConversionsPerProjectRow[] = docs.map((d: { _id?: string; total?: number; won?: number }) => {
    const total = Number(d.total ?? 0);
    const won = Number(d.won ?? 0);
    return {
      projectId: d._id ?? "unknown",
      total,
      won,
      conversionRate: total > 0 ? Number(((won / total) * 100).toFixed(2)) : 0,
    };
  });

  return { data };
};

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
};

/** Tempi medi: giorni medi creazione->chiusura vinta e creazione->ultimo update. */
export const runAvgTimesReport = async (rawInput: unknown): Promise<{ data: AvgTimesRow[] }> => {
  const input = ReportInputSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection("tz_requests");

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds },
  };
  Object.assign(match, buildDateFilter(input.dateFrom, input.dateTo));

  const docs = await coll
    .find(match, { projection: { createdAt: 1, updatedAt: 1, status: 1 } })
    .toArray() as Array<{ createdAt?: unknown; updatedAt?: unknown; status?: string }>;

  let wonSumDays = 0;
  let wonCount = 0;
  let updateSumDays = 0;
  let updateCount = 0;

  for (const doc of docs) {
    const createdAt = parseDate(doc.createdAt);
    const updatedAt = parseDate(doc.updatedAt);
    if (!createdAt || !updatedAt) continue;
    const diffMs = updatedAt.getTime() - createdAt.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) continue;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    updateSumDays += diffDays;
    updateCount += 1;

    const status = String(doc.status ?? "").toLowerCase();
    if (status === "won" || status === "closed_won" || status === "venduto" || status === "locato") {
      wonSumDays += diffDays;
      wonCount += 1;
    }
  }

  const data: AvgTimesRow[] = [
    { metric: "avg_days_to_won", value: wonCount > 0 ? Number((wonSumDays / wonCount).toFixed(2)) : 0, unit: "days" },
    { metric: "avg_days_to_update", value: updateCount > 0 ? Number((updateSumDays / updateCount).toFixed(2)) : 0, unit: "days" },
  ];

  return { data };
};

export const runReport = async (reportType: string, rawInput: unknown) => {
  switch (reportType) {
    case "pipeline":
      return runPipelineReport(rawInput);
    case "clients_by_status":
      return runClientsByStatusReport(rawInput);
    case "apartments_by_availability":
      return runApartmentsByAvailabilityReport(rawInput);
    case "kpi_summary":
      return runKpiSummaryReport(rawInput);
    case "activity_per_period":
      return runActivityPerPeriodReport(rawInput);
    case "conversions_per_project":
      return runConversionsPerProjectReport(rawInput);
    case "avg_times":
      return runAvgTimesReport(rawInput);
    default:
      throw new HttpError(`Unknown report type: ${reportType}`, 400);
  }
};
