import crypto from "node:crypto";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";
import { createOperationalAlert } from "../ops/operational-alerts.service.js";

const MAPPINGS_COLLECTION = "tz_mls_portal_mappings";
const RUNS_COLLECTION = "tz_mls_feed_runs";

const nowIso = (): string => new Date().toISOString();

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const makeApiKey = (): string => crypto.randomBytes(20).toString("hex");

export const upsertMlsPortalMapping = async (input: {
  workspaceId: string;
  projectId: string;
  portal: "immobiliare_it" | "idealista";
  titlePrefix?: string;
  listingBaseUrl?: string;
}): Promise<{ portal: string; apiKeyMasked: string; apiKey: string }> => {
  const db = getDb();
  const apiKey = makeApiKey();
  const now = nowIso();
  await db.collection(MAPPINGS_COLLECTION).updateOne(
    { workspaceId: input.workspaceId, projectId: input.projectId, portal: input.portal },
    {
      $set: {
        titlePrefix: input.titlePrefix ?? "",
        listingBaseUrl: input.listingBaseUrl ?? "",
        apiKeyHash: crypto.createHash("sha256").update(apiKey, "utf8").digest("hex"),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return {
    portal: input.portal,
    apiKey,
    apiKeyMasked: `${apiKey.slice(0, 5)}...${apiKey.slice(-4)}`,
  };
};

const resolveMapping = async (workspaceId: string, projectId: string, apiKey: string) => {
  const db = getDb();
  const apiKeyHash = crypto.createHash("sha256").update(apiKey, "utf8").digest("hex");
  return db.collection(MAPPINGS_COLLECTION).findOne({ workspaceId, projectId, apiKeyHash });
};

export const generateMlsFeedXml = async (input: {
  workspaceId: string;
  projectId: string;
  apiKey: string;
}): Promise<string> => {
  const db = getDb();
  const mapping = await resolveMapping(input.workspaceId, input.projectId, input.apiKey);
  if (!mapping) throw new HttpError("Invalid MLS API key", 401);

  const apartments = await db
    .collection("tz_apartments")
    .find({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      status: "AVAILABLE",
    })
    .toArray();

  const listingBaseUrl = typeof mapping.listingBaseUrl === "string" ? mapping.listingBaseUrl : "";
  const prefix = typeof mapping.titlePrefix === "string" ? mapping.titlePrefix : "";

  const rows = apartments.map((apartment) => {
    const id = typeof apartment._id === "object" && apartment._id != null && "toHexString" in apartment._id
      ? (apartment._id as { toHexString: () => string }).toHexString()
      : String(apartment._id ?? "");
    const title = `${prefix ? `${prefix} ` : ""}${String(apartment.name ?? "Unità")}`.trim();
    const code = String(apartment.code ?? id);
    const priceAmount =
      apartment && typeof apartment === "object" && apartment.rawPrice && typeof apartment.rawPrice === "object"
        ? Number((apartment.rawPrice as Record<string, unknown>).amount ?? 0)
        : 0;
    const url = listingBaseUrl ? `${listingBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(id)}` : "";
    return `
    <property>
      <id>${escapeXml(id)}</id>
      <code>${escapeXml(code)}</code>
      <title>${escapeXml(title)}</title>
      <type>${escapeXml(String(apartment.mode ?? "SELL").toLowerCase())}</type>
      <price>${Number.isFinite(priceAmount) ? priceAmount : 0}</price>
      <surface_mq>${Number(apartment.surfaceMq ?? 0)}</surface_mq>
      <status>${escapeXml(String(apartment.status ?? "AVAILABLE"))}</status>
      <url>${escapeXml(url)}</url>
      <updated_at>${escapeXml(String(apartment.updatedAt ?? nowIso()))}</updated_at>
    </property>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mls_feed portal="${escapeXml(String(mapping.portal ?? "unknown"))}" workspace_id="${escapeXml(input.workspaceId)}" project_id="${escapeXml(input.projectId)}" generated_at="${escapeXml(nowIso())}">
  <properties>${rows.join("\n")}
  </properties>
</mls_feed>`;

  await db.collection(RUNS_COLLECTION).insertOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    portal: mapping.portal,
    generatedAt: nowIso(),
    status: "ok",
    listingCount: apartments.length,
  });
  return xml;
};

export const runMlsReconciliation = async (workspaceId: string): Promise<{ ok: boolean; checked: number; issues: number }> => {
  const db = getDb();
  const mappings = await db.collection(MAPPINGS_COLLECTION).find({ workspaceId }).toArray();
  let issues = 0;
  for (const mapping of mappings) {
    const projectId = String(mapping.projectId ?? "");
    const latestRun = await db.collection(RUNS_COLLECTION).find({ workspaceId, projectId }).sort({ generatedAt: -1 }).limit(1).next();
    if (!latestRun) {
      issues += 1;
      await db.collection(RUNS_COLLECTION).insertOne({
        workspaceId,
        projectId,
        portal: mapping.portal,
        generatedAt: nowIso(),
        status: "desync",
        issue: "missing_feed_generation",
      });
      continue;
    }
    const lastGenerated = typeof latestRun.generatedAt === "string" ? new Date(latestRun.generatedAt).getTime() : 0;
    if (!lastGenerated || Date.now() - lastGenerated > 1000 * 60 * 60 * 6) {
      issues += 1;
      await db.collection(RUNS_COLLECTION).insertOne({
        workspaceId,
        projectId,
        portal: mapping.portal,
        generatedAt: nowIso(),
        status: "desync",
        issue: "stale_feed",
      });
    }
  }
  if (issues > 0) {
    logger.warn({ workspaceId, issues }, "[mls] reconciliation found issues");
    await createOperationalAlert({
      workspaceId,
      source: "mls.reconciliation",
      severity: issues > 5 ? "critical" : "warning",
      title: "MLS reconciliation issues detected",
      message: `Rilevate ${issues} issue di desync MLS.`,
      payload: { issues },
    });
  }
  return { ok: true, checked: mappings.length, issues };
};

export const runGlobalMlsReconciliation = async (): Promise<{ workspaces: number; issues: number }> => {
  const db = getDb();
  const workspaceIds = await db.collection(MAPPINGS_COLLECTION).distinct("workspaceId");
  let issues = 0;
  for (const workspaceId of workspaceIds) {
    const result = await runMlsReconciliation(String(workspaceId));
    issues += result.issues;
  }
  return { workspaces: workspaceIds.length, issues };
};
