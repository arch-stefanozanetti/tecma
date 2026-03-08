import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { sendError, handleAsync } from "./asyncHandler.js";
import { HttpError } from "../types/http.js";

describe("sendError", () => {
  it("sends 400 and message for generic Error", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    sendError(res, new Error("validation failed"));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "validation failed" });
  });

  it("sends statusCode from HttpError", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    sendError(res, new HttpError("Unauthorized", 401));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("sends statusCode from error-like object", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    sendError(res, { message: "Not found", statusCode: 404 });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });
});

describe("handleAsync", () => {
  it("calls handler and sends JSON on success", async () => {
    const req = {} as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const fn = handleAsync(handler);
    await fn(req, res, vi.fn());
    expect(handler).toHaveBeenCalledWith(req);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("calls sendError on throw", async () => {
    const req = {} as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const fn = handleAsync(() => Promise.reject(new HttpError("Forbidden", 403)));
    const returned = fn(req, res, vi.fn());
    await returned;
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("does not call res.json when handler returns undefined", async () => {
    const req = {} as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const handler = vi.fn().mockResolvedValue(undefined);
    const fn = handleAsync(handler);
    await fn(req, res, vi.fn());
    expect(res.json).not.toHaveBeenCalled();
  });
});
