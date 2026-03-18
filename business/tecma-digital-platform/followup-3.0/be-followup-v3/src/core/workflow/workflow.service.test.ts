import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tzFindOneMock = vi.fn();
  return { tzFindOneMock };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_workflow_configs") return { findOne: mocks.tzFindOneMock };
      throw new Error("Unexpected collection: " + name);
    },
  }),
}));

import { getWorkflowConfig } from "./workflow.service.js";

describe("workflow.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tz workflow config when present", async () => {
    mocks.tzFindOneMock.mockResolvedValueOnce({
      flowType: "sell",
      states: [{ id: "new" }, { id: "won" }],
      transitions: [{ fromState: "new", toState: "won", event: "win" }],
      version: 3,
    });

    const result = await getWorkflowConfig("ws1", "p1", "sell");

    expect(result.flowType).toBe("sell");
    expect(result.states).toHaveLength(2);
    expect(result.version).toBe(3);
  });

  it("returns default config when no tz doc", async () => {
    mocks.tzFindOneMock.mockResolvedValueOnce(null);

    const result = await getWorkflowConfig("ws1", "p1", "rent");

    expect(result.flowType).toBe("rent");
    expect(result.states.some((s) => s.id === "new")).toBe(true);
    expect(result.transitions.some((t) => t.fromState === "offer" && t.toState === "won")).toBe(true);
  });
});
