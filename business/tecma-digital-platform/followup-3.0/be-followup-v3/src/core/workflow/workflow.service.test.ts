import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneMock = vi.fn();
const collectionMock = vi.fn(() => ({ findOne: findOneMock }));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: collectionMock,
  }),
}));

import { getWorkflowConfig } from "./workflow.service.js";

describe("workflow.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tz workflow config when present", async () => {
    findOneMock.mockResolvedValueOnce({
      flowType: "sell",
      states: [{ id: "new" }, { id: "won", isTerminal: true }],
      transitions: [{ fromState: "new", toState: "won", event: "win" }],
      version: 3,
    });

    const result = await getWorkflowConfig("ws1", "p1", "sell");

    expect(collectionMock).toHaveBeenNthCalledWith(1, "tz_workflow_configs");
    expect(result.flowType).toBe("sell");
    expect(result.states).toHaveLength(2);
    expect(result.transitions).toHaveLength(1);
    expect(result.version).toBe(3);
  });

  it("falls back to automata_configurations and maps transitions", async () => {
    findOneMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        version: 7,
        automata: {
          new: { nextStates: { contact: "contacted" }, notify: true },
          contacted: { nextStates: { lose: "lost", view: "viewing" } },
          lost: { nextStates: {} },
        },
      });

    const result = await getWorkflowConfig("ws1", "p1", "rent");

    expect(collectionMock).toHaveBeenNthCalledWith(1, "tz_workflow_configs");
    expect(collectionMock).toHaveBeenNthCalledWith(2, "automata_configurations");
    expect(result.flowType).toBe("rent");
    expect(result.states.some((s) => s.id === "lost" && s.isTerminal)).toBe(true);
    expect(result.transitions).toEqual(
      expect.arrayContaining([
        { fromState: "new", toState: "contacted", event: "contact" },
        { fromState: "contacted", toState: "lost", event: "lose" },
      ])
    );
    expect(result.version).toBe(7);
  });

  it("returns default workflow when no config is found", async () => {
    findOneMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await getWorkflowConfig("ws1", "p1", "sell");

    expect(result.flowType).toBe("sell");
    expect(result.states.length).toBeGreaterThan(0);
    expect(result.transitions.length).toBeGreaterThan(0);
    expect(result.states.some((s) => s.id === "won" && s.isTerminal)).toBe(true);
  });
});
