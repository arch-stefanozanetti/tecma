import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deleteManyMock = vi.fn(async () => ({ deletedCount: 1 }));
  const insertOneMock = vi.fn(async () => ({ acknowledged: true }));
  const findOneAndUpdateMock = vi.fn(async () => null);

  const collection = {
    deleteMany: deleteManyMock,
    insertOne: insertOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
  };

  const getDbMock = vi.fn(() => ({
    collection: vi.fn(() => collection),
  }));

  return {
    deleteManyMock,
    insertOneMock,
    findOneAndUpdateMock,
    getDbMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: mocks.getDbMock,
}));

vi.mock("../../config/env.js", () => ({
  ENV: {
    INVITE_TOKEN_EXPIRES_HOURS: 168,
  },
}));

import {
  createInviteToken,
  consumeInviteToken,
  deleteInviteTokensForUserId,
  generateInviteRawToken,
} from "./inviteToken.service.js";

describe("inviteToken.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateInviteRawToken", () => {
    it("returns a 64-char hex string", () => {
      const token = generateInviteRawToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns unique tokens on each call", () => {
      const t1 = generateInviteRawToken();
      const t2 = generateInviteRawToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe("createInviteToken", () => {
    const params = {
      email: "  Invited@Example.COM  ",
      role: "agent",
      projectId: "proj-1",
      userId: "user-1",
    };

    it("inserts a document with hashed token, lowercased/trimmed email, and correct fields", async () => {
      const raw = await createInviteToken(params);

      expect(mocks.insertOneMock).toHaveBeenCalledTimes(1);
      const doc = mocks.insertOneMock.mock.calls[0][0];

      expect(doc.email).toBe("invited@example.com");
      expect(doc.role).toBe("agent");
      expect(doc.projectId).toBe("proj-1");
      expect(doc.userId).toBe("user-1");
      expect(doc.used).toBe(false);
      expect(doc.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.tokenHash).not.toBe(raw);
      expect(doc.expiresAt).toBeInstanceOf(Date);
      expect(doc.createdAt).toBeInstanceOf(Date);
    });

    it("sets expiry to INVITE_TOKEN_EXPIRES_HOURS hours from now", async () => {
      await createInviteToken(params);
      const doc = mocks.insertOneMock.mock.calls[0][0];

      const diffMs = doc.expiresAt.getTime() - doc.createdAt.getTime();
      // 168 hours = 7 days, allow 5s tolerance
      expect(diffMs).toBeGreaterThanOrEqual(168 * 60 * 60 * 1000 - 5000);
      expect(diffMs).toBeLessThanOrEqual(168 * 60 * 60 * 1000 + 5000);
    });

    it("returns the raw (unhashed) token", async () => {
      const raw = await createInviteToken(params);
      expect(raw).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("deleteInviteTokensForUserId", () => {
    it("deletes all tokens for the given userId", async () => {
      await deleteInviteTokensForUserId("user-42");

      expect(mocks.deleteManyMock).toHaveBeenCalledWith({ userId: "user-42" });
    });

    it("returns void", async () => {
      const result = await deleteInviteTokensForUserId("user-1");
      expect(result).toBeUndefined();
    });
  });

  describe("consumeInviteToken", () => {
    it("returns the document when a valid unused non-expired token exists", async () => {
      const fakeDoc = {
        email: "a@b.com",
        tokenHash: "abc",
        role: "agent",
        projectId: "proj-1",
        userId: "user-1",
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };
      mocks.findOneAndUpdateMock.mockResolvedValueOnce(fakeDoc);

      const result = await consumeInviteToken("some-raw-token");

      expect(result).toBe(fakeDoc);
      expect(mocks.findOneAndUpdateMock).toHaveBeenCalledTimes(1);

      const [filter, update, options] = mocks.findOneAndUpdateMock.mock.calls[0];
      expect(filter.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(filter.used).toBe(false);
      expect(filter.expiresAt).toEqual({ $gt: expect.any(Date) });
      expect(update).toEqual({ $set: { used: true } });
      expect(options).toEqual({ returnDocument: "before" });
    });

    it("returns null when no matching token is found (not found / expired / already used)", async () => {
      mocks.findOneAndUpdateMock.mockResolvedValueOnce(null);

      const result = await consumeInviteToken("invalid-token");

      expect(result).toBeNull();
    });

    it("hashes the raw token consistently for lookup", async () => {
      const rawToken = "cafebabe".repeat(8);

      await consumeInviteToken(rawToken);
      const hash1 = mocks.findOneAndUpdateMock.mock.calls[0][0].tokenHash;

      await consumeInviteToken(rawToken);
      const hash2 = mocks.findOneAndUpdateMock.mock.calls[1][0].tokenHash;

      expect(hash1).toBe(hash2);
    });
  });
});
