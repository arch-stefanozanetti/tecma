import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const {
  requestsFindToArrayMock,
  requestsCountDocumentsMock,
  requestsFindOneMock,
  requestsInsertOneMock,
  requestsUpdateOneMock,
  transitionsFindToArrayMock,
  transitionsFindOneMock,
  transitionsInsertOneMock,
  clientsFindToArrayMock,
  clientsFindOneMock,
  apartmentsFindToArrayMock,
  apartmentsFindOneMock,
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
  withTransactionMock,
  endSessionMock,
} = vi.hoisted(() => ({
  requestsFindToArrayMock: vi.fn(),
  requestsCountDocumentsMock: vi.fn(),
  requestsFindOneMock: vi.fn(),
  requestsInsertOneMock: vi.fn(),
  requestsUpdateOneMock: vi.fn(),
  transitionsFindToArrayMock: vi.fn(),
  transitionsFindOneMock: vi.fn(),
  transitionsInsertOneMock: vi.fn(),
  clientsFindToArrayMock: vi.fn(),
  clientsFindOneMock: vi.fn(),
  apartmentsFindToArrayMock: vi.fn(),
  apartmentsFindOneMock: vi.fn(),
  isTransitionAllowedForWorkspaceMock: vi.fn(),
  getWorkflowForWorkspaceAndTypeMock: vi.fn(),
  getStateByCodeMock: vi.fn(),
  getActiveLockForApartmentMock: vi.fn(),
  createLockMock: vi.fn(),
  removeLocksForRequestMock: vi.fn(),
  forceOtherRequestsOnApartmentToLostMock: vi.fn(),
  setApartmentStatusMock: vi.fn(),
  createContractMock: vi.fn(),
  setInventoryStatusMock: vi.fn(),
  dispatchEventMock: vi.fn(),
  withTransactionMock: vi.fn(),
  endSessionMock: vi.fn(),
}));

const requestsFindMock = vi.fn(() => ({
  sort: vi.fn(() => ({
    skip: vi.fn(() => ({
      limit: vi.fn(() => ({ toArray: requestsFindToArrayMock })),
    })),
  })),
}));
const transitionsFindMock = vi.fn(() => ({
  sort: vi.fn(() => ({ toArray: transitionsFindToArrayMock })),
  toArray: transitionsFindToArrayMock,
}));
const clientsFindMock = vi.fn(() => ({
  project: vi.fn(() => ({ toArray: clientsFindToArrayMock })),
}));
const apartmentsFindMock = vi.fn(() => ({
  project: vi.fn(() => ({ toArray: apartmentsFindToArrayMock })),
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_requests") {
        return {
          find: requestsFindMock,
          countDocuments: requestsCountDocumentsMock,
          findOne: requestsFindOneMock,
          insertOne: requestsInsertOneMock,
          updateOne: requestsUpdateOneMock,
        };
      }
      if (name === "tz_request_transitions") {
        return {
          find: transitionsFindMock,
          findOne: transitionsFindOneMock,
          insertOne: transitionsInsertOneMock,
        };
      }
      if (name === "tz_clients") {
        return {
          find: clientsFindMock,
          findOne: clientsFindOneMock,
        };
      }
      if (name === "tz_apartments") {
        return {
          find: apartmentsFindMock,
          findOne: apartmentsFindOneMock,
        };
      }
      return {};
    },
  }),
  getMongoClient: () => ({
    startSession: () => ({
      withTransaction: withTransactionMock,
      endSession: endSessionMock,
    }),
  }),
}));

vi.mock("../workflow/workflow-engine.service.js", () => ({
  isTransitionAllowedForWorkspace: isTransitionAllowedForWorkspaceMock,
  getWorkflowForWorkspaceAndType: getWorkflowForWorkspaceAndTypeMock,
  getStateByCode: getStateByCodeMock,
}));

vi.mock("../workflow/apartment-lock.service.js", () => ({
  getActiveLockForApartment: getActiveLockForApartmentMock,
  createLock: createLockMock,
  removeLocksForRequest: removeLocksForRequestMock,
  forceOtherRequestsOnApartmentToLost: forceOtherRequestsOnApartmentToLostMock,
  setApartmentStatus: setApartmentStatusMock,
}));

vi.mock("../contracts/contracts.service.js", () => ({
  createContract: createContractMock,
}));

vi.mock("../inventory/inventory.service.js", () => ({
  setInventoryStatus: setInventoryStatusMock,
}));

