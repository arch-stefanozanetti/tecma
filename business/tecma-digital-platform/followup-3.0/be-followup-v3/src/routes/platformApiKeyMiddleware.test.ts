import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  ENV: {
    PLATFORM_API_KEYS: JSON.stringify({
      "test-key-1": { workspaceId: "ws1", projectIds: ["p1", "p2"], label: "partner-site" },
    }),
  },
}));

import type { Request, Response } from "express";
import { platformApiKeyMiddleware } from "./platformApiKeyMiddleware.js";

describe("platformApiKeyMiddleware", () => {
  const makeRes = () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    return { status, json } as unknown as Response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing api key", () => {
    const req = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    platformApiKeyMiddleware(req, res, next);
    expect((res.status as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid api key and populates req.platformAccess", () => {
    const req = {
      get: vi.fn().mockImplementation((name: string) => (name.toLowerCase() === "x-api-key" ? "test-key-1" : undefined)),
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    platformApiKeyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.platformAccess).toEqual(
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1", "p2"], label: "partner-site" })
    );
  });
});

