import crypto from "node:crypto";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import {
  runApartmentsByAvailabilityReport,
  runClientsByStatusReport,
  runKpiSummaryReport,
  runPipelineReport,
  runReport,
} from "./reports.service.js";
import { getReportDefinitionById } from "./report-definitions.service.js";
import { HttpError } from "../../types/http.js";
import { publishRealtimeEvent } from "../realtime/realtime-bus.service.js";
import { REALTIME_PAYLOAD_VERSION } from "../realtime/realtime-events.js";
import { recordSecurityEvent } from "../compliance/security-audit.service.js";

type SupportedRealtimeReport = "pipeline" | "clients_by_status" | "apartments_by_availability" | "kpi_summary";

const MetricsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
});

const AiQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  query: z.string().min(3),
});

const ShareSnapshotSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  query: z.string().min(3),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

const ShareDefinitionSchema = z.object({
  workspaceId: z.string().min(1),
  reportDefinitionId: z.string().min(1),
  expiresInHours: z.number().int().min(1).max(168).optional(),
});

const ListSnapshotsSchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

type RealtimeMetricDoc = {
  workspaceId: string;
  projectId: string;
  reportType: SupportedRealtimeReport;
  data: Array<Record<string, unknown>>;
  updatedAt: string;
};

type RealtimeFreshnessDoc = {
  workspaceId: string;
  projectId: string;
  lastEventAt: string;
  lagMs: number;
  updatedAt: string;
};

const METRICS_COLLECTION = "tz_metrics_realtime";
const FRESHNESS_COLLECTION = "tz_metrics_freshness";
const SNAPSHOT_COLLECTION = "tz_report_snapshots";

const emitMetricsUpdated = (workspaceId: string, projectId: string, reportType: string): void => {
  publishRealtimeEvent({
    eventType: "metrics.updated",
    entityId: projectId,
    workspaceId,
    projectId,
    actorId: null,
    timestamp: new Date().toISOString(),
    payloadVersion: REALTIME_PAYLOAD_VERSION,
    payload: { reportType },
  });
};

