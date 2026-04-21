import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { listWorkspaceProjects } from "../workspaces/workspaces.service.js";
import { countOutreachInWindow } from "./proactive-outreach-log.service.js";
import { generateProactiveMessage } from "./proactive-message.service.js";
import { getProactiveSalesConfig } from "./proactive-sales-config.service.js";
import {
  upsertPendingOpportunityForClient,
  type ProactiveTriggerType
} from "./proactive-opportunities.service.js";
import { namesFromDoc } from "../clients/client-name.util.js";

export interface ProactiveScanResult {
  created: number;
  skipped: number;
  evaluated: number;
}

function buildFacts(
  clientDoc: Record<string, unknown>,
  silenceDays: number,
  requestCount: number,
  trigger: ProactiveTriggerType
): Record<string, unknown> {
  const nm = namesFromDoc(clientDoc);
  return {
    clientName: nm.fullName,
    trigger,
    silenceDays,
    requestCountInWindow: requestCount,
    clientStatus: typeof clientDoc.status === "string" ? clientDoc.status : undefined,
    city: typeof clientDoc.city === "string" ? clientDoc.city : undefined,
    projectId: String(clientDoc.projectId ?? "")
  };
}

/**
 * Scansiona clienti del workspace (progetti associati) e crea opportunità in coda revisione umana.
 * `manualTrigger`: da UI / test anche se `enabled` è false (il job schedulato non lo usa).
 */
export async function runProactiveSalesScan(
  workspaceId: string,
  opts?: { manualTrigger?: boolean }
): Promise<ProactiveScanResult> {
  const config = await getProactiveSalesConfig(workspaceId);
  if (!config.enabled && !opts?.manualTrigger) {
    return { created: 0, skipped: 0, evaluated: 0 };
  }

  const projects = await listWorkspaceProjects(workspaceId);
  const projectIds = projects.map((p) => p.projectId).filter(Boolean);
  if (projectIds.length === 0) {
    logger.info({ workspaceId }, "[proactive-sales] no projects linked to workspace");
    return { created: 0, skipped: 0, evaluated: 0 };
  }

  const db = getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const hotSince = new Date(Date.now() - config.hotLeadRequestDays * 24 * 60 * 60 * 1000).toISOString();

  const clients = await db
    .collection("tz_clients")
    .find({ workspaceId, projectId: { $in: projectIds } })
    .limit(500)
    .toArray();

  let created = 0;
  let skipped = 0;
  let evaluated = 0;

  for (const c of clients) {
    evaluated += 1;
    const clientId = String(c._id);
    const projectId = String(c.projectId ?? "");

    const outreachCount = await countOutreachInWindow(workspaceId, clientId, weekAgo);
    if (outreachCount >= config.maxMessagesPerWeekPerLead) {
      skipped += 1;
      continue;
    }

    const existingPending = await db.collection("tz_proactive_opportunities").findOne({
      workspaceId,
      clientId,
      status: "pending_review"
    });
    if (existingPending) {
      skipped += 1;
      continue;
    }

    const updatedAtRaw = c.updatedAt ?? c.createdAt;
    const updatedAt =
      typeof updatedAtRaw === "string"
        ? updatedAtRaw
        : updatedAtRaw instanceof Date
          ? updatedAtRaw.toISOString()
          : new Date().toISOString();
    const silenceMs = Date.now() - new Date(updatedAt).getTime();
    const silenceDays = Math.max(0, Math.floor(silenceMs / (24 * 60 * 60 * 1000)));

    const requestCount = await db.collection("tz_requests").countDocuments({
      workspaceId,
      clientId,
      updatedAt: { $gte: hotSince }
    });

    type Cand = { trigger: ProactiveTriggerType; score: number };
    const candidates: Cand[] = [];

    if (silenceDays >= config.silentDaysThreshold) {
      candidates.push({ trigger: "lead_silent", score: 40 + Math.min(50, silenceDays * 2) });
    }
    if (requestCount >= config.hotLeadMinRequests) {
      candidates.push({ trigger: "hot_lead", score: 50 + Math.min(40, requestCount * 8) });
    }

    if (candidates.length === 0) {
      skipped += 1;
      continue;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    if (best.score < config.minScoreToCreate) {
      skipped += 1;
      continue;
    }

    const facts = buildFacts(c as Record<string, unknown>, silenceDays, requestCount, best.trigger);
    const gen = await generateProactiveMessage({ workspaceId, channel: "email", facts });
    const now = new Date().toISOString();

    await upsertPendingOpportunityForClient({
      workspaceId,
      clientId,
      projectId,
      triggerType: best.trigger,
      score: best.score,
      status: "pending_review",
      facts,
      suggestedSubject: gen.subject,
      suggestedBody: gen.body,
      createdAt: now,
      updatedAt: now
    });
    created += 1;
  }

  return { created, skipped, evaluated };
}

/** Job schedulato: tutti i workspace con Proactive abilitato. */
export async function runProactiveSalesScanAllEnabledWorkspaces(): Promise<void> {
  const db = getDb();
  const configs = await db.collection("tz_proactive_sales_config").find({ enabled: true }).toArray();
  for (const row of configs) {
    const wid = String(row.workspaceId ?? "").trim();
    if (!wid) continue;
    try {
      const r = await runProactiveSalesScan(wid);
      logger.info({ workspaceId: wid, ...r }, "[proactive-sales] scan");
    } catch (err) {
      logger.error({ err, workspaceId: wid }, "[proactive-sales] scan failed");
    }
  }
}
