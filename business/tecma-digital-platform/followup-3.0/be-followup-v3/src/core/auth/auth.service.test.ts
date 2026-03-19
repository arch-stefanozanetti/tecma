import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const {
  bcryptCompareMock,
  bcryptHashMock,
  usersFindOneMock,
  usersUpdateOneMock,
  listCollectionsHasNextMock,
  logAuthEventMock,
  getSessionMock,
  deleteSessionMock,
  deleteSessionsByUserMock,
  sendPasswordResetEmailMock,
  createPasswordResetTokenMock,
  consumePasswordResetTokenMock,
  signAccessTokenMock,
  createSessionMock,
  verifySsoJwtMock,
  buildAccessPayloadMock,
  toAuthSessionUserMock,
} = vi.hoisted(() => ({
  bcryptCompareMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  usersFindOneMock: vi.fn(),
  usersUpdateOneMock: vi.fn(),
  listCollectionsHasNextMock: vi.fn(),
  logAuthEventMock: vi.fn(),
  getSessionMock: vi.fn(),
  deleteSessionMock: vi.fn(),
  deleteSessionsByUserMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  createPasswordResetTokenMock: vi.fn(),
  consumePasswordResetTokenMock: vi.fn(),
  signAccessTokenMock: vi.fn(),
  createSessionMock: vi.fn(),
  verifySsoJwtMock: vi.fn(),
  buildAccessPayloadMock: vi.fn(),
  toAuthSessionUserMock: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
    hash: bcryptHashMock,
  },
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    databaseName: "test-db",
    listCollections: () => ({
      hasNext: listCollectionsHasNextMock,
      toArray: vi.fn().mockResolvedValue([{ name: "tz_users" }]),
    }),
    collection: () => ({
      findOne: usersFindOneMock,
      updateOne: usersUpdateOneMock,
    }),
  }),
}));

