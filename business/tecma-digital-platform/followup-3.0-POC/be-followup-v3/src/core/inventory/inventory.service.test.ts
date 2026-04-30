import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const createIndexMock = vi.fn();
  const findOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const insertOneMock = vi.fn();

  const collectionMock = {
    createIndex: createIndexMock,
    findOne: findOneMock,
    updateOne: updateOneMock,
    insertOne: insertOneMock,
  };

  return {
    findOneMock,
    updateOneMock,
    insertOneMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

import {
  createInventoryForUnit,
  getInventoryByUnitId,
  setInventoryStatus,
  upsertInventoryFromApartmentStatus,
} from "./inventory.service.js";

describe("inventory.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOneMock.mockResolvedValue(null);
    mocks.insertOneMock.mockResolvedValue({ insertedId: new ObjectId() });
    mocks.updateOneMock.mockResolvedValue({ acknowledged: true });
  });

  it("returns null for invalid unit id in get", async () => {
    await expect(getInventoryByUnitId("bad-id")).resolves.toBeNull();
    expect(mocks.findOneMock).not.toHaveBeenCalled();
  });

  it("throws when required params are missing", async () => {
    await expect(setInventoryStatus("", "", "available")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("updates existing row when present", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({ _id: id });

    await expect(setInventoryStatus("507f1f77bcf86cd799439011", "ws1", "reserved", "r1")).resolves.toEqual(
      expect.objectContaining({ _id: id.toHexString(), inventoryStatus: "reserved", requestId: "r1" })
    );
    expect(mocks.updateOneMock).toHaveBeenCalled();
    expect(mocks.insertOneMock).not.toHaveBeenCalled();
  });

  it("inserts when row does not exist and maps apartment statuses", async () => {
    const insertedId = new ObjectId();
    mocks.insertOneMock.mockResolvedValueOnce({ insertedId });

    await expect(createInventoryForUnit("507f1f77bcf86cd799439011", "ws1")).resolves.toEqual(
      expect.objectContaining({ _id: insertedId.toHexString(), inventoryStatus: "available" })
    );

    const secondId = new ObjectId();
    mocks.insertOneMock.mockResolvedValueOnce({ insertedId: secondId });
    await expect(upsertInventoryFromApartmentStatus("507f1f77bcf86cd799439012", "ws1", "RENTED")).resolves.toEqual(
      expect.objectContaining({ inventoryStatus: "reserved" })
    );
  });
});
