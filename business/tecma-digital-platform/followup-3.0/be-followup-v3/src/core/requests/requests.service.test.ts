import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const mocks = vi.hoisted(() => {
  const requestsFindOneMock = vi.fn();
  const requestsInsertOneMock = vi.fn();
  const requestsUpdateOneMock = vi.fn();
  const requestsCountDocumentsMock = vi.fn();
  const requestsToArrayMock = vi.fn();
  const requestsProjectMock = vi.fn(() => ({ toArray: requestsToArrayMock }));
  const requestsLimitMock = vi.fn(() => ({ project: requestsProjectMock, toArray: requestsToArrayMock }));
  const requestsSkipMock = vi.fn(() => ({ limit: requestsLimitMock, project: requestsProjectMock, toArray: requestsToArrayMock }));
  const requestsSortMock = vi.fn(() => ({ skip: requestsSkipMock, limit: requestsLimitMock, project: requestsProjectMock, toArray: requestsToArrayMock }));
  const requestsFindMock = vi.fn(() => ({
    sort: requestsSortMock,
    skip: requestsSkipMock,
    limit: requestsLimitMock,
    project: requestsProjectMock,
    toArray: requestsToArrayMock,
  }));

  const transitionsFindOneMock = vi.fn();
  const transitionsInsertOneMock = vi.fn();
  const transitionsToArrayMock = vi.fn();
  const transitionsSortMock = vi.fn(() => ({ toArray: transitionsToArrayMock }));
  const transitionsFindMock = vi.fn(() => ({ sort: transitionsSortMock }));

  const clientsFindOneMock = vi.fn();
  const clientsToArrayMock = vi.fn();
  const clientsProjectMock = vi.fn(() => ({ toArray: clientsToArrayMock }));
  const clientsFindMock = vi.fn(() => ({ project: clientsProjectMock, toArray: clientsToArrayMock }));

  const apartmentsFindOneMock = vi.fn();
  const apartmentsToArrayMock = vi.fn();
  const apartmentsProjectMock = vi.fn(() => ({ toArray: apartmentsToArrayMock }));
  const apartmentsFindMock = vi.fn(() => ({ project: apartmentsProjectMock, toArray: apartmentsToArrayMock }));

  const withTransactionMock = vi.fn(async (fn: () => Promise<void>) => {
    await fn();
  });
  const endSessionMock = vi.fn(async () => {});
  const startSessionMock = vi.fn(() => ({ withTransaction: withTransactionMock, endSession: endSessionMock }));

  const isTransitionAllowedForWorkspaceMock = vi.fn();
  const getWorkflowForWorkspaceAndTypeMock = vi.fn();
  const getStateByCodeMock = vi.fn();
  const getActiveLockForApartmentMock = vi.fn();
  const createLockMock = vi.fn();
  const removeLocksForRequestMock = vi.fn();
  const forceOtherRequestsOnApartmentToLostMock = vi.fn();
  const setApartmentStatusMock = vi.fn();
  const createContractMock = vi.fn();
  const setInventoryStatusMock = vi.fn();
  const dispatchEventMock = vi.fn(() => Promise.resolve());

  const requestsCollection = {
    find: requestsFindMock,
    findOne: requestsFindOneMock,
    insertOne: requestsInsertOneMock,
    updateOne: requestsUpdateOneMock,
    countDocuments: requestsCountDocumentsMock,
  };

  const transitionsCollection = {
    find: transitionsFindMock,
    findOne: transitionsFindOneMock,
    insertOne: transitionsInsertOneMock,
  };

  const clientsCollection = {
    find: clientsFindMock,
    findOne: clientsFindOneMock,
  };

  const apartmentsCollection = {
    find: apartmentsFindMock,
    findOne: apartmentsFindOneMock,
  };

  return {
    requestsFindOneMock,
    requestsInsertOneMock,
    requestsUpdateOneMock,
    requestsCountDocumentsMock,
    requestsToArrayMock,
    transitionsFindOneMock,
    transitionsInsertOneMock,
    transitionsToArrayMock,
    clientsFindOneMock,
    clientsToArrayMock,
    apartmentsFindOneMock,
    apartmentsToArrayMock,
    withTransactionMock,
    endSessionMock,
    startSessionMock,
    isTransitionAllowedForWorkspaceMock,
    getWorkflowForWorkspaceAndTypeMock,
    getStateByCodeMock,
    getActiveLockForApartmentMock,
    createLockMock,
    removeLocksForRequestMock,
    forceOtherRequestsOnApartmentToLostMock,
    setApartmentStatusMock,
    createContractMock,
    setInventoryStatusMock,
    dispatchEventMock,
    requestsCollection,
    transitionsCollection,
    clientsCollection,
    apartmentsCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_requests") return mocks.requestsCollection;
      if (name === "tz_request_transitions") return mocks.transitionsCollection;
      if (name === "tz_clients") return mocks.clientsCollection;
      if (name === "tz_apartments") return mocks.apartmentsCollection;
      throw new Error("Unexpected collection: " + name);
    },
  }),
  getMongoClient: () => ({ startSession: mocks.startSessionMock }),
}));

