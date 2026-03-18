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
});