async function persistRealtimeReport(
  workspaceId: string,
  projectId: string,
  reportType: SupportedRealtimeReport,
  data: Array<Record<string, unknown>>
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.collection<RealtimeMetricDoc>(METRICS_COLLECTION).updateOne(
    { workspaceId, projectId, reportType },
    { $set: { workspaceId, projectId, reportType, data, updatedAt: now } },
    { upsert: true }
  );
  await db.collection<RealtimeFreshnessDoc>(FRESHNESS_COLLECTION).updateOne(
    { workspaceId, projectId },
    {
      $set: {
        workspaceId,
        projectId,
        lastEventAt: now,
        lagMs: 0,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  emitMetricsUpdated(workspaceId, projectId, reportType);
}

export async function recomputeRealtimeMetricsForProject(
  workspaceId: string,
  projectId: string
): Promise<void> {
  const input = { workspaceId, projectIds: [projectId] };
  const [pipeline, clientsByStatus, apartmentsByAvailability, kpiSummary] = await Promise.all([
    runPipelineReport(input),
    runClientsByStatusReport(input),
    runApartmentsByAvailabilityReport(input),
    runKpiSummaryReport(input),
  ]);
  await Promise.all([
    persistRealtimeReport(workspaceId, projectId, "pipeline", pipeline.data.map((row) => ({ ...row }))),
    persistRealtimeReport(workspaceId, projectId, "clients_by_status", clientsByStatus.data.map((row) => ({ ...row }))),
    persistRealtimeReport(
      workspaceId,
      projectId,
      "apartments_by_availability",
      apartmentsByAvailability.data.map((row) => ({ ...row }))
    ),
    persistRealtimeReport(workspaceId, projectId, "kpi_summary", kpiSummary.data.map((row) => ({ ...row }))),
  ]);
}

function mergeRowsByKey(
  rows: Array<Record<string, unknown>>,
  keyBuilder: (row: Record<string, unknown>) => string
): Array<Record<string, unknown>> {
  const agg = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = keyBuilder(row);
    const previous = agg.get(key);
    if (!previous) {
      agg.set(key, { ...row });
      continue;
    }
    const count = Number(previous.count ?? 0) + Number(row.count ?? 0);
    agg.set(key, { ...previous, count });
  }
  return Array.from(agg.values());
}

async function getProjectReportFromReadModel(
  workspaceId: string,
  projectId: string,
  reportType: SupportedRealtimeReport
): Promise<Array<Record<string, unknown>>> {
  const db = getDb();
  const doc = await db.collection<RealtimeMetricDoc>(METRICS_COLLECTION).findOne({
    workspaceId,
    projectId,
    reportType,
  });
  if (!doc) {
    await recomputeRealtimeMetricsForProject(workspaceId, projectId);
    const recomputed = await db.collection<RealtimeMetricDoc>(METRICS_COLLECTION).findOne({
      workspaceId,
      projectId,
      reportType,
    });
    return recomputed?.data ?? [];
  }
  return Array.isArray(doc.data) ? doc.data : [];
}

export async function getRealtimeReport(
  reportType: SupportedRealtimeReport,
  rawInput: unknown
): Promise<{
  data: Array<Record<string, unknown>>;
  source: "read_model" | "legacy_fallback_multi_project";
  freshness: { lastEventAt: string | null; lagMs: number | null; updatedAt: string | null };
}> {
  const input = MetricsQuerySchema.parse(rawInput);
  const freshnessRows = await getDb()
    .collection<RealtimeFreshnessDoc>(FRESHNESS_COLLECTION)
    .find({ workspaceId: input.workspaceId, projectId: { $in: input.projectIds } })
    .toArray();
  const freshness = {
    lastEventAt:
      freshnessRows.length > 0
        ? freshnessRows
            .map((row) => row.lastEventAt)
            .sort()
            .at(-1) ?? null
        : null,
    lagMs:
      freshnessRows.length > 0
        ? Math.max(...freshnessRows.map((row) => Number(row.lagMs ?? 0)))
        : null,
    updatedAt:
      freshnessRows.length > 0
        ? freshnessRows
            .map((row) => row.updatedAt)
            .sort()
            .at(-1) ?? null
        : null,
  };
  if (input.projectIds.length > 1 && reportType === "kpi_summary") {
    const fallback = await runKpiSummaryReport(input);
    return { data: fallback.data.map((row) => ({ ...row })), source: "legacy_fallback_multi_project", freshness };
  }

  const perProject = await Promise.all(
    input.projectIds.map((projectId) => getProjectReportFromReadModel(input.workspaceId, projectId, reportType))
  );
  const rows = perProject.flat();
  if (reportType === "pipeline") {
    return {
      data: mergeRowsByKey(rows, (r) => `${String(r.status ?? "")}:${String(r.type ?? "")}:${String(r.projectId ?? "")}`),
      source: "read_model",
      freshness,
    };
  }
  if (reportType === "clients_by_status" || reportType === "apartments_by_availability") {
    return {
      data: mergeRowsByKey(rows, (r) => String(r.status ?? "unknown")),
      source: "read_model",
      freshness,
    };
  }
  if (reportType === "kpi_summary") {
    const byMetric = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const metric = String(row.metric ?? "");
      const previous = byMetric.get(metric);
      if (!previous) {
        byMetric.set(metric, { ...row });
        continue;
      }
      const value = Number(previous.value ?? 0) + Number(row.value ?? 0);
      byMetric.set(metric, { ...previous, value });
    }
    return { data: Array.from(byMetric.values()), source: "read_model", freshness };
  }
  return { data: [], source: "read_model", freshness };
}

function detectDslIntent(query: string): { reportType: SupportedRealtimeReport; title: string } {
  const q = query.toLowerCase();
  if (q.includes("funnel") || q.includes("pipeline")) {
    return { reportType: "pipeline", title: "Funnel CRM" };
  }
  if (q.includes("client") || q.includes("lead")) {
    return { reportType: "clients_by_status", title: "Clienti per stato" };
  }
  if (q.includes("appart") || q.includes("unit")) {
    return { reportType: "apartments_by_availability", title: "Appartamenti per disponibilità" };
  }
  return { reportType: "kpi_summary", title: "KPI summary" };
}

export async function runAiRealtimeQuery(rawInput: unknown): Promise<{
  data: {
    answer: string;
    dsl: Record<string, unknown>;
    chartSpec: Record<string, unknown>;
    tableData: Array<Record<string, unknown>>;
  };
}> {
  const input = AiQuerySchema.parse(rawInput);
  const intent = detectDslIntent(input.query);
  const result = await getRealtimeReport(intent.reportType, {
    workspaceId: input.workspaceId,
    projectIds: input.projectIds,
  });
  const chartSpec = {
    chartType: intent.reportType === "kpi_summary" ? "cards" : "bar",
    xKey: intent.reportType === "pipeline" ? "status" : "metric",
    yKey: intent.reportType === "kpi_summary" ? "value" : "count",
    title: intent.title,
  };

  return {
    data: {
      answer: `Ho interpretato la richiesta come '${intent.title}' e ho letto il read-model realtime (${result.source}).`,
      dsl: {
        intent: intent.reportType,
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
      },
      chartSpec,
      tableData: result.data,
    },
  };
}

const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw, "utf8").digest("hex");

