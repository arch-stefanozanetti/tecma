import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const workflowsToArrayMock = vi.fn();
const statesToArrayMock = vi.fn();
const transitionsToArrayMock = vi.fn();
const workflowsFindOneMock = vi.fn();
const insertOneMock = vi.fn();

const workflowsFindMock = vi.fn(() => ({ sort: vi.fn(() => ({ toArray: workflowsToArrayMock })) }));
const statesFindMock = vi.fn(() => ({ sort: vi.fn(() => ({ toArray: statesToArrayMock })) }));
const transitionsFindMock = vi.fn(() => ({ toArray: transitionsToArrayMock }));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_workflows") {
        return {
          find: workflowsFindMock,
          findOne: workflowsFindOneMock,
          insertOne: insertOneMock,
        };
      }
      if (name === "tz_workflow_states") {
        return { find: statesFindMock, insertOne: insertOneMock };
      }
      if (name === "tz_workflow_transitions") {
        return { find: transitionsFindMock, insertOne: insertOneMock };
      }
      return { find: vi.fn(), findOne: vi.fn(), insertOne: vi.fn() };
    },
  }),
}));

import {
  buildValidationConfig,
  createWorkflow,
  getWorkflowWithStatesAndTransitions,
  isTransitionAllowed,
  listWorkflowsByWorkspace,
} from "./workflow-engine.service.js";

describe("workflow-engine.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listWorkflowsByWorkspace returns ordered rows", async () => {
    workflowsToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId("64b64f3fd9024a2a53111111"),
        workspaceId: "ws1",
        name: "Sell Flow",
        type: "sell",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);

    const result = await listWorkflowsByWorkspace("ws1");

    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].type).toBe("sell");
  });

  it("getWorkflowWithStatesAndTransitions returns null on invalid id", async () => {
    const result = await getWorkflowWithStatesAndTransitions("bad-id");
    expect(result).toBeNull();
  });

  it("getWorkflowWithStatesAndTransitions hydrates workflow detail", async () => {
    const workflowId = new ObjectId("64b64f3fd9024a2a53111111");
    workflowsFindOneMock.mockResolvedValueOnce({
      _id: workflowId,
      workspaceId: "ws1",
      name: "Main Flow",
      type: "rent",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });
    statesToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId("64b64f3fd9024a2a53222222"),
        workflowId: workflowId.toHexString(),
        code: "new",
        label: "New",
        order: 1,
        terminal: false,
        reversible: true,
        apartmentLock: "none",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);
    transitionsToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId("64b64f3fd9024a2a53333333"),
        workflowId: workflowId.toHexString(),
        fromStateId: "64b64f3fd9024a2a53222222",
        toStateId: "64b64f3fd9024a2a53222222",
        createdAt: new Date("2026-01-02"),
      },
    ]);

    const detail = await getWorkflowWithStatesAndTransitions(workflowId.toHexString());

    expect(detail?.workflow.name).toBe("Main Flow");
    expect(detail?.states).toHaveLength(1);
    expect(detail?.transitions).toHaveLength(1);
  });

  it("buildValidationConfig + isTransitionAllowed validate paths", () => {
    const detail = {
      workflow: {
        _id: "wf1",
        workspaceId: "ws1",
        name: "WF",
        type: "sell" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      states: [
        { _id: "s1", workflowId: "wf1", code: "new", label: "New", order: 1, terminal: false, reversible: true, apartmentLock: "none" as const, createdAt: "", updatedAt: "" },
        { _id: "s2", workflowId: "wf1", code: "won", label: "Won", order: 2, terminal: true, reversible: false, apartmentLock: "hard" as const, createdAt: "", updatedAt: "" },
      ],
      transitions: [{ _id: "t1", workflowId: "wf1", fromStateId: "s1", toStateId: "s2", createdAt: "" }],
    };

    const config = buildValidationConfig(detail);
    expect(isTransitionAllowed(config, "new", "won")).toBe(true);
    expect(isTransitionAllowed(config, "won", "new")).toBe(false);
  });

  it("createWorkflow returns created row", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111111");
    insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createWorkflow({ workspaceId: "ws1", name: "WF", type: "custom" });

    expect(result.workflow._id).toBe(insertedId.toHexString());
    expect(result.workflow.type).toBe("custom");
  });
});
