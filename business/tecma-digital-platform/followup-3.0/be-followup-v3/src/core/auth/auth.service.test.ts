import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const compareMock = vi.fn();
  const hashMock = vi.fn();
  const sendPasswordResetEmailMock = vi.fn();
  const logAuthEventMock = vi.fn();
  const createSessionMock = vi.fn();
  const deleteSessionMock = vi.fn();
  const deleteSessionsByUserMock = vi.fn();
  const getSessionMock = vi.fn();
  const createPasswordResetTokenMock = vi.fn();
  const consumePasswordResetTokenMock = vi.fn();
  const signAccessTokenMock = vi.fn();
  const verifySsoJwtAndGetPayloadMock = vi.fn();
  const buildAccessPayloadFromUserDocMock = vi.fn();
  const toAuthSessionUserMock = vi.fn();

  const users: Array<Record<string, unknown>> = [];

  const usersCollection = {
    findOne: vi.fn(async (query: Record<string, unknown>) => {
      const queryId = query._id;
      if (queryId instanceof ObjectId) {
        return users.find((u) => (u._id as ObjectId).toHexString() === queryId.toHexString()) ?? null;
      }
      const emailRegex = (query.email as { $regex?: string })?.$regex;
      if (emailRegex) {
        const cleaned = emailRegex.replace(/^\^/, "").replace(/\$$/, "").replace(/\\/g, "").toLowerCase();
        return users.find((u) => String(u.email ?? "").toLowerCase() === cleaned) ?? null;
      }
      return null;
    }),
    updateOne: vi.fn(async (query: Record<string, unknown>, update: Record<string, unknown>) => {
      const id = query._id instanceof ObjectId ? query._id.toHexString() : String(query._id ?? "");
      const idx = users.findIndex((u) => (u._id as ObjectId).toHexString() === id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...(update.$set as Record<string, unknown>) };
      }
      return { matchedCount: idx >= 0 ? 1 : 0 };
    }),
  };

  const listCollectionsMock = vi.fn((filter?: { name?: string }) => ({
    hasNext: vi.fn(async () => {
      if (!filter?.name) return false;
      return ["tz_users", "users", "backoffice_users"].includes(filter.name);
    }),
    toArray: vi.fn(async () => [{ name: "tz_users" }]),
  }));

  const getDbMock = vi.fn(() => ({
    databaseName: "followup_test",
    listCollections: listCollectionsMock,
    collection: vi.fn((name: string) => {
      if (["tz_users", "users", "backoffice_users"].includes(name)) return usersCollection;
      throw new Error("Unexpected collection: " + name);
    }),
  }));

  return {
    compareMock,
    hashMock,
    sendPasswordResetEmailMock,
    logAuthEventMock,
    createSessionMock,
    deleteSessionMock,
    deleteSessionsByUserMock,
    getSessionMock,
    createPasswordResetTokenMock,
    consumePasswordResetTokenMock,
    signAccessTokenMock,
    verifySsoJwtAndGetPayloadMock,
    buildAccessPayloadFromUserDocMock,
    toAuthSessionUserMock,
    users,
    usersCollection,
    getDbMock,
  };
});

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compareMock, hash: mocks.hashMock },
}));

vi.mock("../../config/db.js", () => ({
  getDb: mocks.getDbMock,
}));

vi.mock("../email/email.service.js", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmailMock,
}));

vi.mock("./authAudit.service.js", () => ({
  logAuthEvent: mocks.logAuthEventMock,
}));

vi.mock("./refreshSession.service.js", () => ({
  createSession: mocks.createSessionMock,
  deleteSession: mocks.deleteSessionMock,
  deleteSessionsByUser: mocks.deleteSessionsByUserMock,
  getSession: mocks.getSessionMock,
}));

vi.mock("./passwordResetToken.service.js", () => ({
  createPasswordResetToken: mocks.createPasswordResetTokenMock,
  consumePasswordResetToken: mocks.consumePasswordResetTokenMock,
}));

