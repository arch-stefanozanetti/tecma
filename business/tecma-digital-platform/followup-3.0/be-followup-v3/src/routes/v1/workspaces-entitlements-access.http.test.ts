/**
 * Access control su GET/PATCH entitlement workspace (Tecma-only su PATCH, permessi + canAccess su GET).
 * Un solo `listen` per file: evita server effimeri per richiesta (meno ECONNRESET sotto Vitest parallelo).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
import { signAccessToken, type AccessTokenPayload } from "../../core/auth/token.service.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireAuth } from "../authMiddleware.js";
import { workspacesRoutes } from "./workspaces.routes.js";

const canAccessMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("../../core/access/canAccess.js", () => ({
  canAccess: canAccessMock,
  getWorkspacesForUser: vi.fn().mockResolvedValue(["ws1"]),
  getProjectsAccessibleByUser: vi.fn().mockResolvedValue(["p1"]),
}));

const entMocks = vi.hoisted(() => ({
  listEffective: vi.fn(),
  listWorkspace: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../../core/workspaces/workspace-entitlements.service.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../core/workspaces/workspace-entitlements.service.js")>();
  return {
    ...mod,
    listEffectiveWorkspaceEntitlements: entMocks.listEffective,
    listWorkspaceEntitlements: entMocks.listWorkspace,
    upsertWorkspaceEntitlement: entMocks.upsert,
  };
});

vi.mock("../../core/audit/audit-log.service.js", () => ({
  record: vi.fn().mockResolvedValue(undefined),
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
{
  const r = express.Router();
  r.use(requireAuth);
  r.use(workspacesRoutes);
  app.use("/v1", r);
}

describe("HTTP workspaces/:id/entitlements — access control", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const x = await listenStable(app);
    server = x.server;
    origin = x.origin;
  });

  afterAll(async () => {
    await closeStable(server);
  });

  const st = () => stableRequest(origin);

  beforeEach(() => {
    canAccessMock.mockReset();
    canAccessMock.mockResolvedValue(true);
    entMocks.listEffective.mockReset();
    entMocks.listWorkspace.mockReset();
    entMocks.upsert.mockReset();
    entMocks.listEffective.mockResolvedValue([]);
    entMocks.listWorkspace.mockResolvedValue([]);
    entMocks.upsert.mockResolvedValue({
      _id: "e1",
      workspaceId: "ws1",
      feature: "reports",
      status: "active",
      billingMode: "manual_invoice",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("GET /workspaces/:id/entitlements → 403 senza settings.read (né Tecma)", async () => {
    const token = makeToken({ permissions: [PERMISSIONS.CLIENTS_READ] });
    const res = await st()
      .get("/v1/workspaces/ws1/entitlements")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(entMocks.listEffective).not.toHaveBeenCalled();
  });

  it("GET /workspaces/:id/entitlements → 200 con settings.read e canAccess", async () => {
    const token = makeToken();
    const res = await st()
      .get("/v1/workspaces/ws1/entitlements")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(entMocks.listEffective).toHaveBeenCalledWith("ws1");
  });

  it("GET /workspaces/:id/entitlements → 200 per Tecma admin senza settings.read (bypass permesso)", async () => {
    const token = makeToken({ permissions: [], isTecmaAdmin: true });
    const res = await st()
      .get("/v1/workspaces/ws1/entitlements")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(entMocks.listEffective).toHaveBeenCalledWith("ws1");
  });

  it("GET /workspaces/:id/entitlements → 403 se canAccess negato", async () => {
    canAccessMock.mockResolvedValueOnce(false);
    const token = makeToken();
    const res = await st()
      .get("/v1/workspaces/ws1/entitlements")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(entMocks.listEffective).not.toHaveBeenCalled();
  });

  it("PATCH /workspaces/:id/entitlements/:feature → 403 per admin workspace senza ruolo Tecma", async () => {
    const token = makeToken({
      isAdmin: true,
      permissions: ["*"],
      isTecmaAdmin: false,
      system_role: undefined,
    });
    const res = await st()
      .patch("/v1/workspaces/ws1/entitlements/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active", billingMode: "manual_invoice" });
    expect(res.status).toBe(403);
    expect(entMocks.upsert).not.toHaveBeenCalled();
  });

  it("PATCH /workspaces/:id/entitlements/:feature → 200 per Tecma admin", async () => {
    const token = makeToken({
      isTecmaAdmin: true,
      permissions: [],
    });
    const res = await st()
      .patch("/v1/workspaces/ws1/entitlements/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active", billingMode: "manual_invoice" });
    expect(res.status).toBe(200);
    expect(res.body.entitlement?.feature).toBe("reports");
    expect(entMocks.upsert).toHaveBeenCalled();
  });
});