vi.mock("../workflow/workflow-engine.service.js", () => ({
  isTransitionAllowedForWorkspace: mocks.isTransitionAllowedForWorkspaceMock,
  getWorkflowForWorkspaceAndType: mocks.getWorkflowForWorkspaceAndTypeMock,
  getStateByCode: mocks.getStateByCodeMock,
}));

vi.mock("../workflow/apartment-lock.service.js", () => ({
  getActiveLockForApartment: mocks.getActiveLockForApartmentMock,
  createLock: mocks.createLockMock,
  removeLocksForRequest: mocks.removeLocksForRequestMock,
  forceOtherRequestsOnApartmentToLost: mocks.forceOtherRequestsOnApartmentToLostMock,
  setApartmentStatus: mocks.setApartmentStatusMock,
}));

vi.mock("../contracts/contracts.service.js", () => ({
  createContract: mocks.createContractMock,
}));

vi.mock("../inventory/inventory.service.js", () => ({
  setInventoryStatus: mocks.setInventoryStatusMock,
}));

vi.mock("../automations/automation-events.service.js", () => ({
  dispatchEvent: mocks.dispatchEventMock,
}));

import {
  createRequest,
  getRequestById,
  listRequestTransitions,
  queryRequests,
  revertRequestStatus,
  updateRequestStatus,
} from "./requests.service.js";

