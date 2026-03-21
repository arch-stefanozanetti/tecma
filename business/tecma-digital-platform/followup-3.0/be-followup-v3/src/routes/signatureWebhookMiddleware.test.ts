import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const WEBHOOK_SECRET = "test-webhook-signature-secret-16";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res as unknown as Response;
}

async function loadMiddleware() {
  vi.resetModules();
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "dev-1";
  process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/test";
  process.env.MONGO_DB_NAME ??= "test";
  process.env.AUTH_JWT_SECRET ??= "x".repeat(32);
  process.env.SIGNATURE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  return import("./signatureWebhookMiddleware.js");
}

describe("requireSignatureWebhookSecret", () => {
  it("chiama next quando Bearer coincide con SIGNATURE_WEBHOOK_SECRET", async () => {
    const { requireSignatureWebhookSecret } = await loadMiddleware();
    const req = {
      get: (h: string) => (h.toLowerCase() === "authorization" ? `Bearer ${WEBHOOK_SECRET}` : undefined),
    } as Request;
    const next = vi.fn() as NextFunction;
    requireSignatureWebhookSecret(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("401 quando il segreto non coincide", async () => {
    const { requireSignatureWebhookSecret } = await loadMiddleware();
    const req = {
      get: (h: string) => (h.toLowerCase() === "authorization" ? "Bearer wrong-secret-value" : undefined),
    } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    requireSignatureWebhookSecret(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accetta x-signature-webhook-secret", async () => {
    const { requireSignatureWebhookSecret } = await loadMiddleware();
    const req = {
      get: (h: string) => (h.toLowerCase() === "x-signature-webhook-secret" ? WEBHOOK_SECRET : undefined),
    } as Request;
    const next = vi.fn() as NextFunction;
    requireSignatureWebhookSecret(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
