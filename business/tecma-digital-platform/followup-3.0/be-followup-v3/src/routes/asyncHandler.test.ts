import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
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

describe("sendError in modalità production-like", () => {
  it("maschera 5xx con messaggio generico", async () => {
    vi.resetModules();
    const save = {
      NODE_ENV: process.env.NODE_ENV,
      APP_ENV: process.env.APP_ENV,
      MONGO_URI: process.env.MONGO_URI,
      MONGO_DB_NAME: process.env.MONGO_DB_NAME,
      AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET
    };
    Object.assign(process.env, {
      NODE_ENV: "production",
      APP_ENV: "production",
      MONGO_URI: save.MONGO_URI || "mongodb://127.0.0.1:27017/test",
      MONGO_DB_NAME: save.MONGO_DB_NAME || "test",
      AUTH_JWT_SECRET: save.AUTH_JWT_SECRET && save.AUTH_JWT_SECRET.length >= 32
        ? save.AUTH_JWT_SECRET
        : "prod-auth-jwt-secret-at-least-32-characters"
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendError: sendErrorProd } = await import("./asyncHandler.js");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    sendErrorProd(res, new HttpError("Dettaglio interno non esposto", 500));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Errore interno del server" });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    Object.assign(process.env, save);
    vi.resetModules();
    await import("./asyncHandler.js");
  });

  it("503 → messaggio servizio non disponibile", async () => {
    vi.resetModules();
    const save = {
      NODE_ENV: process.env.NODE_ENV,
      APP_ENV: process.env.APP_ENV,
      MONGO_URI: process.env.MONGO_URI,
      MONGO_DB_NAME: process.env.MONGO_DB_NAME,
      AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET
    };
    Object.assign(process.env, {
      NODE_ENV: "production",
      APP_ENV: "staging",
      MONGO_URI: save.MONGO_URI || "mongodb://127.0.0.1:27017/test",
      MONGO_DB_NAME: save.MONGO_DB_NAME || "test",
      AUTH_JWT_SECRET:
        save.AUTH_JWT_SECRET && save.AUTH_JWT_SECRET.length >= 32
          ? save.AUTH_JWT_SECRET
          : "staging-auth-jwt-secret-min-32-chars-ok!!"
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendError: sendErrorProd } = await import("./asyncHandler.js");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    sendErrorProd(res, new HttpError("SSO down", 503));
    expect(res.json).toHaveBeenCalledWith({ error: "Servizio temporaneamente non disponibile" });
    Object.assign(process.env, save);
    vi.resetModules();
    await import("./asyncHandler.js");
  });

  it("ZodError in strict → messaggio generico", async () => {
    vi.resetModules();
    const save = { NODE_ENV: process.env.NODE_ENV, APP_ENV: process.env.APP_ENV };
    process.env.NODE_ENV = "production";
    process.env.APP_ENV = "production";
    Object.assign(process.env, {
      MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test",
      MONGO_DB_NAME: process.env.MONGO_DB_NAME || "test",
      AUTH_JWT_SECRET:
        process.env.AUTH_JWT_SECRET && process.env.AUTH_JWT_SECRET.length >= 32
          ? process.env.AUTH_JWT_SECRET
          : "prod-auth-jwt-secret-at-least-32-characters"
    });
    const { sendError: sendErrorProd } = await import("./asyncHandler.js");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const zodErr = z.object({ id: z.string() }).safeParse({ id: 1 }).error!;
    sendErrorProd(res, zodErr);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Richiesta non valida" });
    Object.assign(process.env, save);
    vi.resetModules();
    await import("./asyncHandler.js");
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
