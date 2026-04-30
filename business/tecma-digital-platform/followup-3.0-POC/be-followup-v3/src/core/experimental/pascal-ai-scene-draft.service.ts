import { z } from "zod";
import { completeJson } from "../ai/llm.client.js";
import type { AiProviderId } from "../workspaces/workspace-ai-config.service.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";

/** Nodo minimo: id + type + campi extra (subset SceneGraph Pascal, grafo piatto). */
const SceneDraftNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough();

export const PascalSceneDraftSchema = z.object({
  nodes: z.record(z.string(), SceneDraftNodeSchema),
  rootNodeIds: z.array(z.string()).min(1),
});

export type PascalSceneDraft = z.infer<typeof PascalSceneDraftSchema>;

function normalizeNodeIds(draft: PascalSceneDraft): PascalSceneDraft {
  const nodes: Record<string, z.infer<typeof SceneDraftNodeSchema>> = {};
  for (const [key, node] of Object.entries(draft.nodes)) {
    const id = typeof node.id === "string" && node.id.trim() ? node.id.trim() : key;
    nodes[key] = { ...node, id };
  }
  return { nodes, rootNodeIds: [...draft.rootNodeIds] };
}

function assertSceneDraftConstraints(
  draft: PascalSceneDraft,
  maxNodes: number,
  allowedTypes?: string[]
): void {
  const keys = Object.keys(draft.nodes);
  if (keys.length > maxNodes) {
    throw new HttpError(`Troppi nodi nel draft (max ${maxNodes})`, 400, "SCENE_DRAFT_TOO_MANY_NODES");
  }
  for (const rid of draft.rootNodeIds) {
    if (!draft.nodes[rid]) {
      throw new HttpError(`rootNodeIds contiene id assente in nodes: ${rid}`, 400, "SCENE_DRAFT_INVALID_ROOT");
    }
  }
  if (allowedTypes?.length) {
    for (const [nid, n] of Object.entries(draft.nodes)) {
      if (!allowedTypes.includes(n.type)) {
        throw new HttpError(`Tipo nodo non ammesso "${n.type}" (${nid})`, 400, "SCENE_DRAFT_TYPE_NOT_ALLOWED");
      }
    }
  }
}

function buildSystemPrompt(maxNodes: number, allowedTypes?: string[]): string {
  const typeRule = allowedTypes?.length
    ? `Usa solo questi valori per "type": ${allowedTypes.join(", ")}.`
    : `Tipi tipici Pascal: site, building, level, wall, zone, slab, ceiling (stringa "type" minuscola).`;

  return `Sei un assistente che produce SOLO JSON valido per un editor architettonico Pascal.

Formato obbligatorio:
{
  "nodes": { "<nodeId>": { "id": "<nodeId>", "type": "<tipo>", ... }, ... },
  "rootNodeIds": ["<id root>", ...]
}

Regole:
- Grafo piatto: ogni nodo è una chiave in "nodes"; riferimenti tra nodi tramite array "children" di stringhe (id), coerenti con le chiavi presenti.
- Ogni nodo deve includere "id" e "type".
- Solitamente un solo root di tipo "site"; building con position/rotation; level con "level" numerico; wall con "start" e "end" come [x,z] in metri sul piano del livello.
- Non superare ${maxNodes} nodi in totale.
- ${typeRule}
- Nessun testo fuori dal JSON.`;
}

export async function pascalAiSceneDraft(params: {
  provider: AiProviderId;
  apiKey: string;
  prompt: string;
  maxNodes: number;
  allowedTypes?: string[];
}): Promise<{ data: { sceneGraph: PascalSceneDraft } }> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new HttpError("prompt obbligatorio", 400, "SCENE_DRAFT_PROMPT_REQUIRED");
  }
  const maxNodes = Math.min(Math.max(params.maxNodes, 4), 200);

  const system = buildSystemPrompt(maxNodes, params.allowedTypes);
  const user = `Richiesta utente:\n${prompt}`;

  let raw: unknown;
  try {
    raw = await completeJson({
      provider: params.provider,
      apiKey: params.apiKey,
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: e }, "[experimental] ai-scene-draft LLM failed");
    throw new HttpError("Generazione bozza scena non riuscita", 502, "SCENE_DRAFT_LLM_ERROR", msg.slice(0, 300));
  }

  const parsed = PascalSceneDraftSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten() }, "[experimental] ai-scene-draft Zod failed");
    throw new HttpError("Risposta LLM non conforme allo schema scena", 422, "SCENE_DRAFT_SCHEMA_MISMATCH");
  }

  const normalized = normalizeNodeIds(parsed.data);
  assertSceneDraftConstraints(normalized, maxNodes, params.allowedTypes);

  return { data: { sceneGraph: normalized } };
}
