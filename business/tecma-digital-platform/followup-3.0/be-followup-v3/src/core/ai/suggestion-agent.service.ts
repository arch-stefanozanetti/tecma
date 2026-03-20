/**
 * Agente leggero: LLM + tool in-process per eseguire azioni collegate a un suggerimento Cockpit.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { completeJson, type LlmMessage } from "./llm.client.js";
import { getWorkspaceAiConfigInternal } from "../workspaces/workspace-ai-config.service.js";
import { executeAgentTool, isAgentToolName, type AgentToolContext } from "./agent-tools.service.js";
import { emitDomainEvent } from "../events/event-log.service.js";

const ExecuteBodySchema = z.object({
  actorEmail: z.string().email(),
  note: z.string().optional().default(""),
  maxSteps: z.number().int().min(1).max(8).optional().default(6)
});

const AgentTurnSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool_calls"),
    calls: z
      .array(
        z.object({
          name: z.string(),
          arguments: z.record(z.unknown()).optional().default({})
        })
      )
      .min(1)
      .max(5)
  }),
  z.object({
    type: z.literal("final"),
    summary: z.string().min(1).max(8000)
  })
]);

const TOOL_MANIFEST = `Tool disponibili (JSON args):
- search_clients: { workspaceId, projectIds: string[], searchText?: string }
- search_apartments: { workspaceId, projectIds: string[], searchText?: string }
- list_associations: { workspaceId, projectIds: string[] }
- generate_workspace_report: { workspaceId, projectIds: string[] }
- create_calendar_event: { workspaceId, projectId, title, startsAt, endsAt, clientId?, apartmentId? }
- create_task_from_suggestion: { workspaceId, projectId, title, description, clientId?, apartmentId?, dueAt? }

Rispondi SOLO con JSON:
{"type":"tool_calls","calls":[{"name":"...","arguments":{...}}]}
oppure
{"type":"final","summary":"..."}`;

function truncateResult(obj: unknown, maxLen = 4000): unknown {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxLen) return obj;
    return { truncated: true, preview: s.slice(0, maxLen) + "…" };
  } catch {
    return { error: "unserializable" };
  }
}

export async function executeSuggestionWithAgent(
  suggestionId: string,
  rawBody: unknown,
  accessCtx: AgentToolContext
): Promise<{
  suggestionId: string;
  summary: string;
  toolLog: Array<{ name: string; ok: boolean; error?: string }>;
  steps: number;
}> {
  const body = ExecuteBodySchema.parse(rawBody);
  const db = getDb();
  if (!ObjectId.isValid(suggestionId)) throw new HttpError("Invalid suggestion id", 400);
  const oid = new ObjectId(suggestionId);

  const doc = await db.collection("tz_ai_suggestions").findOne({ _id: oid });
  if (!doc) throw new HttpError("Suggestion not found", 404);

  const workspaceId = String(doc.workspaceId ?? "");
  const projectIds = Array.isArray(doc.projectIds) ? doc.projectIds.filter((x): x is string => typeof x === "string") : [];
  if (workspaceId !== accessCtx.workspaceId) {
    throw new HttpError("Suggestion workspace mismatch", 403);
  }

  const ai = await getWorkspaceAiConfigInternal(workspaceId);
  if (!ai) throw new HttpError("Workspace AI not configured", 400);

  const ctx: AgentToolContext = {
    workspaceId,
    projectIds: projectIds.length > 0 ? projectIds : accessCtx.projectIds,
    actorEmail: body.actorEmail,
    actorIsAdmin: accessCtx.actorIsAdmin,
    actorIsTecmaAdmin: accessCtx.actorIsTecmaAdmin,
  };

  const suggestionPayload = JSON.stringify(
    {
      title: doc.title,
      reason: doc.reason,
      recommendedAction: doc.recommendedAction,
      risk: doc.risk,
      note: body.note || undefined
    },
    null,
    0
  );

  const system = `Sei un agente operativo Followup (CRM immobiliare). Obiettivo: aiutare l'utente a svolgere l'azione suggerita usando i tool.
WorkspaceId fisso: ${workspaceId}. ProjectIds ammessi: ${JSON.stringify(ctx.projectIds)}.
Ogni tool DEVE usare workspaceId esattamente "${workspaceId}" e solo projectIds tra quelli elencati.
${TOOL_MANIFEST}`;

  const messages: LlmMessage[] = [
    {
      role: "user",
      content: `Suggerimento da elaborare:\n${suggestionPayload}\n\nEsegui i passi necessari (tool) poi concludi con type "final" e un riepilogo in italiano.`
    }
  ];

  const toolLog: Array<{ name: string; ok: boolean; error?: string }> = [];
  let steps = 0;
  const maxSteps = Math.min(body.maxSteps, 8);

  while (steps < maxSteps) {
    steps += 1;
    let raw: unknown;
    try {
      raw = await completeJson({
        provider: ai.provider,
        apiKey: ai.apiKey,
        system,
        messages
      });
    } catch (e) {
      throw new HttpError(e instanceof Error ? e.message : "LLM call failed", 502);
    }

    const parsed = AgentTurnSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError("Invalid agent response shape", 502);
    }

    if (parsed.data.type === "final") {
      await emitDomainEvent({
        type: "ai.suggestion.agent_executed",
        workspaceId,
        payload: {
          suggestionId,
          actorEmail: body.actorEmail,
          steps,
          toolLog,
          summaryLen: parsed.data.summary.length
        },
        actor: { type: "user", id: body.actorEmail }
      });
      return {
        suggestionId,
        summary: parsed.data.summary,
        toolLog,
        steps
      };
    }

    const results: string[] = [];
    for (const call of parsed.data.calls) {
      if (!isAgentToolName(call.name)) {
        toolLog.push({ name: call.name, ok: false, error: "unknown tool" });
        results.push(JSON.stringify({ error: "unknown tool", name: call.name }));
        continue;
      }
      try {
        const out = await executeAgentTool(call.name, call.arguments ?? {}, ctx);
        toolLog.push({ name: call.name, ok: true });
        results.push(JSON.stringify(truncateResult(out)));
      } catch (e) {
        const msg = e instanceof HttpError ? e.message : e instanceof Error ? e.message : "tool error";
        toolLog.push({ name: call.name, ok: false, error: msg });
        results.push(JSON.stringify({ error: msg }));
      }
    }

    messages.push({ role: "assistant", content: JSON.stringify(parsed.data) });
    messages.push({
      role: "user",
      content: `Risultati tool:\n${results.join("\n---\n")}\n\nContinua con altri tool_calls o concludi con final.`
    });
  }

  throw new HttpError("Agent step limit exceeded", 408);
}
