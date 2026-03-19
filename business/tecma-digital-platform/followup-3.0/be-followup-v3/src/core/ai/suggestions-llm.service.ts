import { z } from "zod";
import { completeJson } from "./llm.client.js";
import type { AiProviderId } from "../workspaces/workspace-ai-config.service.js";

const LlmSuggestionItemSchema = z.object({
  title: z.string().min(1).max(500),
  reason: z.string().min(1).max(2000),
  recommendedAction: z.string().min(1).max(500),
  risk: z.enum(["low", "medium", "high"]),
  score: z.number().int().min(0).max(100)
});

const LlmSuggestionsOutputSchema = z.object({
  suggestions: z.array(LlmSuggestionItemSchema).min(1).max(50)
});

export type SuggestionAggregatedItem = {
  associationId?: string;
  clientId?: string;
  apartmentId?: string;
  label: string;
};

export type RuleBasedSuggestionRow = {
  workspaceId: string;
  projectIds: string[];
  title: string;
  reason: string;
  recommendedAction: string;
  risk: "low" | "medium" | "high";
  requiresApproval: boolean;
  status: "pending";
  score: number;
  createdAt: string;
  /** Famiglia regola per dedup/refresh (obbligatorio su righe generate dalla pipeline aggregata) */
  aggregatedKind: string;
  /** Dettaglio entità aggregate (tetto lato server in orchestrator) */
  aggregatedItems?: SuggestionAggregatedItem[];
  /** true se il batch è stato raffinato dal LLM (persistito per letture GET successive) */
  llmRefined?: boolean;
};

/**
 * Usa il LLM per sintetizzare / riprioritizzare i suggerimenti rule-based.
 * In caso di errore o output invalido, il chiamante deve usare il fallback rule-based.
 */
export async function refineSuggestionsWithLlm(params: {
  provider: AiProviderId;
  apiKey: string;
  workspaceId: string;
  projectIds: string[];
  limit: number;
  ruleBased: RuleBasedSuggestionRow[];
  snapshot: {
    clientCount: number;
    apartmentCount: number;
    associationCount: number;
  };
}): Promise<RuleBasedSuggestionRow[] | null> {
  const { provider, apiKey, workspaceId, projectIds, limit, ruleBased, snapshot } = params;

  const slice = ruleBased.slice(0, limit);
  const n = slice.length;
  if (n === 0) return [];

  const system = `Sei un assistente CRM per Followup (immobiliare, Italia).
Ricevi N gruppi di suggerimenti aggregati (macro-card Cockpit), ciascuno con un aggregatedKind stabile.
NON unire, dividere o riordinare i gruppi: l'ordine e il numero devono restare identici.
Per ogni gruppo, in italiano, migliora solo title, reason, recommendedAction, risk e score (0-100) restando fedele ai fatti (stessi tipi di rischio, stessa urgenza relativa).
Restituisci SOLO JSON valido:
{"suggestions":[{"title":"...","reason":"...","recommendedAction":"...","risk":"low"|"medium"|"high","score":number}]}
Deve esserci ESATTAMENTE ${n} elementi in "suggestions", nello STESSO ORDINE degli input (indice 0 = primo gruppo, ecc.).`;

  const userPayload = JSON.stringify(
    {
      workspaceId,
      projectIds,
      expectedCount: n,
      snapshot,
      ruleBasedCandidates: slice.map((r, index) => ({
        index,
        aggregatedKind: r.aggregatedKind,
        itemCount: r.aggregatedItems?.length ?? 0,
        sampleLabels: (r.aggregatedItems ?? []).slice(0, 5).map((i) => i.label),
        title: r.title,
        reason: r.reason,
        recommendedAction: r.recommendedAction,
        risk: r.risk,
        score: r.score
      }))
    },
    null,
    0
  );

  const raw = await completeJson({
    provider,
    apiKey,
    system,
    messages: [{ role: "user", content: userPayload }]
  });

  const parsed = LlmSuggestionsOutputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const out = parsed.data.suggestions;
  if (out.length !== n) return null;

  const createdAt = new Date().toISOString();
  return out.map((s, i) => {
    const base = slice[i];
    return {
      ...base,
      title: s.title,
      reason: s.reason,
      recommendedAction: s.recommendedAction,
      risk: s.risk,
      score: s.score,
      createdAt
    };
  });
}
