import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refineSuggestionsWithLlm, type RuleBasedSuggestionRow } from "./suggestions-llm.service.js";
import * as llmClient from "./llm.client.js";

vi.mock("./llm.client.js", () => ({
  completeJson: vi.fn()
}));

const baseRow = (kind: string, label: string): RuleBasedSuggestionRow => ({
  workspaceId: "w1",
  projectIds: ["p1"],
  title: `Titolo ${kind}`,
  reason: "Motivo",
  recommendedAction: "Azione",
  risk: "medium",
  requiresApproval: true,
  status: "pending",
  score: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
  aggregatedKind: kind,
  aggregatedItems: [{ label }]
});

describe("refineSuggestionsWithLlm", () => {
  beforeEach(() => {
    vi.mocked(llmClient.completeJson).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("merge 1:1: mantiene aggregatedKind e aggregatedItems, aggiorna testo dal LLM", async () => {
    const ruleBased = [baseRow("stale_proposal_7d", "A1"), baseRow("inactive_client_20d", "C1")];
    vi.mocked(llmClient.completeJson).mockResolvedValue({
      suggestions: [
        {
          title: "LLM 1",
          reason: "R1",
          recommendedAction: "A1",
          risk: "high",
          score: 90
        },
        {
          title: "LLM 2",
          reason: "R2",
          recommendedAction: "A2",
          risk: "low",
          score: 40
        }
      ]
    });

    const out = await refineSuggestionsWithLlm({
      provider: "openai",
      apiKey: "k",
      workspaceId: "w1",
      projectIds: ["p1"],
      limit: 8,
      ruleBased,
      snapshot: { clientCount: 1, apartmentCount: 1, associationCount: 1 }
    });

    expect(out).not.toBeNull();
    expect(out).toHaveLength(2);
    expect(out![0].aggregatedKind).toBe("stale_proposal_7d");
    expect(out![0].aggregatedItems).toEqual([{ label: "A1" }]);
    expect(out![0].title).toBe("LLM 1");
    expect(out![0].risk).toBe("high");
    expect(out![1].aggregatedKind).toBe("inactive_client_20d");
    expect(out![1].title).toBe("LLM 2");
  });

  it("ritorna null se il LLM restituisce un numero di righe diverso", async () => {
    const ruleBased = [baseRow("a", "x"), baseRow("b", "y")];
    vi.mocked(llmClient.completeJson).mockResolvedValue({
      suggestions: [
        { title: "Solo uno", reason: "r", recommendedAction: "a", risk: "low", score: 1 }
      ]
    });

    const out = await refineSuggestionsWithLlm({
      provider: "openai",
      apiKey: "k",
      workspaceId: "w1",
      projectIds: ["p1"],
      limit: 8,
      ruleBased,
      snapshot: { clientCount: 0, apartmentCount: 0, associationCount: 0 }
    });

    expect(out).toBeNull();
  });

  it("con ruleBased vuoto restituisce array vuoto senza chiamare il provider", async () => {
    const out = await refineSuggestionsWithLlm({
      provider: "openai",
      apiKey: "k",
      workspaceId: "w1",
      projectIds: ["p1"],
      limit: 8,
      ruleBased: [],
      snapshot: { clientCount: 0, apartmentCount: 0, associationCount: 0 }
    });
    expect(out).toEqual([]);
    expect(llmClient.completeJson).not.toHaveBeenCalled();
  });
});
