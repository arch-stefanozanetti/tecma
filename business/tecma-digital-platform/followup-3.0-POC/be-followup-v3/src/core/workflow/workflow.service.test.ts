import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getWorkflowForWorkspaceAndTypeMock = vi.fn();
  return { getWorkflowForWorkspaceAndTypeMock };
});

vi.mock("./workflow-engine.service.js", () => ({
  getWorkflowForWorkspaceAndType: mocks.getWorkflowForWorkspaceAndTypeMock,
}));

import { getWorkflowConfig } from "./workflow.service.js";

describe("workflow.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns config mapped from workflow engine", async () => {
    mocks.getWorkflowForWorkspaceAndTypeMock.mockResolvedValueOnce({
      workflow: { _id: "wf1", workspaceId: "ws1", type: "sell" },
      states: [
        { _id: "s1", code: "new", label: "Nuova", terminal: false },
        { _id: "s2", code: "won", label: "Vinta", terminal: true },
      ],
      transitions: [{ fromStateId: "s1", toStateId: "s2" }],
    });

    const result = await getWorkflowConfig("ws1", "p1", "sell");

    expect(result.flowType).toBe("sell");
    expect(result.states).toHaveLength(2);
    expect(result.transitions[0]).toMatchObject({ fromState: "new", toState: "won" });
  });

  it("throws when workflow is not configured", async () => {
    mocks.getWorkflowForWorkspaceAndTypeMock.mockResolvedValueOnce(null);
    await expect(getWorkflowConfig("ws1", "p1", "rent")).rejects.toMatchObject({ statusCode: 400 });
  });
});