describe("requests.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTransitionAllowedForWorkspaceMock.mockResolvedValue(undefined);
    mocks.getWorkflowForWorkspaceAndTypeMock.mockResolvedValue(null);
    mocks.getStateByCodeMock.mockReturnValue(null);
    mocks.getActiveLockForApartmentMock.mockResolvedValue(null);
  });

  it("queryRequests returns data enriched with clientName and apartmentCode", async () => {
    const requestId = new ObjectId();
    const clientId = new ObjectId();
    const apartmentId = new ObjectId();
    const now = new Date().toISOString();

    mocks.requestsToArrayMock.mockResolvedValueOnce([
      {
        _id: requestId,
        projectId: "p1",
        workspaceId: "ws1",
        clientId: clientId.toHexString(),
        apartmentId: apartmentId.toHexString(),
        type: "sell",
        status: "new",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mocks.requestsCountDocumentsMock.mockResolvedValueOnce(1);
    mocks.clientsToArrayMock.mockResolvedValueOnce([{ _id: clientId, fullName: "Mario Rossi" }]);
    mocks.apartmentsToArrayMock.mockResolvedValueOnce([{ _id: apartmentId, code: "A-11" }]);

    const result = await queryRequests({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      filters: { status: ["new"], type: ["sell"] },
      searchText: clientId.toHexString(),
      sort: { field: "updatedAt", direction: -1 },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].clientName).toBe("Mario Rossi");
    expect(result.data[0].apartmentCode).toBe("A-11");
    expect(result.pagination.total).toBe(1);
  });

  it("getRequestById throws 404 on invalid id", async () => {
    await expect(getRequestById("bad-id")).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("getRequestById returns fallback identifiers when related docs are missing", async () => {
    const requestId = new ObjectId();
    const clientId = new ObjectId();
    const apartmentId = new ObjectId();
    const now = new Date().toISOString();

    mocks.requestsFindOneMock.mockResolvedValueOnce({
      _id: requestId,
      projectId: "p1",
      workspaceId: "ws1",
      clientId: clientId.toHexString(),
      apartmentId: apartmentId.toHexString(),
      type: "rent",
      status: "contacted",
      createdAt: now,
      updatedAt: now,
    });
    mocks.clientsFindOneMock.mockResolvedValueOnce(null);
    mocks.apartmentsFindOneMock.mockResolvedValueOnce(null);

    const result = await getRequestById(requestId.toHexString());

    expect(result.request.clientName).toBe(clientId.toHexString());
    expect(result.request.apartmentCode).toBe(apartmentId.toHexString());
  });

  it("createRequest inserts and returns enriched request", async () => {
    const insertedId = new ObjectId();
    const clientId = new ObjectId();
    const apartmentId = new ObjectId();

    mocks.requestsInsertOneMock.mockResolvedValueOnce({ insertedId });
    mocks.requestsFindOneMock.mockResolvedValueOnce({
      _id: insertedId,
      projectId: "p1",
      workspaceId: "ws1",
      clientId: clientId.toHexString(),
      apartmentId: apartmentId.toHexString(),
      type: "sell",
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mocks.clientsFindOneMock.mockResolvedValueOnce({ fullName: "Cliente" });
    mocks.apartmentsFindOneMock.mockResolvedValueOnce({ code: "APT-1" });

    const result = await createRequest({
      workspaceId: "ws1",
      projectId: "p1",
      clientId: clientId.toHexString(),
      apartmentId: apartmentId.toHexString(),
      type: "sell",
      status: "new",
      quoteId: "not-valid-object-id",
      clientRole: "buyer",
    });

    expect(mocks.requestsInsertOneMock).toHaveBeenCalledOnce();
    expect(result.request.clientName).toBeTruthy();
    expect([clientId.toHexString(), "Cliente"]).toContain(result.request.clientName);
    expect(result.request.apartmentCode).toBeTruthy();
    expect([apartmentId.toHexString(), "APT-1"]).toContain(result.request.apartmentCode);
  });

  it("updateRequestStatus throws 400 when transition is forbidden by workflow", async () => {
    const requestId = new ObjectId();
    mocks.requestsFindOneMock.mockResolvedValueOnce({
      _id: requestId,
      workspaceId: "ws1",
      projectId: "p1",
      clientId: new ObjectId().toHexString(),
      apartmentId: new ObjectId().toHexString(),
      type: "sell",
      status: "new",
    });
    mocks.isTransitionAllowedForWorkspaceMock.mockResolvedValueOnce(false);

    await expect(
      updateRequestStatus(requestId.toHexString(), { status: "won" }, { userId: "u1" })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<HttpError>);
  });

  it("updateRequestStatus updates request and writes transition in transaction", async () => {
    const requestId = new ObjectId();
    const clientId = new ObjectId();
    const apartmentId = new ObjectId();
    const now = new Date().toISOString();

    mocks.requestsFindOneMock
      .mockResolvedValueOnce({
        _id: requestId,
        workspaceId: "ws1",
        projectId: "p1",
        clientId: clientId.toHexString(),
        apartmentId: apartmentId.toHexString(),
        type: "sell",
        status: "new",
      })
      .mockResolvedValueOnce({
        _id: requestId,
        workspaceId: "ws1",
        projectId: "p1",
        clientId: clientId.toHexString(),
        apartmentId: apartmentId.toHexString(),
        type: "sell",
        status: "contacted",
        createdAt: now,
        updatedAt: now,
      });
    mocks.clientsFindOneMock.mockResolvedValueOnce({ fullName: "Mario" });
    mocks.apartmentsFindOneMock.mockResolvedValueOnce({ code: "B-7" });

    const result = await updateRequestStatus(
      requestId.toHexString(),
      { status: "contacted", reason: "first touch" },
      { userId: "u1" }
    );

    expect(mocks.withTransactionMock).toHaveBeenCalledOnce();
    expect(mocks.requestsUpdateOneMock).toHaveBeenCalledOnce();
    expect(mocks.transitionsInsertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: requestId.toHexString(), toState: "contacted" }),
      expect.any(Object)
    );
    expect(mocks.removeLocksForRequestMock).toHaveBeenCalledOnce();
    expect(result.request.status).toBe("contacted");
  });

  it("listRequestTransitions returns mapped rows", async () => {
    const requestId = new ObjectId();
    const transitionId = new ObjectId();
    mocks.transitionsToArrayMock.mockResolvedValueOnce([
      {
        _id: transitionId,
        requestId: requestId.toHexString(),
        fromState: "new",
        toState: "contacted",
        event: "TRANSITION_TO_CONTACTED",
        reason: "test",
        userId: "u1",
        createdAt: new Date(),
      },
    ]);

    const result = await listRequestTransitions(requestId.toHexString());

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0]._id).toBe(transitionId.toHexString());
    expect(result.transitions[0].toState).toBe("contacted");
  });

  it("revertRequestStatus validates current state against selected transition", async () => {
    const requestId = new ObjectId();
    const transitionId = new ObjectId();

    mocks.requestsFindOneMock.mockResolvedValueOnce({ _id: requestId, status: "offer", workspaceId: "ws1", type: "sell" });
    mocks.transitionsFindOneMock.mockResolvedValueOnce({
      _id: transitionId,
      requestId: requestId.toHexString(),
      fromState: "new",
      toState: "contacted",
    });

    await expect(
      revertRequestStatus(requestId.toHexString(), transitionId.toHexString(), { userId: "u1" })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<HttpError>);
  });
});
