/**
 * GET /tecma/storage/assets-diagnostics — solo Tecma admin.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
import { signAccessToken, type AccessTokenPayload } from "../../core/auth/token.service.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireAuth } from "../authMiddleware.js";
import { storageRoutes } from "./storage.routes.js";

const getDiagMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    env: {
      configured: false,
      bucket: null,
      bucketSource: "none" as const,
      region: "eu-west-1",
      awsCredentialsConfigured: false,
    },
  })
);

vi.mock("../../core/assets/storage-diagnostics.service.js", () => ({
  getAssetsStorageDiagnostics: getDiagMock,
}));

function makeToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: "u1",
    email: "u@test.it",
    role: "user",
    isAdmin: false,
    permissions: [PERMISSIONS.SETTINGS_READ],
    projectId: null,
    ...overrides,
  });
}

const app = express();
app.use(express.json());
app.use("/v1", requireAuth, storageRoutes);

describe("GET /v1/tecma/storage/assets-diagnostics", () => {
  let server: Server;
  let origin: string;
  const st = () => stableRequest(origin);

  beforeAll(async () => {
    const x = await listenStable(app);
    server = x.server;
    origin = x.origin;
  });

  afterAll(async () => {
    await closeStable(server);
  });

  beforeEach(() => {
    getDiagMock.mockClear();
    getDiagMock.mockResolvedValue({
      env: {
        configured: false,
        bucket: null,
        bucketSource: "none",
        region: "eu-west-1",
        awsCredentialsConfigured: false,
      },
    });
  });

  it("401 senza Bearer", async () => {
    const res = await st().get("/v1/tecma/storage/assets-diagnostics");
    expect(res.status).toBe(401);
  });

  it("403 se non Tecma admin", async () => {
    const token = makeToken();
    const res = await st().get("/v1/tecma/storage/assets-diagnostics").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("200 con Tecma admin e body data.env", async () => {
    const token = makeToken({ system_role: "tecma_admin" });
    const res = await st().get("/v1/tecma/storage/assets-diagnostics").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.data?.env?.region).toBe("eu-west-1");
    expect(getDiagMock).toHaveBeenCalledWith({ probe: false });
  });

  it("passa probe=1 a diagnostica", async () => {
    const token = makeToken({ system_role: "tecma_admin", isTecmaAdmin: true });
    await st().get("/v1/tecma/storage/assets-diagnostics?probe=1").set("Authorization", `Bearer ${token}`);
    expect(getDiagMock).toHaveBeenCalledWith({ probe: true });
  });
});