vi.mock("./token.service.js", () => ({
  signAccessToken: mocks.signAccessTokenMock,
}));

vi.mock("./ssoJwtVerify.service.js", () => ({
  verifySsoJwtAndGetPayload: mocks.verifySsoJwtAndGetPayloadMock,
}));

vi.mock("./userAccessPayload.js", () => ({
  USER_COLLECTION_CANDIDATES: ["tz_users", "users", "backoffice_users"],
  escapeEmailForRegex: (email: string) => email.trim().toLowerCase(),
  buildAccessPayloadFromUserDoc: mocks.buildAccessPayloadFromUserDocMock,
  toAuthSessionUser: mocks.toAuthSessionUserMock,
}));

import {
  exchangeSsoJwt,
  loginWithCredentials,
  logoutWithRefreshToken,
  refreshAccessToken,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./auth.service.js";

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users.length = 0;
    mocks.compareMock.mockResolvedValue(true);
    mocks.hashMock.mockResolvedValue("hashed-pw");
    mocks.createSessionMock.mockResolvedValue("refresh-1");
    mocks.signAccessTokenMock.mockReturnValue("access-1");
    mocks.buildAccessPayloadFromUserDocMock.mockImplementation(async (u: Record<string, unknown>) => ({
      sub: (u._id as ObjectId).toHexString(),
      email: String(u.email ?? "u@test.local"),
      role: "agent",
      isAdmin: false,
      permissions: ["requests:read"],
      projectId: "p1",
    }));
    mocks.toAuthSessionUserMock.mockImplementation((p: Record<string, unknown>) => ({
      id: p.sub,
      email: p.email,
      role: p.role,
      isAdmin: p.isAdmin,
      permissions: p.permissions,
      projectId: p.projectId,
    }));
  });

  it("loginWithCredentials success", async () => {
    const id = new ObjectId();
    mocks.users.push({ _id: id, email: "agent@test.local", password: "hash", project_ids: ["p1"] });

    const result = await loginWithCredentials({ email: "agent@test.local", password: "x" });

    expect(mocks.compareMock).toHaveBeenCalledWith("x", "hash");
    expect(result.accessToken).toBe("access-1");
    expect(result.refreshToken).toBe("refresh-1");
  });

  it("loginWithCredentials failed user/password", async () => {
    mocks.compareMock.mockResolvedValue(false);

    await expect(loginWithCredentials({ email: "missing@test.local", password: "x" })).rejects.toMatchObject({ statusCode: 401 });
    const id = new ObjectId();
    mocks.users.push({ _id: id, email: "agent@test.local", password: "hash" });
    await expect(loginWithCredentials({ email: "agent@test.local", password: "x" })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("exchangeSsoJwt handles generic failure, missing email, disabled user and success", async () => {
    mocks.verifySsoJwtAndGetPayloadMock.mockRejectedValueOnce(new Error("boom"));
    await expect(exchangeSsoJwt({ ssoJwt: "x" })).rejects.toMatchObject({ statusCode: 401 });

    mocks.verifySsoJwtAndGetPayloadMock.mockResolvedValueOnce({ sub: "u1" });
    await expect(exchangeSsoJwt({ ssoJwt: "x" })).rejects.toMatchObject({ statusCode: 401 });

    const disabledId = new ObjectId();
    mocks.users.push({ _id: disabledId, email: "disabled@test.local", isDisabled: true, password: "h" });
    mocks.verifySsoJwtAndGetPayloadMock.mockResolvedValueOnce({ email: "disabled@test.local" });
    await expect(exchangeSsoJwt({ ssoJwt: "x" })).rejects.toMatchObject({ statusCode: 401 });

    const activeId = new ObjectId();
    mocks.users.push({ _id: activeId, email: "ok@test.local", password: "h" });
    mocks.verifySsoJwtAndGetPayloadMock.mockResolvedValueOnce({ email: "ok@test.local" });
    const result = await exchangeSsoJwt({ ssoJwt: "x" });
    expect(result.accessToken).toBe("access-1");
  });

  it("refreshAccessToken invalid session, disabled user, success", async () => {
    mocks.getSessionMock.mockResolvedValueOnce(null);
    await expect(refreshAccessToken({ refreshToken: "r1" })).rejects.toMatchObject({ statusCode: 401 });

    const id = new ObjectId();
    mocks.users.push({ _id: id, email: "u@test.local", isDisabled: true, password: "h" });
    mocks.getSessionMock.mockResolvedValueOnce({ userId: id.toHexString(), email: "u@test.local" });
    await expect(refreshAccessToken({ refreshToken: "r1" })).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.deleteSessionMock).toHaveBeenCalledWith("r1");

    mocks.users[0] = { ...mocks.users[0], isDisabled: false };
    mocks.getSessionMock.mockResolvedValueOnce({ userId: id.toHexString(), email: "u@test.local" });
    const result = await refreshAccessToken({ refreshToken: "r2" });
    expect(result.refreshToken).toBe("refresh-1");
  });

  it("logoutWithRefreshToken logs when session exists and always deletes", async () => {
    mocks.getSessionMock.mockResolvedValueOnce({ userId: "u1", email: "u@test.local" });
    await logoutWithRefreshToken({ refreshToken: "r1" });
    expect(mocks.logAuthEventMock).toHaveBeenCalled();
    expect(mocks.deleteSessionMock).toHaveBeenCalledWith("r1");

    mocks.getSessionMock.mockResolvedValueOnce(null);
    await logoutWithRefreshToken({ refreshToken: "r2" });
    expect(mocks.deleteSessionMock).toHaveBeenCalledWith("r2");
  });

  it("requestPasswordReset no-op for disabled/invited and sends email for active", async () => {
    const disabledId = new ObjectId();
    mocks.users.push({ _id: disabledId, email: "d@test.local", isDisabled: true, password: "h" });
    await requestPasswordReset({ email: "d@test.local" });
    expect(mocks.createPasswordResetTokenMock).not.toHaveBeenCalled();

    const invitedId = new ObjectId();
    mocks.users.push({ _id: invitedId, email: "i@test.local", status: "invited", password: "h" });
    await requestPasswordReset({ email: "i@test.local" });
    expect(mocks.createPasswordResetTokenMock).not.toHaveBeenCalled();

    const activeId = new ObjectId();
    mocks.users.push({ _id: activeId, email: "a@test.local", password: "h" });
    mocks.createPasswordResetTokenMock.mockResolvedValueOnce("token-1");
    await requestPasswordReset({ email: "a@test.local" });
    expect(mocks.sendPasswordResetEmailMock).toHaveBeenCalledWith({ to: "a@test.local", token: "token-1" });
  });

  it("resetPasswordWithToken invalid token, missing user, success", async () => {
    mocks.consumePasswordResetTokenMock.mockResolvedValueOnce(null);
    await expect(resetPasswordWithToken({ token: "x", password: "12345678" })).rejects.toMatchObject({ statusCode: 400 });

    const missingId = new ObjectId();
    mocks.consumePasswordResetTokenMock.mockResolvedValueOnce({ userId: missingId.toHexString(), email: "x@test.local" });
    await expect(resetPasswordWithToken({ token: "x", password: "12345678" })).rejects.toMatchObject({ statusCode: 400 });

    const id = new ObjectId();
    mocks.users.push({ _id: id, email: "ok@test.local", password: "old" });
    mocks.consumePasswordResetTokenMock.mockResolvedValueOnce({ userId: id.toHexString(), email: "ok@test.local" });
    await expect(resetPasswordWithToken({ token: "x", password: "12345678" })).resolves.toEqual({ ok: true });
    expect(mocks.usersCollection.updateOne).toHaveBeenCalled();
    expect(mocks.deleteSessionsByUserMock).toHaveBeenCalledWith(id.toHexString());
  });
});
