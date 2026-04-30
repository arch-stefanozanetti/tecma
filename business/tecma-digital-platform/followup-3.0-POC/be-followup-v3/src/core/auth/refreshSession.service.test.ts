import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertOneMock = vi.fn();
  const findOneMock = vi.fn();
  const deleteManyMock = vi.fn();
  const updateManyMock = vi.fn();
  const collectionMock = {
    insertOne: insertOneMock,
    findOne: findOneMock,
    deleteMany: deleteManyMock,
    updateMany: updateManyMock,
  };

  return {
    insertOneMock,
    findOneMock,
    deleteManyMock,
    updateManyMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

import {
  createSession,
  deleteSession,
  deleteSessionsByUser,
  generateRefreshToken,
  getSession,
  revokeSessionsByUser,
} from "./refreshSession.service.js";

describe("refreshSession.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateRefreshToken returns 64-char hex", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("createSession stores hashed token and returns raw token", async () => {
    mocks.insertOneMock.mockResolvedValue({ acknowledged: true });

    const token = await createSession("user-1", "u@example.com");

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.insertOneMock).toHaveBeenCalledOnce();
    const insertedDoc = mocks.insertOneMock.mock.calls[0]?.[0] as { tokenHash: string; userId: string; email: string };
    expect(insertedDoc.userId).toBe("user-1");
    expect(insertedDoc.email).toBe("u@example.com");
    expect(insertedDoc.tokenHash).toHaveLength(64);
    expect(insertedDoc.tokenHash).not.toBe(token);
  });

  it("getSession queries by hash/legacy token and not revoked", async () => {
    mocks.findOneMock.mockResolvedValue({ userId: "user-1" });

    const result = await getSession("raw-refresh-token");

    expect(result).toEqual({ userId: "user-1" });
    expect(mocks.findOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked: { $ne: true },
        $or: expect.any(Array),
      })
    );
  });

  it("deleteSession returns true when any session deleted", async () => {
    mocks.deleteManyMock.mockResolvedValueOnce({ deletedCount: 2 });
    await expect(deleteSession("raw-refresh-token")).resolves.toBe(true);

    mocks.deleteManyMock.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(deleteSession("raw-refresh-token")).resolves.toBe(false);
  });

  it("deleteSessionsByUser and revokeSessionsByUser return counts", async () => {
    mocks.deleteManyMock.mockResolvedValueOnce({ deletedCount: 3 });
    mocks.updateManyMock.mockResolvedValueOnce({ modifiedCount: 4 });

    await expect(deleteSessionsByUser("user-1")).resolves.toBe(3);
    await expect(revokeSessionsByUser("user-1")).resolves.toBe(4);
  });
});
