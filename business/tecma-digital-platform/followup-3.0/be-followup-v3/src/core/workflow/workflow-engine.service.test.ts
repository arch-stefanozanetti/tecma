import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const workflowsFindOneMock = vi.fn();
  const workflowsInsertOneMock = vi.fn();
  const workflowsToArrayMock = vi.fn();
  const workflowsSortMock = vi.fn(() => ({ toArray: workflowsToArrayMock }));
  const workflowsFindMock = vi.fn(() => ({ sort: workflowsSortMock, toArray: workflowsToArrayMock }));

  const statesInsertOneMock = vi.fn();
  const statesToArrayMock = vi.fn();
  const statesSortMock = vi.fn(() => ({ toArray: statesToArrayMock }));
  const statesFindMock = vi.fn(() => ({ sort: statesSortMock, toArray: statesToArrayMock }));

  const transitionsInsertOneMock = vi.fn();
  const transitionsToArrayMock = vi.fn();
  const transitionsFindMock = vi.fn(() => ({ toArray: transitionsToArrayMock }));

  const workflowsCollection = {
    find: workflowsFindMock,
    findOne: workflowsFindOneMock,
    insertOne: workflowsInsertOneMock,
  };
  const statesCollection = {
    find: statesFindMock,
    insertOne: statesInsertOneMock,
  };
  const transitionsCollection = {
    find: transitionsFindMock,
    insertOne: transitionsInsertOneMock,
  };

  return {
    workflowsFindOneMock,
    workflowsInsertOneMock,
    workflowsToArrayMock,
    workflowsFindMock,
    statesInsertOneMock,
    statesToArrayMock,
    statesFindMock,
    transitionsInsertOneMock,
    transitionsToArrayMock,
    transitionsFindMock,
    workflowsCollection,
    statesCollection,
    transitionsCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_workflows") return mocks.workflowsCollection;
      if (name === "tz_workflow_states") return mocks.statesCollection;
      if (name === "tz_workflow_transitions") return mocks.transitionsCollection;
      throw new Error("Unexpected collection: " + name);
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

  it("listWorkflowsByWorkspace returns empty for missing workspace and rows when present", async () => {
    expect(await listWorkflowsByWorkspace("")).toEqual({ workflows: [] });

    const now = new Date().toISOString();
    const id = new ObjectId();
    mocks.workflowsToArrayMock.mockResolvedValueOnce([
      { _id: id, workspaceId: "ws1", name: "Sell Flow", type: "sell", createdAt: now, updatedAt: now },
    ]);

    const result = await listWorkflowsByWorkspace("ws1");
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0]._id).toBe(id.toHexString());
  });

  it("getWorkflowWithStatesAndTransitions handles invalid/missing workflow", async () => {
    expect(await getWorkflowWithStatesAndTransitions("bad")).toBeNull();

    mocks.workflowsFindOneMock.mockResolvedValueOnce(null);
    expect(await getWorkflowWithStatesAndTransitions(new ObjectId().toHexString())).toBeNull();
  });

  it("getWorkflowWithStatesAndTransitions returns mapped detail", async () => {
    const workflowId = new ObjectId();
    const state1 = new ObjectId();
    const state2 = new ObjectId();
    const transition = new ObjectId();
    const now = new Date().toISOString();

    mocks.workflowsFindOneMock.mockResolvedValueOnce({
      _id: workflowId,
      workspaceId: "ws1",
      name: "Flow",
      type: "sell",
      createdAt: now,
      updatedAt: now,
    });
    mocks.statesToArrayMock.mockResolvedValueOnce([
      { _id: state1, workflowId: workflowId.toHexString(), code: "new", label: "New", order: 1, reversible: true },
      { _id: state2, workflowId: workflowId.toHexString(), code: "offer", label: "Offer", order: 2, apartmentLock: "hard" },
    ]);
    mocks.transitionsToArrayMock.mockResolvedValueOnce([
      { _id: transition, workflowId: workflowId.toHexString(), fromStateId: state1.toHexString(), toStateId: state2.toHexString(), createdAt: now },
    ]);

    const detail = await getWorkflowWithStatesAndTransitions(workflowId.toHexString());

    expect(detail).not.toBeNull();
    expect(detail?.states).toHaveLength(2);
    expect(detail?.transitions[0].fromStateId).toBe(state1.toHexString());
  });

  it("getWorkflowForWorkspaceAndType returns null when missing", async () => {
    expect(await getWorkflowForWorkspaceAndType("", "sell")).toBeNull();
    mocks.workflowsFindOneMock.mockResolvedValueOnce(null);
    expect(await getWorkflowForWorkspaceAndType("ws1", "sell")).toBeNull();
  });

  it("validation helpers compute and verify transitions", async () => {
    const detail = {
      workflow: {
        _id: "wf1",
        workspaceId: "ws1",
        name: "Flow",
        type: "sell" as const,
        createdAt: "x",
        updatedAt: "x",
      },
      states: [
        {
          _id: "s1",
          workflowId: "wf1",
          code: "new",
          label: "New",
          order: 1,
          terminal: false,
          reversible: true,
          apartmentLock: "none" as const,
          createdAt: "x",
          updatedAt: "x",
        },
        {
          _id: "s2",
          workflowId: "wf1",
          code: "offer",
          label: "Offer",
          order: 2,
          terminal: false,
          reversible: true,
          apartmentLock: "soft" as const,
          createdAt: "x",
          updatedAt: "x",
        },
      ],
      transitions: [{ _id: "t1", workflowId: "wf1", fromStateId: "s1", toStateId: "s2", createdAt: "x" }],
    };

    const config = buildValidationConfig(detail);
    expect(isTransitionAllowed(config, "new", "offer")).toBe(true);
    expect(isTransitionAllowed(config, "offer", "new")).toBe(false);
    expect(getStateByCode(detail, "offer")?._id).toBe("s2");
    expect(getStateByCode(detail, "missing")).toBeNull();
  });

  it("isTransitionAllowedForWorkspace returns null when no workflow detail", async () => {
    mocks.workflowsFindOneMock.mockResolvedValueOnce(null);
    expect(await isTransitionAllowedForWorkspace("ws1", "sell", "new", "offer")).toBeNull();
  });

  it("createWorkflow/state/transition persist docs and map rows", async () => {
    const workflowId = new ObjectId();
    const stateId = new ObjectId();
    const transitionId = new ObjectId();

    mocks.workflowsInsertOneMock.mockResolvedValueOnce({ insertedId: workflowId });
    mocks.statesInsertOneMock.mockResolvedValueOnce({ insertedId: stateId });
    mocks.transitionsInsertOneMock.mockResolvedValueOnce({ insertedId: transitionId });

    const wf = await createWorkflow({ workspaceId: "ws1", name: "Flow", type: "sell" });
    const st = await createWorkflowState({ workflowId: workflowId.toHexString(), code: "new", label: "New", order: 1, apartmentLock: "soft" });
    const tr = await createWorkflowTransition({ workflowId: workflowId.toHexString(), fromStateId: stateId.toHexString(), toStateId: transitionId.toHexString() });

    expect(wf.workflow._id).toBe(workflowId.toHexString());
    expect(st.state.apartmentLock).toBe("soft");
    expect(tr.transition._id).toBe(transitionId.toHexString());
  });
});
