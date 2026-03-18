import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertOneMock, loggerErrorMock } = vi.hoisted(() => ({
  insertOneMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("../../observability/logger.js", () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      insertOne: insertOneMock,
    }),
  }),
}));

import { logAuthEvent } from "./authAudit.service.js";

describe("authAudit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes auth event", async () => {
    insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    await logAuthEvent("login_success", {
      userId: "u1",
      email: "a@example.com",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      success: true,
    });

    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("swallows db error and logs", async () => {
    insertOneMock.mockRejectedValueOnce(new Error("db down"));

    await expect(
      logAuthEvent("login_failed", {
        email: "a@example.com",
        success: false,
      })
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });
});
