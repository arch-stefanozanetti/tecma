import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { emitDomainEvent } from "../events/event-log.service.js";
import { getWorkspaceAiConfigInternal, isWorkspaceAiConfigured } from "../workspaces/workspace-ai-config.service.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";
import { ENV } from "../../config/env.js";
import {
  refineSuggestionsWithLlm,
  type RuleBasedSuggestionRow,
  type SuggestionAggregatedItem
} from "./suggestions-llm.service.js";

/** Max gruppi (macro-card) per generazione Cockpit */
export const MAX_SUGGESTION_GROUPS = 8;
/** Max elementi serializzati per gruppo in Mongo */
export const MAX_AGGREGATED_ITEMS_STORED = 50;

const SuggestionsInputSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  limit: z.number().int().min(1).max(50).default(20)
});

const ApprovalInputSchema = z.object({
  suggestionId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  actorEmail: z.string().email(),
  note: z.string().optional().default("")
});

type SuggestionDoc = {
  _id: ObjectId;
  workspaceId: string;
  projectIds: string[];
  title: string;
  reason: string;
  recommendedAction: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  status: "pending" | "approved" | "rejected";
  score: number;
  createdAt: string;
  llmRefined?: boolean;
  aggregatedKind?: string;
  aggregatedItems?: SuggestionAggregatedItem[];
};