vi.mock("../automations/automation-events.service.js", () => ({
  dispatchEvent: dispatchEventMock,
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
    withTransactionMock.mockImplementation(async (cb: () => Promise<void>) => cb());
    endSessionMock.mockResolvedValue(undefined);
    isTransitionAllowedForWorkspaceMock.mockResolvedValue(null);
    getWorkflowForWorkspaceAndTypeMock.mockResolvedValue(null);
    getStateByCodeMock.mockReturnValue(null);
    getActiveLockForApartmentMock.mockResolvedValue(null);
    removeLocksForRequestMock.mockResolvedValue(undefined);
  });

  it("queryRequests returns enriched clientName and apartmentCode", async () => {
    const requestId = new ObjectId("64b64f3fd9024a2a53111111");
    const clientId = new ObjectId("64b64f3fd9024a2a53222222");
    const apartmentId = new ObjectId("64b64f3fd9024a2a53333333");
    requestsFindToArrayMock.mockResolvedValueOnce([
      {
        _id: requestId,
        workspaceId: "ws1",
        projectId: "p1",
        clientId: clientId.toHexString(),
        apartmentId: apartmentId.toHexString(),
        type: "sell",
        status: "new",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);
    requestsCountDocumentsMock.mockResolvedValueOnce(1);
    clientsFindToArrayMock.mockResolvedValueOnce([{ _id: clientId, fullName: "Mario Rossi" }]);
    apartmentsFindToArrayMock.mockResolvedValueOnce([{ _id: apartmentId, code: "A-100" }]);

    const result = await queryRequests({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data[0].clientName).toBe("Mario Rossi");
    expect(result.data[0].apartmentCode).toBe("A-100");
  });

  it("getRequestById throws 404 on invalid id", async () => {
    await expect(getRequestById("bad-id")).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("createRequest inserts and returns enriched row", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111111");
    const clientId = new ObjectId("64b64f3fd9024a2a53222222");
    const apartmentId = new ObjectId("64b64f3fd9024a2a53333333");
    requestsInsertOneMock.mockResolvedValueOnce({ insertedId });
    requestsFindOneMock.mockResolvedValueOnce({
      _id: insertedId,
      workspaceId: "ws1",
      projectId: "p1",
      clientId: clientId.toHexString(),
      apartmentId: apartmentId.toHexString(),
      type: "sell",
      status: "new",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    clientsFindOneMock.mockResolvedValueOnce({ fullName: "Client 1" });
    apartmentsFindOneMock.mockResolvedValueOnce({ code: "APT-1" });

    const result = await createRequest({
      workspaceId: "ws1",
      projectId: "p1",
      clientId: clientId.toHexString(),
      apartmentId: apartmentId.toHexString(),
      type: "sell",
      status: "new",
    });

    expect(result.request._id).toBe(insertedId.toHexString());
    expect(result.request.clientName).toBe("Client 1");
    expect(result.request.apartmentCode).toBe("APT-1");
  });

  it("updateRequestStatus performs transition and writes timeline", async () => {
    const requestId = new ObjectId("64b64f3fd9024a2a53111111").toHexString();
    requestsFindOneMock
      .mockResolvedValueOnce({
        _id: new ObjectId(requestId),
        workspaceId: "ws1",
        projectId: "p1",
        clientId: "c1",
        apartmentId: undefined,
        type: "sell",
        status: "new",
      })
      .mockResolvedValueOnce({
        _id: new ObjectId(requestId),
        workspaceId: "ws1",
        projectId: "p1",
        clientId: "c1",
        apartmentId: undefined,
        type: "sell",
        status: "contacted",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    clientsFindOneMock.mockResolvedValueOnce(null);
    apartmentsFindOneMock.mockResolvedValueOnce(null);
    transitionsInsertOneMock.mockResolvedValueOnce({ insertedId: new ObjectId() });
    requestsUpdateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

    const result = await updateRequestStatus(requestId, { status: "contacted" }, { userId: "u1" });

    expect(result.request.status).toBe("contacted");
    expect(requestsUpdateOneMock).toHaveBeenCalledOnce();
    expect(transitionsInsertOneMock).toHaveBeenCalledOnce();
  });

  it("listRequestTransitions returns mapped rows", async () => {
    const requestId = new ObjectId("64b64f3fd9024a2a53111111").toHexString();
    transitionsFindToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId("64b64f3fd9024a2a53222222"),
        requestId,
        fromState: "new",
        toState: "contacted",
        event: "TRANSITION",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const result = await listRequestTransitions(requestId);

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].toState).toBe("contacted");
  });

  it("revertRequestStatus returns 400 when current status does not match transition toState", async () => {
    const requestId = new ObjectId("64b64f3fd9024a2a53111111").toHexString();
    const transitionId = new ObjectId("64b64f3fd9024a2a53222222").toHexString();
    requestsFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId(requestId),
      status: "contacted",
      workspaceId: "ws1",
      type: "sell",
    });
    transitionsFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId(transitionId),
      requestId,
      fromState: "new",
      toState: "offer",
    });

    await expect(revertRequestStatus(requestId, transitionId, { userId: "u1" })).rejects.toMatchObject({
      statusCode: 400,
    } as Partial<HttpError>);
  });
});
