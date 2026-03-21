/**
 * POST /workspaces — solo admin (`requireAdmin`: isAdmin o permesso `*`).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
import { signAccessToken, type AccessTokenPayload } from "../../core/auth/token.service.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireAuth } from "../authMiddleware.js";
import { workspacesRoutes } from "./workspaces.routes.js";

const createWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock("../../core/workspaces/workspaces.service.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../core/workspaces/workspaces.service.js")>();
  return { ...mod, createWorkspace: createWorkspaceMock };
});

vi.mock("../../core/audit/audit-log.service.js", () => ({
  record: vi.fn().mockResolvedValue(undefined),
}));

function makeToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: "u1",
    email: "admin@test.it",
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

describe("POST /workspaces — requireAdmin", () => {
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
    createWorkspaceMock.mockReset();
    createWorkspaceMock.mockResolvedValue({
      workspace: {
        _id: "ws-new",
        name: "Nuovo WS",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("403 per utente senza privilegi admin", async () => {
    const token = makeToken({ permissions: [PERMISSIONS.CLIENTS_READ] });
    const res = await st()
      .post("/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "X" });
    expect(res.status).toBe(403);
    expect(createWorkspaceMock).not.toHaveBeenCalled();
  });

  it("200 con isAdmin true", async () => {
    const token = makeToken({ isAdmin: true, permissions: ["*"] });
    const res = await st()
      .post("/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nuovo WS" });
    expect(res.status).toBe(200);
    expect(createWorkspaceMock).toHaveBeenCalledWith({ name: "Nuovo WS" });
    expect(res.body.workspace).toMatchObject({ _id: "ws-new", name: "Nuovo WS" });
  });

  it("200 con solo permesso * (normalizzato come admin dal JWT)", async () => {
    const token = makeToken({ isAdmin: false, permissions: ["*"] });
    const res = await st()
      .post("/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Da star" });
    expect(res.status).toBe(200);
    expect(createWorkspaceMock).toHaveBeenCalledWith({ name: "Da star" });
  });
});