/** Stesso insieme di project id (ordine ignorato). */
function projectIdsSetEqual(a: string[] | undefined, b: string[]): boolean {
  const aa = [...(a ?? [])].map(String).sort();
  const bb = [...b].map(String).sort();
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

const staleDays = (dateLike: string | undefined, refMs: number): number => {
  if (!dateLike) return 999;
  const date = new Date(dateLike).getTime();
  if (Number.isNaN(date)) return 999;
  return Math.floor((refMs - date) / (1000 * 60 * 60 * 24));
};

const riskOrder = (r: "low" | "medium" | "high"): number => (r === "high" ? 3 : r === "medium" ? 2 : 1);

/** Costruisce al più un gruppo per famiglia di regola (vedi piano aggregazione Cockpit). Esportato per test. */
export function buildRuleBasedRows(
  input: { workspaceId: string; projectIds: string[]; limit: number },
  clients: unknown[],
  apartments: unknown[],
  associations: unknown[],
  now: string
): RuleBasedSuggestionRow[] {
  const refMs = new Date(now).getTime();
  const apartmentMap = new Map(
    apartments.map((a) => [String((a as { _id?: unknown })._id), a as { name?: string; code?: string; status?: string }])
  );
  const groups: RuleBasedSuggestionRow[] = [];

  const staleItems: SuggestionAggregatedItem[] = [];
  associations.forEach((row) => {
    const r = row as { status?: string; updatedAt?: string; apartmentId?: string; _id?: unknown; clientId?: unknown };
    const status = String(r.status || "proposta");
    if (status === "proposta" && staleDays(String(r.updatedAt || ""), refMs) >= 7) {
      const apt = apartmentMap.get(String(r.apartmentId));
      staleItems.push({
        associationId: String(r._id),
        clientId: r.clientId != null ? String(r.clientId) : undefined,
        apartmentId: String(r.apartmentId),
        label: apt?.name ? String(apt.name) : String(r.apartmentId)
      });
    }
  });
  if (staleItems.length > 0) {
    const n = staleItems.length;
    const stored = staleItems.slice(0, MAX_AGGREGATED_ITEMS_STORED);
    const preview = stored.slice(0, 3).map((i) => i.label).join(", ");
    const more = n > 3 ? ` e altre ${n - 3}` : "";
    groups.push({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      title: `Proposte ferme (${n})`,
      reason: `Nessun avanzamento da almeno 7 giorni su ${n} proposte`,
      recommendedAction: `Contattare i clienti e aggiornare lo status (${preview}${more})`,
      risk: "high",
      requiresApproval: true,
      status: "pending",
      score: 92,
      createdAt: now,
      aggregatedKind: "stale_proposal_7d",
      aggregatedItems: stored
    });
  }

  const inactiveItems: SuggestionAggregatedItem[] = [];
  clients.forEach((row) => {
    const c = row as { updatedAt?: unknown; fullName?: string; email?: string; _id?: unknown };
    const updated = String(c.updatedAt ?? "");
    if (staleDays(updated, refMs) >= 20) {
      const fullName =
        (typeof c.fullName === "string" && c.fullName.trim() ? c.fullName : null) || String(c.email ?? c._id ?? "");
      inactiveItems.push({
        clientId: String(c._id),
        label: fullName
      });
    }
  });
  if (inactiveItems.length > 0) {
    const n = inactiveItems.length;
    const stored = inactiveItems.slice(0, MAX_AGGREGATED_ITEMS_STORED);
    const preview = stored.slice(0, 3).map((i) => i.label).join(", ");
    const more = n > 3 ? ` e altre ${n - 3}` : "";
    groups.push({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      title: `Clienti inattivi (${n})`,
      reason: `Nessun aggiornamento da almeno 20 giorni su ${n} clienti`,
      recommendedAction: `Creare task reminder / follow-up (${preview}${more})`,
      risk: "medium",
      requiresApproval: true,
      status: "pending",
      score: 74,
      createdAt: now,
      aggregatedKind: "inactive_client_20d",
      aggregatedItems: stored
    });
  }

  const availableItems: SuggestionAggregatedItem[] = [];
  apartments.forEach((row) => {
    const a = row as { status?: string; name?: string; code?: string; _id?: unknown };
    if (String(a.status || "") === "AVAILABLE") {
      availableItems.push({
        apartmentId: String(a._id),
        label: String(a.name ?? a.code ?? a._id)
      });
    }
  });
  if (availableItems.length > 0) {
    const n = availableItems.length;
    const stored = availableItems.slice(0, MAX_AGGREGATED_ITEMS_STORED);
    const preview = stored.slice(0, 3).map((i) => i.label).join(", ");
    const more = n > 3 ? ` e altre ${n - 3}` : "";
    groups.push({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      title: `Unità disponibili (${n})`,
      reason: "Immobili in stato disponibile senza pipeline attiva prioritaria",
      recommendedAction: `Avviare matching con clienti caldi (${preview}${more})`,
      risk: "low",
      requiresApproval: true,
      status: "pending",
      score: 52,
      createdAt: now,
      aggregatedKind: "available_unit",
      aggregatedItems: stored
    });
  }

  if (groups.length === 0) {
    groups.push({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      title: "Nessun rischio critico rilevato",
      reason: "Il workspace e stabile: mantieni monitoraggio giornaliero",
      recommendedAction: "Apri Cockpit e pianifica 3 task proattivi",
      risk: "low",
      requiresApproval: true,
      status: "pending",
      score: 35,
      createdAt: now,
      aggregatedKind: "no_critical_signal",
      aggregatedItems: []
    });
  }

  groups.sort((a, b) => {
    const rd = riskOrder(b.risk) - riskOrder(a.risk);
    if (rd !== 0) return rd;
    return b.score - a.score;
  });

  return groups.slice(0, input.limit);
}

/**
 * Elenco suggerimenti ancora pending da DB (nessuna rigenerazione, niente LLM).
 * Filtra per workspace + stesso insieme di projectIds della richiesta.
 */
export const queryPendingAiSuggestions = async (rawInput: unknown) => {
  const input = SuggestionsInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const configured = await isWorkspaceAiConfigured(input.workspaceId);
  if (!configured) {
    return { generatedAt: now, data: [], aiConfigured: false as const, fromCache: true as const };
  }

  const db = getDb();
  const docs = await db
    .collection<SuggestionDoc>("tz_ai_suggestions")
    .find({ workspaceId: input.workspaceId, status: "pending" })
    .sort({ score: -1, createdAt: -1 })
    .limit(200)
    .toArray();

  const filtered = docs.filter((d) => projectIdsSetEqual(d.projectIds, input.projectIds)).slice(0, input.limit);

  const generatedAt =
    filtered.length > 0
      ? filtered.reduce((acc, d) => (String(d.createdAt) > acc ? String(d.createdAt) : acc), String(filtered[0].createdAt))
      : now;

  let llmUsed: boolean | null = null;
  if (filtered.length > 0) {
    const flags = filtered.map((d) => d.llmRefined);
    if (flags.every((f) => f === true)) llmUsed = true;
    else if (flags.every((f) => f === false || f === undefined)) llmUsed = false;
    else llmUsed = null;
  }

  const data = filtered.map((d) => ({
    _id: d._id.toHexString(),
    workspaceId: d.workspaceId,
    projectIds: d.projectIds,
    title: d.title,
    reason: d.reason,
    recommendedAction: d.recommendedAction,
    risk: d.risk,
    requiresApproval: d.requiresApproval,
    status: d.status,
    score: d.score,
    createdAt: d.createdAt,
    ...(d.aggregatedKind != null ? { aggregatedKind: d.aggregatedKind } : {}),
    ...(d.aggregatedItems != null && d.aggregatedItems.length > 0 ? { aggregatedItems: d.aggregatedItems } : {})
  }));

  return {
    generatedAt,
    data,
    aiConfigured: true as const,
    llmUsed,
    fromCache: true as const
  };
};

export const generateAiSuggestions = async (rawInput: unknown) => {
  const input = SuggestionsInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const configured = await isWorkspaceAiConfigured(input.workspaceId);
  if (!configured) {
    return { generatedAt: now, data: [], aiConfigured: false };
  }

  const db = getDb();
  const [clients, apartments, associations] = await Promise.all([
    db
      .collection("tz_clients")
      .find({ projectId: { $in: input.projectIds } })
      .project({ _id: 1, fullName: 1, email: 1, updatedAt: 1 })
      .limit(400)
      .toArray(),
    db
      .collection("tz_apartments")
      .find({ workspaceId: input.workspaceId, projectId: { $in: input.projectIds } })
      .project({ _id: 1, name: 1, code: 1, status: 1, updatedAt: 1 })
      .limit(400)
      .toArray(),
    db
      .collection("tz_apartment_client_associations")
      .find({ workspaceId: input.workspaceId, projectId: { $in: input.projectIds }, active: true })
      .project({ _id: 1, apartmentId: 1, clientId: 1, status: 1, updatedAt: 1 })
      .limit(400)
      .toArray()
  ]);

  const groupLimit = Math.min(input.limit, MAX_SUGGESTION_GROUPS);
  let ranked: RuleBasedSuggestionRow[] = buildRuleBasedRows(
    { workspaceId: input.workspaceId, projectIds: input.projectIds, limit: groupLimit },
    clients,
    apartments,
    associations,
    now
  );
  let llmUsed = false;

  const aiInternal = await getWorkspaceAiConfigInternal(input.workspaceId);
  if (aiInternal && !ENV.AI_LLM_DISABLED) {
    try {
      const refined = await refineSuggestionsWithLlm({
        provider: aiInternal.provider,
        apiKey: aiInternal.apiKey,
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
        limit: groupLimit,
        ruleBased: ranked,
        snapshot: {
          clientCount: clients.length,
          apartmentCount: apartments.length,
          associationCount: associations.length
        }
      });
      if (refined && refined.length > 0) {
        ranked = refined;
        llmUsed = true;
      }
    } catch {
      /* fallback: ranked resta rule-based */
    }
  }

  const rowsToInsert = ranked.map((row) => ({ ...row, llmRefined: llmUsed }));
  const kinds = [...new Set(rowsToInsert.map((r) => r.aggregatedKind).filter(Boolean))];
  if (kinds.length > 0) {
    const candidates = await db
      .collection<SuggestionDoc>("tz_ai_suggestions")
      .find({
        workspaceId: input.workspaceId,
        status: "pending",
        aggregatedKind: { $in: kinds }
      })
      .project({ _id: 1, projectIds: 1 })
      .toArray();
    const idsToDelete = candidates.filter((d) => projectIdsSetEqual(d.projectIds, input.projectIds)).map((d) => d._id);
    if (idsToDelete.length > 0) {
      await db.collection("tz_ai_suggestions").deleteMany({ _id: { $in: idsToDelete } });
    }
  }

  const insertResult = rowsToInsert.length > 0 ? await db.collection("tz_ai_suggestions").insertMany(rowsToInsert) : null;

  const mapped = ranked.map((row, index) => ({
    ...row,
    _id: insertResult ? insertResult.insertedIds[index].toHexString() : `virtual-${index}`
  }));

  await emitDomainEvent({
    type: "ai.suggestions.generated",
    workspaceId: input.workspaceId,
    payload: { count: mapped.length, projectIds: input.projectIds, llmUsed }
  });

  return { generatedAt: now, data: mapped, aiConfigured: true, llmUsed, fromCache: false as const };
};

export const decideAiSuggestion = async (rawInput: unknown) => {
  const input = ApprovalInputSchema.parse(rawInput);
  const db = getDb();
  const suggestionId = new ObjectId(input.suggestionId);
  const now = new Date().toISOString();

  const existing = await db.collection<SuggestionDoc>("tz_ai_suggestions").findOne({ _id: suggestionId });
  if (!existing) {
    throw new HttpError("Suggestion not found", 404);
  }
  const entitledAi = await isWorkspaceEntitledToFeature(existing.workspaceId, "aiApprovals");
  if (!entitledAi) {
    throw new HttpError("Funzionalità non abilitata per questo workspace", 403, "FEATURE_NOT_ENTITLED");
  }

  await db.collection("tz_ai_suggestions").updateOne(
    { _id: suggestionId },
    { $set: { status: input.decision, decidedAt: now, decidedBy: input.actorEmail, decisionNote: input.note } }
  );
  await db.collection("tz_ai_suggestion_approvals").insertOne({
    suggestionId: input.suggestionId,
    decision: input.decision,
    actorEmail: input.actorEmail,
    note: input.note,
    createdAt: now
  });

  await emitDomainEvent({
    type: "ai.suggestion.decided",
    workspaceId: existing.workspaceId,
    payload: {
      suggestionId: input.suggestionId,
      decision: input.decision,
      actorEmail: input.actorEmail
    }
  });

  return { suggestionId: input.suggestionId, decision: input.decision, decidedAt: now };
};