export async function createReportSnapshot(rawInput: unknown): Promise<{ data: { token: string; url: string; expiresAt: string; snapshotId: string } }> {
  const input = ShareSnapshotSchema.parse(rawInput);
  const aiResult = await runAiRealtimeQuery({
    workspaceId: input.workspaceId,
    projectIds: input.projectIds,
    query: input.query,
  });
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000).toISOString();
  const inserted = await getDb()
    .collection(SNAPSHOT_COLLECTION)
    .insertOne({
      tokenHash,
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      query: input.query,
      response: aiResult.data,
      snapshotKind: "ai",
      createdAt: new Date().toISOString(),
      expiresAt,
      revokedAt: null,
    });

  return {
    data: {
      token,
      url: `/v1/public/reports/${token}`,
      expiresAt,
      snapshotId: inserted.insertedId.toHexString(),
    },
  };
}

/**
 * Snapshot read-only da un preferito salvato (report deterministico, senza LLM).
 */
export async function createReportDefinitionSnapshot(
  rawInput: unknown
): Promise<{ data: { token: string; url: string; expiresAt: string; snapshotId: string } }> {
  const input = ShareDefinitionSchema.parse(rawInput);
  const def = await getReportDefinitionById(input.reportDefinitionId, input.workspaceId);
  if (!def) throw new HttpError("Report definition not found", 404);

  const reportBody: Record<string, unknown> = {
    workspaceId: def.workspaceId,
    projectIds: def.projectIds,
  };
  if (def.dateFrom) reportBody.dateFrom = def.dateFrom;
  if (def.dateTo) reportBody.dateTo = def.dateTo;

  const reportResult = await runReport(def.reportType, reportBody);
  const tableData = Array.isArray(reportResult.data) ? reportResult.data : [];

  const responsePayload: Record<string, unknown> = {
    kind: "definition",
    reportType: def.reportType,
    definitionName: def.name,
    tableData,
    answer: `Snapshot del preferito «${def.name}» (${def.reportType}).`,
  };

  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000).toISOString();
  const inserted = await getDb()
    .collection(SNAPSHOT_COLLECTION)
    .insertOne({
      tokenHash,
      workspaceId: def.workspaceId,
      projectIds: def.projectIds,
      query: def.name,
      response: responsePayload,
      snapshotKind: "definition",
      reportDefinitionId: def._id,
      createdAt: new Date().toISOString(),
      expiresAt,
      revokedAt: null,
    });

  return {
    data: {
      token,
      url: `/v1/public/reports/${token}`,
      expiresAt,
      snapshotId: inserted.insertedId.toHexString(),
    },
  };
}

