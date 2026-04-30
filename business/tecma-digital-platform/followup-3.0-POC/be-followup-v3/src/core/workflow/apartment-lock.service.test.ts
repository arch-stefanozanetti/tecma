import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const lockFindOneMock = vi.fn();
  const lockInsertOneMock = vi.fn();
  const lockFindToArrayMock = vi.fn();
  const lockFindMock = vi.fn(() => ({ toArray: lockFindToArrayMock }));
  const lockDeleteManyMock = vi.fn();

  const requestsFindToArrayMock = vi.fn();
  const requestsFindMock = vi.fn(() => ({ toArray: requestsFindToArrayMock }));
  const requestsUpdateOneMock = vi.fn();

  const transitionsInsertOneMock = vi.fn();
  const apartmentsUpdateOneMock = vi.fn();

  const setInventoryStatusMock = vi.fn();

  return {
    lockFindOneMock,
    lockInsertOneMock,
    lockFindToArrayMock,
    lockFindMock,
    lockDeleteManyMock,
    requestsFindToArrayMock,
    requestsFindMock,
    requestsUpdateOneMock,
    transitionsInsertOneMock,
    apartmentsUpdateOneMock,
    setInventoryStatusMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_apartment_locks") {
        return {
          findOne: mocks.lockFindOneMock,
          insertOne: mocks.lockInsertOneMock,
          find: mocks.lockFindMock,
          deleteMany: mocks.lockDeleteManyMock,
        };
      }
      if (name === "tz_requests") {
        return {
          find: mocks.requestsFindMock,
          updateOne: mocks.requestsUpdateOneMock,
        };
      }
      if (name === "tz_request_transitions") {
        return { insertOne: mocks.transitionsInsertOneMock };
      }
      if (name === "tz_apartments") {
        return { updateOne: mocks.apartmentsUpdateOneMock };
      }
      throw new Error("Unexpected collection: " + name);
    },
  }),
}));

vi.mock("../inventory/inventory.service.js", () => ({
  setInventoryStatus: mocks.setInventoryStatusMock,
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

  it("getActiveLockForApartment handles invalid, missing and found", async () => {
    expect(await getActiveLockForApartment("bad")).toBeNull();

    mocks.lockFindOneMock.mockResolvedValueOnce(null);
    expect(await getActiveLockForApartment(new ObjectId().toHexString())).toBeNull();

    mocks.lockFindOneMock.mockResolvedValueOnce({ requestId: "r1", type: "hard" });
    await expect(getActiveLockForApartment(new ObjectId().toHexString())).resolves.toEqual({
      requestId: "r1",
      type: "hard",
    });
  });

  it("createLock inserts and updates inventory", async () => {
    await createLock(null, {
      workspaceId: "ws1",
      apartmentId: new ObjectId().toHexString(),
      requestId: "r1",
      type: "soft",
      workflowStateId: "s1",
    });

    expect(mocks.lockInsertOneMock).toHaveBeenCalledOnce();
    expect(mocks.setInventoryStatusMock).toHaveBeenCalledWith(expect.any(String), "ws1", "locked", "r1");
  });

  it("removeLocksForRequest deletes and restores inventory", async () => {
    mocks.lockFindToArrayMock.mockResolvedValueOnce([
      { apartmentId: "a1", workspaceId: "ws1" },
      { apartmentId: "a2", workspaceId: "ws1" },
    ]);
    mocks.lockDeleteManyMock.mockResolvedValueOnce({ deletedCount: 2 });

    const deleted = await removeLocksForRequest(null, "r1");

    expect(deleted).toBe(2);
    expect(mocks.setInventoryStatusMock).toHaveBeenCalledWith("a1", "ws1", "available");
    expect(mocks.setInventoryStatusMock).toHaveBeenCalledWith("a2", "ws1", "available");
  });

  it("forceOtherRequestsOnApartmentToLost updates requests/transitions/locks", async () => {
    const r1 = new ObjectId();
    const r2 = new ObjectId();
    mocks.requestsFindToArrayMock.mockResolvedValueOnce([
      { _id: r1, status: "new" },
      { _id: r2, status: "viewing" },
    ]);

    await forceOtherRequestsOnApartmentToLost(null, {
      apartmentId: "a1",
      excludingRequestId: new ObjectId().toHexString(),
      lostStatus: "lost",
      now: new Date().toISOString(),
    });

    expect(mocks.requestsUpdateOneMock).toHaveBeenCalledTimes(2);
    expect(mocks.transitionsInsertOneMock).toHaveBeenCalledTimes(2);
    expect(mocks.lockDeleteManyMock).toHaveBeenCalledTimes(2);
  });

  it("setApartmentStatus no-op on invalid id and updates valid id", async () => {
    await setApartmentStatus(null, "bad", "SOLD");
    expect(mocks.apartmentsUpdateOneMock).not.toHaveBeenCalled();

    await setApartmentStatus(null, new ObjectId().toHexString(), "SOLD");
    expect(mocks.apartmentsUpdateOneMock).toHaveBeenCalledOnce();
  });
});
