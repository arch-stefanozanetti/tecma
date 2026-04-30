/**
 * GET /workspaces: utenti non admin/Tecma ricevono solo i workspace di membership (no leak elenco globale).
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
import { signAccessToken, type AccessTokenPayload } from "../../core/auth/token.service.js";
import { requireAuth } from "../authMiddleware.js";
import { workspacesRoutes } from "./workspaces.routes.js";
import type { WorkspaceRow } from "../../core/workspaces/workspaces.service.js";

const listWorkspacesMock = vi.hoisted(() => vi.fn());
const listWorkspaceIdsForUserMock = vi.hoisted(() => vi.fn());

vi.mock("../../core/workspaces/workspaces.service.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../core/workspaces/workspaces.service.js")>();
  return { ...mod, listWorkspaces: listWorkspacesMock };
});

vi.mock("../../core/workspaces/workspace-users.service.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../core/workspaces/workspace-users.service.js")>();
  return { ...mod, listWorkspaceIdsForUser: listWorkspaceIdsForUserMock };
});

const ALL: WorkspaceRow[] = [
  { _id: "ws1", name: "Uno", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { _id: "ws2", name: "Due", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { _id: "ws3", name: "Tre", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

function makeToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: "u1",
    email: "collab@cliente.test",
    role: "user",
    isAdmin: false,
    permissions: ["clients.read"],
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

describe("GET /workspaces — filtro membership", () => {
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
    listWorkspacesMock.mockReset();
    listWorkspaceIdsForUserMock.mockReset();
    listWorkspacesMock.mockResolvedValue(ALL);
    listWorkspaceIdsForUserMock.mockResolvedValue(["ws1", "ws3"]);
  });

  it("utente normale vede solo workspace in membership", async () => {
    const token = makeToken();
    const res = await st().get("/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    const ids = (res.body as WorkspaceRow[]).map((w) => w._id).sort();
    expect(ids).toEqual(["ws1", "ws3"]);
    expect(listWorkspaceIdsForUserMock).toHaveBeenCalledWith("collab@cliente.test");
  });

  it("isAdmin riceve elenco completo (nessun filtro)", async () => {
    const token = makeToken({ isAdmin: true, permissions: ["*"] });
    const res = await st().get("/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(listWorkspaceIdsForUserMock).not.toHaveBeenCalled();
  });

  it("Tecma admin riceve elenco completo", async () => {
    const token = makeToken({ isTecmaAdmin: true, permissions: [] });
    const res = await st().get("/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(listWorkspaceIdsForUserMock).not.toHaveBeenCalled();
  });

  it("system_role tecma_admin riceve elenco completo", async () => {
    const token = makeToken({ system_role: "tecma_admin", permissions: [] });
    const res = await st().get("/v1/workspaces").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });
});