vi.mock("../email/email.service.js", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("./authAudit.service.js", () => ({
  logAuthEvent: logAuthEventMock,
}));

vi.mock("./refreshSession.service.js", () => ({
  createSession: createSessionMock,
  deleteSession: deleteSessionMock,
  deleteSessionsByUser: deleteSessionsByUserMock,
  getSession: getSessionMock,
}));

vi.mock("./passwordResetToken.service.js", () => ({
  createPasswordResetToken: createPasswordResetTokenMock,
  consumePasswordResetToken: consumePasswordResetTokenMock,
}));

vi.mock("./token.service.js", () => ({
  signAccessToken: signAccessTokenMock,
}));

vi.mock("./ssoJwtVerify.service.js", () => ({
  verifySsoJwtAndGetPayload: verifySsoJwtMock,
}));

vi.mock("./userAccessPayload.js", () => ({
  USER_COLLECTION_CANDIDATES: ["tz_users"],
  escapeEmailForRegex: (value: string) => value,
  buildAccessPayloadFromUserDoc: buildAccessPayloadMock,
  toAuthSessionUser: toAuthSessionUserMock,
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
    listCollectionsHasNextMock.mockResolvedValue(true);
  });

  it("refreshAccessToken rejects when session is missing", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(refreshAccessToken({ refreshToken: "rt-1" })).rejects.toMatchObject({
      statusCode: 401,
    } as Partial<HttpError>);
  });

  it("loginWithCredentials fails when user is missing", async () => {
    usersFindOneMock.mockResolvedValueOnce(null);
    bcryptCompareMock.mockResolvedValueOnce(false);

    await expect(loginWithCredentials({ email: "x@test.com", password: "pw" })).rejects.toMatchObject({
      statusCode: 401,
    } as Partial<HttpError>);
    expect(logAuthEventMock).toHaveBeenCalledWith(
      "login_failed",
      expect.objectContaining({ email: "x@test.com", success: false })
    );
  });

  it("loginWithCredentials succeeds for active user", async () => {
    const uid = new ObjectId("64b64f3fd9024a2a53111111");
    usersFindOneMock.mockResolvedValueOnce({
      _id: uid,
      email: "user@test.com",
      password: "hash",
      isDisabled: false,
      status: "active",
    });
    bcryptCompareMock.mockResolvedValueOnce(true);
    buildAccessPayloadMock.mockResolvedValueOnce({
      sub: uid.toHexString(),
      email: "user@test.com",
      role: "agent",
      isAdmin: false,
      permissions: ["apartments.read"],
      projectId: "p1",
    });
    signAccessTokenMock.mockReturnValueOnce("jwt-access");
    createSessionMock.mockResolvedValueOnce("refresh-token");
    toAuthSessionUserMock.mockReturnValueOnce({ id: uid.toHexString(), email: "user@test.com" });

    const result = await loginWithCredentials({ email: "user@test.com", password: "pw" });

    expect(result.accessToken).toBe("jwt-access");
    expect(result.refreshToken).toBe("refresh-token");
    expect(logAuthEventMock).toHaveBeenCalledWith(
      "login_success",
      expect.objectContaining({ userId: uid.toHexString(), email: "user@test.com", success: true })
    );
  });

  it("loginWithCredentials fails on wrong password for existing user", async () => {
    usersFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId("64b64f3fd9024a2a53111111"),
      email: "user@test.com",
      password: "hash",
      isDisabled: false,
      status: "active",
    });
    bcryptCompareMock.mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    await expect(loginWithCredentials({ email: "user@test.com", password: "wrong" })).rejects.toMatchObject({
      statusCode: 401,
    } as Partial<HttpError>);
    expect(logAuthEventMock).toHaveBeenCalledWith(
      "login_failed",
      expect.objectContaining({ email: "user@test.com", success: false })
    );
  });

  it("exchangeSsoJwt maps generic verification error to 401", async () => {
    verifySsoJwtMock.mockRejectedValueOnce(new Error("boom"));
    await expect(exchangeSsoJwt({ ssoJwt: "token" })).rejects.toMatchObject({ statusCode: 401 } as Partial<HttpError>);
  });

  it("exchangeSsoJwt returns 401 when payload has no email", async () => {
    verifySsoJwtMock.mockResolvedValueOnce({ sub: "no-email" });
    await expect(exchangeSsoJwt({ ssoJwt: "token" })).rejects.toMatchObject({ statusCode: 401 } as Partial<HttpError>);
  });

  it("exchangeSsoJwt returns 401 for disabled user", async () => {
    verifySsoJwtMock.mockResolvedValueOnce({ email: "sso@test.com" });
    usersFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId("64b64f3fd9024a2a53111111"),
      email: "sso@test.com",
      isDisabled: true,
    });
    await expect(exchangeSsoJwt({ ssoJwt: "token" })).rejects.toMatchObject({ statusCode: 401 } as Partial<HttpError>);
  });

  it("exchangeSsoJwt succeeds when SSO payload is valid", async () => {
    const uid = new ObjectId("64b64f3fd9024a2a53111111");
    verifySsoJwtMock.mockResolvedValueOnce({ email: "sso@test.com" });
    usersFindOneMock.mockResolvedValueOnce({
      _id: uid,
      email: "sso@test.com",
      isDisabled: false,
      password: "hash",
    });
    buildAccessPayloadMock.mockResolvedValueOnce({
      sub: uid.toHexString(),
      email: "sso@test.com",
      role: "agent",
      isAdmin: false,
      permissions: ["apartments.read"],
      projectId: "p1",
    });
    signAccessTokenMock.mockReturnValueOnce("jwt-access");
    createSessionMock.mockResolvedValueOnce("refresh-token");
    toAuthSessionUserMock.mockReturnValueOnce({ id: uid.toHexString(), email: "sso@test.com" });

    const result = await exchangeSsoJwt({ ssoJwt: "token" });

    expect(result.accessToken).toBe("jwt-access");
    expect(result.refreshToken).toBe("refresh-token");
    expect(logAuthEventMock).toHaveBeenCalledWith(
      "sso_exchange",
      expect.objectContaining({ userId: uid.toHexString(), email: "sso@test.com", success: true })
    );
  });

  it("logoutWithRefreshToken logs event and deletes session when found", async () => {
    getSessionMock.mockResolvedValueOnce({ userId: "u1", email: "u@test.com" });
    deleteSessionMock.mockResolvedValueOnce(true);

    await logoutWithRefreshToken({ refreshToken: "rt-1" }, { ipAddress: "127.0.0.1" });

    expect(logAuthEventMock).toHaveBeenCalledWith(
      "logout",
      expect.objectContaining({ userId: "u1", email: "u@test.com", success: true })
    );
    expect(deleteSessionMock).toHaveBeenCalledWith("rt-1");
  });

  it("logoutWithRefreshToken deletes session also when not found", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    deleteSessionMock.mockResolvedValueOnce(false);

    await logoutWithRefreshToken({ refreshToken: "rt-1" });

    expect(logAuthEventMock).not.toHaveBeenCalledWith("logout", expect.anything());
    expect(deleteSessionMock).toHaveBeenCalledWith("rt-1");
  });

  it("requestPasswordReset returns ok and does not send email for invited user", async () => {
    usersFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId("64b64f3fd9024a2a53111111"),
      email: "invited@test.com",
      status: "invited",
      password: undefined,
      isDisabled: false,
    });

    const result = await requestPasswordReset({ email: "invited@test.com" });

    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(createPasswordResetTokenMock).not.toHaveBeenCalled();
  });

  it("requestPasswordReset sends email for active user", async () => {
    usersFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId("64b64f3fd9024a2a53111111"),
      email: "active@test.com",
      status: "active",
      password: "hash",
      isDisabled: false,
    });
    createPasswordResetTokenMock.mockResolvedValueOnce("reset-token");
    sendPasswordResetEmailMock.mockResolvedValueOnce(undefined);

    const result = await requestPasswordReset({ email: "active@test.com" });

    expect(result).toEqual({ ok: true });
    expect(createPasswordResetTokenMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({ to: "active@test.com", token: "reset-token" });
  });

  it("refreshAccessToken rejects and deletes session when user is disabled", async () => {
    getSessionMock.mockResolvedValueOnce({ userId: "64b64f3fd9024a2a53111111", email: "u@test.com" });
    usersFindOneMock.mockResolvedValueOnce({ _id: new ObjectId("64b64f3fd9024a2a53111111"), isDisabled: true });

    await expect(refreshAccessToken({ refreshToken: "rt-1" })).rejects.toMatchObject({ statusCode: 401 } as Partial<HttpError>);
    expect(deleteSessionMock).toHaveBeenCalledWith("rt-1");
  });

  it("refreshAccessToken rotates session on success", async () => {
    const uid = new ObjectId("64b64f3fd9024a2a53111111");
    getSessionMock.mockResolvedValueOnce({ userId: uid.toHexString(), email: "u@test.com" });
    usersFindOneMock.mockResolvedValueOnce({ _id: uid, email: "u@test.com", isDisabled: false, password: "hash" });
    buildAccessPayloadMock.mockResolvedValueOnce({
      sub: uid.toHexString(),
      email: "u@test.com",
      role: "agent",
      isAdmin: false,
      permissions: ["apartments.read"],
      projectId: "p1",
    });
    signAccessTokenMock.mockReturnValueOnce("jwt-next");
    deleteSessionMock.mockResolvedValueOnce(true);
    createSessionMock.mockResolvedValueOnce("rt-next");

    const result = await refreshAccessToken({ refreshToken: "rt-old" });

    expect(result.accessToken).toBe("jwt-next");
    expect(result.refreshToken).toBe("rt-next");
    expect(deleteSessionMock).toHaveBeenCalledWith("rt-old");
  });

  it("resetPasswordWithToken updates password and revokes sessions", async () => {
    consumePasswordResetTokenMock.mockResolvedValueOnce({
      userId: "64b64f3fd9024a2a53111111",
      email: "user@test.com",
    });
    usersFindOneMock.mockResolvedValueOnce({
      _id: new ObjectId("64b64f3fd9024a2a53111111"),
      email: "user@test.com",
    });
    bcryptHashMock.mockResolvedValueOnce("hashed-password");
    deleteSessionsByUserMock.mockResolvedValueOnce(1);
    logAuthEventMock.mockResolvedValueOnce(undefined);

    const result = await resetPasswordWithToken({ token: "tkn", password: "verystrongpass" });

    expect(result).toEqual({ ok: true });
    expect(usersUpdateOneMock).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      { $set: { password: "hashed-password", status: "active" } }
    );
    expect(deleteSessionsByUserMock).toHaveBeenCalledWith("64b64f3fd9024a2a53111111");
  });

  it("resetPasswordWithToken rejects invalid consumed token", async () => {
    consumePasswordResetTokenMock.mockResolvedValueOnce(null);
    await expect(resetPasswordWithToken({ token: "bad", password: "verystrongpass" })).rejects.toMatchObject({
      statusCode: 400,
    } as Partial<HttpError>);
  });

  it("resetPasswordWithToken rejects when user does not exist", async () => {
    consumePasswordResetTokenMock.mockResolvedValueOnce({
      userId: "64b64f3fd9024a2a53111111",
      email: "user@test.com",
    });
    usersFindOneMock.mockResolvedValueOnce(null);

    await expect(resetPasswordWithToken({ token: "ok", password: "verystrongpass" })).rejects.toMatchObject({
      statusCode: 400,
    } as Partial<HttpError>);
  });
});
