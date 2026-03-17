import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { emitDomainEvent } from "../events/event-log.service.js";

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
};

const staleDays = (dateLike?: string): number => {
  if (!dateLike) return 999;
  const date = new Date(dateLike).getTime();
  if (Number.isNaN(date)) return 999;
  return Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
};

export const generateAiSuggestions = async (rawInput: unknown) => {
  const input = SuggestionsInputSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();

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

  const apartmentMap = new Map(apartments.map((a) => [String(a._id), a]));
  const suggestions: Omit<SuggestionDoc, "_id">[] = [];

  associations.forEach((row) => {
    const status = String(row.status || "proposta");
    if (status === "proposta" && staleDays(String(row.updatedAt || "")) >= 7) {
      const apt = apartmentMap.get(String(row.apartmentId));
      suggestions.push({
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
        title: `Proposta ferma su ${apt?.name ?? row.apartmentId}`,
        reason: "Nessun avanzamento da almeno 7 giorni",
        recommendedAction: "Contattare cliente e aggiornare status",
        risk: "high",
        requiresApproval: true,
        status: "pending",
        score: 92,
        createdAt: now
      });
    }
  });

  clients.forEach((row: { updatedAt?: unknown; fullName?: string; email?: string; _id?: unknown }) => {
    const updated = String(row.updatedAt ?? "");
    if (staleDays(updated) >= 20) {
      const fullName = (typeof row.fullName === "string" && row.fullName.trim() ? row.fullName : null) || String(row.email ?? row._id ?? "");
      suggestions.push({
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
        title: `Cliente inattivo: ${fullName}`,
        reason: `Nessun update da ${staleDays(updated)} giorni`,
        recommendedAction: "Creare task reminder con template follow-up",
        risk: "medium",
        requiresApproval: true,
        status: "pending",
        score: 74,
        createdAt: now
      });
    }
  });

  apartments.forEach((row) => {
    if (String(row.status || "") === "AVAILABLE") {
      suggestions.push({
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
        title: `Unita disponibile: ${String(row.name ?? row.code ?? row._id)}`,
        reason: "Nessuna associazione attiva ad alta priorita",
        recommendedAction: "Avviare matching automatico clienti caldi",
        risk: "low",
        requiresApproval: true,
        status: "pending",
        score: 52,
        createdAt: now
      });
    }
  });

  const ranked = suggestions.sort((a, b) => b.score - a.score).slice(0, input.limit);
  if (ranked.length === 0) {
    ranked.push({
      workspaceId: input.workspaceId,
      projectIds: input.projectIds,
      title: "Nessun rischio critico rilevato",
      reason: "Il workspace e stabile: mantieni monitoraggio giornaliero",
      recommendedAction: "Apri Cockpit e pianifica 3 task proattivi",
      risk: "low",
      requiresApproval: true,
      status: "pending",
      score: 35,
      createdAt: now
    });
  }
  const insertResult = ranked.length > 0 ? await db.collection("tz_ai_suggestions").insertMany(ranked) : null;

  const mapped = ranked.map((row, index) => ({
    ...row,
    _id: insertResult ? insertResult.insertedIds[index].toHexString() : `virtual-${index}`
  }));

  await emitDomainEvent({
    type: "ai.suggestions.generated",
    workspaceId: input.workspaceId,
    payload: { count: mapped.length, projectIds: input.projectIds }
  });

  return { generatedAt: now, data: mapped };
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
