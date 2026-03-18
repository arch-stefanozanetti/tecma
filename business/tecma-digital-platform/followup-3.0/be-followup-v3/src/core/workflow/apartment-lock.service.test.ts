import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const findOneMock = vi.fn();
const insertOneMock = vi.fn();
const findToArrayMock = vi.fn();
const deleteManyMock = vi.fn();
const updateOneMock = vi.fn();
const requestsToArrayMock = vi.fn();
const requestsFindMock = vi.fn(() => ({ toArray: requestsToArrayMock }));

const locksFindMock = vi.fn(() => ({ toArray: findToArrayMock }));

const setInventoryStatusMock = vi.fn();

vi.mock("../inventory/inventory.service.js", () => ({
  setInventoryStatus: setInventoryStatusMock,
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_apartment_locks") {
        return {
          findOne: findOneMock,
          find: locksFindMock,
          insertOne: insertOneMock,
          deleteMany: deleteManyMock,
        };
      }
      if (name === "tz_apartments") {
        return { updateOne: updateOneMock };
      }
      if (name === "tz_requests") {
        return { find: requestsFindMock, updateOne: updateOneMock };
      }
      if (name === "tz_request_transitions") {
        return { insertOne: insertOneMock };
      }
      return { findOne: vi.fn(), find: vi.fn(), insertOne: vi.fn(), deleteMany: vi.fn(), updateOne: vi.fn() };
    },
  }),
}));

import {
  createLock,
  forceOtherRequestsOnApartmentToLost,
  getActiveLockForApartment,
  removeLocksForRequest,
  setApartmentStatus,
} from "./apartment-lock.service.js";

describe("apartment-lock.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null on invalid apartment id", async () => {
    const result = await getActiveLockForApartment("bad-id");
    expect(result).toBeNull();
  });

  it("returns active lock payload", async () => {
    findOneMock.mockResolvedValueOnce({ requestId: "req1", type: "hard" });
    const result = await getActiveLockForApartment("64b64f3fd9024a2a53111111");
    expect(result).toEqual({ requestId: "req1", type: "hard" });
  });

  it("creates lock and syncs inventory", async () => {
    await createLock(null, {
      workspaceId: "ws1",
      apartmentId: "apt1",
      requestId: "req1",
      type: "soft",
    });

    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(setInventoryStatusMock).toHaveBeenCalledWith("apt1", "ws1", "locked", "req1");
  });

  it("removes locks and sets inventory available", async () => {
    findToArrayMock.mockResolvedValueOnce([{ apartmentId: "apt1", workspaceId: "ws1" }]);
    deleteManyMock.mockResolvedValueOnce({ deletedCount: 1 });

    const deleted = await removeLocksForRequest(null, "req1");

    expect(deleted).toBe(1);
    expect(setInventoryStatusMock).toHaveBeenCalledWith("apt1", "ws1", "available");
  });

  it("forces other requests to lost and clears their locks", async () => {
    requestsToArrayMock.mockResolvedValueOnce([
      { _id: new ObjectId("64b64f3fd9024a2a53111112"), status: "negotiation" },
    ]);

    await forceOtherRequestsOnApartmentToLost(null, {
      apartmentId: "apt1",
      excludingRequestId: "64b64f3fd9024a2a53111111",
      lostStatus: "lost",
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(updateOneMock).toHaveBeenCalled();
    expect(insertOneMock).toHaveBeenCalled();
    expect(deleteManyMock).toHaveBeenCalled();
  });

  it("setApartmentStatus no-op on invalid id", async () => {
    await setApartmentStatus(null, "bad-id", "sold");
    expect(updateOneMock).not.toHaveBeenCalled();
  });
});
