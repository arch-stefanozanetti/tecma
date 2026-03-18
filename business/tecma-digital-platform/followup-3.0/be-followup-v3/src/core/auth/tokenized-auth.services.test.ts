import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertOneMock = vi.fn();
  const findOneAndUpdateMock = vi.fn();
  const deleteManyMock = vi.fn();

  const inviteCollection = {
    insertOne: insertOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
    deleteMany: deleteManyMock,
  };

  const resetCollection = {
    insertOne: insertOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
    deleteMany: deleteManyMock,
  };

  return {
    insertOneMock,
    findOneAndUpdateMock,
    deleteManyMock,
    inviteCollection,
    resetCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_inviteTokens") return mocks.inviteCollection;
      if (name === "tz_passwordResetTokens") return mocks.resetCollection;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

import {
  consumeInviteToken,
  createInviteToken,
  deleteInviteTokensForUserId,
  generateInviteRawToken,
} from "./inviteToken.service.js";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  generatePasswordResetRawToken,
} from "./passwordResetToken.service.js";

describe("tokenized auth helper services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates opaque tokens", () => {
    expect(generateInviteRawToken()).toMatch(/^[a-f0-9]{64}$/);
    expect(generatePasswordResetRawToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates invite token and normalizes email", async () => {
    mocks.insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    const raw = await createInviteToken({
      email: " USER@EXAMPLE.COM ",
      role: "agent",
      projectId: "p1",
      userId: "u1",
    });

    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.insertOneMock).toHaveBeenCalledOnce();
    expect(mocks.insertOneMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        email: "user@example.com",
        role: "agent",
        projectId: "p1",
        userId: "u1",
        used: false,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );

    await deleteInviteTokensForUserId("u1");
    expect(mocks.deleteManyMock).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("consumes invite token via hash lookup", async () => {
    mocks.findOneAndUpdateMock.mockResolvedValueOnce({ email: "user@example.com", used: false });

    const result = await consumeInviteToken("a".repeat(64));

    expect(result?.email).toBe("user@example.com");
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        used: false,
        expiresAt: { $gt: expect.any(Date) },
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { $set: { used: true } },
      { returnDocument: "before" }
    );
  });

  it("creates password-reset token, invalidates old tokens and consumes it", async () => {
    mocks.deleteManyMock.mockResolvedValueOnce({ deletedCount: 1 });
    mocks.insertOneMock.mockResolvedValueOnce({ acknowledged: true });
    const raw = await createPasswordResetToken("u2", " RESET@EXAMPLE.COM ");

    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.deleteManyMock).toHaveBeenCalledWith({ userId: "u2", used: false });
    expect(mocks.insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        email: "reset@example.com",
        used: false,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );

    mocks.findOneAndUpdateMock.mockResolvedValueOnce({ userId: "u2", used: false });
    const consumed = await consumePasswordResetToken(raw);
    expect(consumed?.userId).toBe("u2");
  });
});
