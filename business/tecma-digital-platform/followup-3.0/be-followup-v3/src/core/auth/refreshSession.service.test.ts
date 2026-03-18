import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OptionalId } from "mongodb";

const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const deleteManyMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("../../config/env.js", () => ({
  ENV: {
    AUTH_REFRESH_EXPIRES_DAYS: 7,
  },
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      insertOne: insertOneMock,
      findOne: findOneMock,
      deleteMany: deleteManyMock,
      updateMany: updateManyMock,
    }),
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

  it("generates opaque refresh token", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates and returns token", async () => {
    insertOneMock.mockResolvedValueOnce({ acknowledged: true });
    const token = await createSession("u1", "u@example.com");
    expect(typeof token).toBe("string");
    expect(insertOneMock).toHaveBeenCalledTimes(1);
    const inserted = insertOneMock.mock.calls[0][0] as OptionalId<{ tokenHash?: string; userId: string }>;
    expect(inserted.userId).toBe("u1");
    expect(inserted.tokenHash).toBeTruthy();
  });

  it("reads session by token hash", async () => {
    findOneMock.mockResolvedValueOnce({ userId: "u1" });
    const session = await getSession("plain-token");
    expect(session).toMatchObject({ userId: "u1" });
    expect(findOneMock).toHaveBeenCalledTimes(1);
  });

  it("deletes single session by token", async () => {
    deleteManyMock.mockResolvedValueOnce({ deletedCount: 1 });
    const deleted = await deleteSession("plain-token");
    expect(deleted).toBe(true);
  });

  it("deletes and revokes by user", async () => {
    deleteManyMock.mockResolvedValueOnce({ deletedCount: 3 });
    updateManyMock.mockResolvedValueOnce({ modifiedCount: 2 });

    const deleted = await deleteSessionsByUser("u1");
    const revoked = await revokeSessionsByUser("u1");

    expect(deleted).toBe(3);
    expect(revoked).toBe(2);
  });
});