export async function getReportSnapshotByToken(
  token: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ data: Record<string, unknown> }> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const doc = await getDb()
    .collection(SNAPSHOT_COLLECTION)
    .findOne({ tokenHash, expiresAt: { $gt: now }, revokedAt: null });
  if (!doc) {
    return { data: { found: false } };
  }
  const snapshotId = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "");
  void recordSecurityEvent({
    action: "security.report_snapshot.accessed",
    entityType: "report_snapshot",
    entityId: snapshotId,
    workspaceId: typeof doc.workspaceId === "string" ? doc.workspaceId : undefined,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return {
    data: {
      found: true,
      workspaceId: doc.workspaceId,
      projectIds: doc.projectIds,
      query: doc.query,
      response: doc.response,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    },
  };
}

export async function listReportSnapshots(rawInput: unknown): Promise<{ data: Array<Record<string, unknown>> }> {
  const input = ListSnapshotsSchema.parse(rawInput);
  const rows = await getDb()
    .collection(SNAPSHOT_COLLECTION)
    .find({ workspaceId: input.workspaceId })
    .sort({ createdAt: -1 })
    .limit(input.limit ?? 20)
    .project({
      tokenHash: 0,
      response: 0,
    })
    .toArray();
  return {
    data: rows.map((row) => ({
      _id: String(row._id ?? ""),
      workspaceId: row.workspaceId,
      projectIds: row.projectIds,
      query: row.query,
      snapshotKind: typeof row.snapshotKind === "string" ? row.snapshotKind : "ai",
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
    })),
  };
}

export async function revokeReportSnapshot(snapshotId: string, workspaceId: string): Promise<{ data: { revoked: boolean } }> {
  if (!ObjectId.isValid(snapshotId)) return { data: { revoked: false } };
  const result = await getDb().collection(SNAPSHOT_COLLECTION).updateOne(
    { _id: new ObjectId(snapshotId), workspaceId },
    { $set: { revokedAt: new Date().toISOString() } }
  );
  return { data: { revoked: result.modifiedCount > 0 } };
}

const pendingRecompute = new Map<string, NodeJS.Timeout>();

async function recomputeAndRefresh(workspaceId: string, projectId: string): Promise<void> {
  try {
    await recomputeRealtimeMetricsForProject(workspaceId, projectId);
  } catch (error) {
    logger.warn({ error, workspaceId, projectId }, "[realtime-reports] recompute failed");
  }
}

export function scheduleRealtimeRecompute(workspaceId: string, projectId: string, debounceMs = 350): void {
  const key = `${workspaceId}:${projectId}`;
  const existing = pendingRecompute.get(key);
  if (existing) clearTimeout(existing);
  pendingRecompute.set(
    key,
    setTimeout(() => {
      pendingRecompute.delete(key);
      void recomputeAndRefresh(workspaceId, projectId);
    }, debounceMs)
  );
}

export function startRealtimeMetricsProjector(): void {
  const db = getDb();
  const watchedCollections = ["tz_clients", "tz_requests", "tz_apartments", "calendar_events", "tz_property_view_events"];
  const stream = db.watch(
    [
      {
        $match: {
          operationType: { $in: ["insert", "update", "replace", "delete"] },
          "ns.coll": { $in: watchedCollections },
        },
      },
    ],
    { fullDocument: "updateLookup" }
  );

  stream.on("change", (change) => {
    const fullDoc =
      "fullDocument" in change && change.fullDocument && typeof change.fullDocument === "object"
        ? (change.fullDocument as { workspaceId?: string; projectId?: string })
        : {};
    const workspaceId = String(fullDoc.workspaceId ?? "");
    const projectId = String(fullDoc.projectId ?? "");
    if (!workspaceId || !projectId) return;
    scheduleRealtimeRecompute(workspaceId, projectId);
  });

  stream.on("error", (error) => {
    logger.warn({ error }, "[realtime-reports] projector stream disabled (mongo change stream unavailable)");
  });
}
