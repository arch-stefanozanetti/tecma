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
  createWorkflowState,
  createWorkflowTransition,
  getStateByCode,
  getWorkflowForWorkspaceAndType,
  getWorkflowWithStatesAndTransitions,
  isTransitionAllowed,
  isTransitionAllowedForWorkspace,
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

  it("listWorkflowsByWorkspace returns empty on missing workspace", async () => {
    const result = await listWorkflowsByWorkspace("");
    expect(result.workflows).toEqual([]);
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

  it("getWorkflowForWorkspaceAndType returns null when not found", async () => {
    workflowsFindOneMock.mockResolvedValueOnce(null);
    const detail = await getWorkflowForWorkspaceAndType("ws1", "rent");
    expect(detail).toBeNull();
  });

  it("getWorkflowForWorkspaceAndType resolves detail when workflow exists", async () => {
    const workflowId = new ObjectId("64b64f3fd9024a2a53111111");
    workflowsFindOneMock
      .mockResolvedValueOnce({ _id: workflowId, workspaceId: "ws1", name: "Rent WF", type: "rent" })
      .mockResolvedValueOnce({
        _id: workflowId,
        workspaceId: "ws1",
        name: "Rent WF",
        type: "rent",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      });
    statesToArrayMock.mockResolvedValueOnce([]);
    transitionsToArrayMock.mockResolvedValueOnce([]);

    const detail = await getWorkflowForWorkspaceAndType("ws1", "rent");

    expect(detail?.workflow._id).toBe(workflowId.toHexString());
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
    expect(getStateByCode(detail, "new")?._id).toBe("s1");
    expect(getStateByCode(detail, "unknown")).toBeNull();
  });

  it("isTransitionAllowedForWorkspace returns null when no workflow", async () => {
    workflowsFindOneMock.mockResolvedValueOnce(null);
    const allowed = await isTransitionAllowedForWorkspace("ws1", "rent", "new", "won");
    expect(allowed).toBeNull();
  });

  it("isTransitionAllowedForWorkspace resolves true on allowed transition", async () => {
    const workflowId = new ObjectId("64b64f3fd9024a2a53111111");
    const s1 = new ObjectId("64b64f3fd9024a2a53222222");
    const s2 = new ObjectId("64b64f3fd9024a2a53333333");
    workflowsFindOneMock
      .mockResolvedValueOnce({ _id: workflowId, workspaceId: "ws1", name: "WF", type: "sell" })
      .mockResolvedValueOnce({
        _id: workflowId,
        workspaceId: "ws1",
        name: "WF",
        type: "sell",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });
    statesToArrayMock.mockResolvedValueOnce([
      { _id: s1, workflowId: workflowId.toHexString(), code: "new", label: "New", order: 1, terminal: false, reversible: true, apartmentLock: "none" },
      { _id: s2, workflowId: workflowId.toHexString(), code: "won", label: "Won", order: 2, terminal: true, reversible: false, apartmentLock: "hard" },
    ]);
    transitionsToArrayMock.mockResolvedValueOnce([
      { _id: new ObjectId("64b64f3fd9024a2a53444444"), workflowId: workflowId.toHexString(), fromStateId: s1.toHexString(), toStateId: s2.toHexString(), createdAt: new Date("2026-01-01") },
    ]);

    const allowed = await isTransitionAllowedForWorkspace("ws1", "sell", "new", "won");
    expect(allowed).toBe(true);
  });

  it("createWorkflow returns created row", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111111");
    insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createWorkflow({ workspaceId: "ws1", name: "WF", type: "custom" });

    expect(result.workflow._id).toBe(insertedId.toHexString());
    expect(result.workflow.type).toBe("custom");
  });

  it("createWorkflow applies default name/type when omitted at runtime", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111114");
    insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createWorkflow({ workspaceId: "ws1" } as unknown as { workspaceId: string; name: string; type: "custom" });

    expect(result.workflow.name).toBe("Workflow");
    expect(result.workflow.type).toBe("custom");
  });

  it("createWorkflowState applies defaults and returns row", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111112");
    insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createWorkflowState({
      workflowId: "wf1",
      code: "new",
      label: "New",
      order: 1,
    });

    expect(result.state._id).toBe(insertedId.toHexString());
    expect(result.state.apartmentLock).toBe("none");
    expect(result.state.terminal).toBe(false);
  });

  it("createWorkflowState keeps explicit apartmentLock soft/hard", async () => {
    insertOneMock
      .mockResolvedValueOnce({ insertedId: new ObjectId("64b64f3fd9024a2a53111115") })
      .mockResolvedValueOnce({ insertedId: new ObjectId("64b64f3fd9024a2a53111116") });

    const soft = await createWorkflowState({
      workflowId: "wf1",
      code: "proposal",
      label: "Proposal",
      order: 2,
      apartmentLock: "soft",
    });
    const hard = await createWorkflowState({
      workflowId: "wf1",
      code: "won",
      label: "Won",
      order: 3,
      apartmentLock: "hard",
    });

    expect(soft.state.apartmentLock).toBe("soft");
    expect(hard.state.apartmentLock).toBe("hard");
  });

  it("createWorkflowTransition returns created row", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111113");
    insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createWorkflowTransition({
      workflowId: "wf1",
      fromStateId: "s1",
      toStateId: "s2",
    });

    expect(result.transition._id).toBe(insertedId.toHexString());
    expect(result.transition.fromStateId).toBe("s1");
    expect(result.transition.toStateId).toBe("s2");
  });
});
