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
    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: 60,
  },
}));

import {
  createPasswordResetToken,
  consumePasswordResetToken,
  generatePasswordResetRawToken,
} from "./passwordResetToken.service.js";

describe("passwordResetToken.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generatePasswordResetRawToken", () => {
    it("returns a 64-char hex string", () => {
      const token = generatePasswordResetRawToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns unique tokens on each call", () => {
      const t1 = generatePasswordResetRawToken();
      const t2 = generatePasswordResetRawToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe("createPasswordResetToken", () => {
    it("deletes previous unused tokens for the user before creating a new one", async () => {
      const raw = await createPasswordResetToken("user-1", "User@Example.COM");

      expect(mocks.deleteManyMock).toHaveBeenCalledWith({ userId: "user-1", used: false });
      expect(mocks.deleteManyMock).toHaveBeenCalledBefore(mocks.insertOneMock);
    });

    it("inserts a document with hashed token, lowercased/trimmed email, and correct expiry", async () => {
      const raw = await createPasswordResetToken("user-1", "  User@Example.COM  ");

      expect(mocks.insertOneMock).toHaveBeenCalledTimes(1);
      const doc = mocks.insertOneMock.mock.calls[0][0];

      expect(doc.userId).toBe("user-1");
      expect(doc.email).toBe("user@example.com");
      expect(doc.used).toBe(false);
      expect(doc.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.tokenHash).not.toBe(raw);
      expect(doc.expiresAt).toBeInstanceOf(Date);
      expect(doc.createdAt).toBeInstanceOf(Date);

      const diffMs = doc.expiresAt.getTime() - doc.createdAt.getTime();
      // Should be approximately 60 minutes (allow 5s tolerance for test execution)
      expect(diffMs).toBeGreaterThanOrEqual(60 * 60 * 1000 - 5000);
      expect(diffMs).toBeLessThanOrEqual(60 * 60 * 1000 + 5000);
    });

    it("returns the raw (unhashed) token", async () => {
      const raw = await createPasswordResetToken("user-1", "a@b.com");

      expect(raw).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("consumePasswordResetToken", () => {
    it("returns the document when a valid unused non-expired token exists", async () => {
      const fakeDoc = {
        userId: "user-1",
        email: "a@b.com",
        tokenHash: "abc",
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };
      mocks.findOneAndUpdateMock.mockResolvedValueOnce(fakeDoc);

      const result = await consumePasswordResetToken("some-raw-token");

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

      const result = await consumePasswordResetToken("invalid-token");

      expect(result).toBeNull();
    });

    it("hashes the raw token consistently for lookup", async () => {
      const rawToken = "deadbeef".repeat(8);

      await consumePasswordResetToken(rawToken);
      const hash1 = mocks.findOneAndUpdateMock.mock.calls[0][0].tokenHash;

      await consumePasswordResetToken(rawToken);
      const hash2 = mocks.findOneAndUpdateMock.mock.calls[1][0].tokenHash;

      expect(hash1).toBe(hash2);
    });
  });
});
