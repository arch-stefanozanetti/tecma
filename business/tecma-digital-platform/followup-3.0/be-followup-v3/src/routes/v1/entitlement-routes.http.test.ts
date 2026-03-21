/**
 * Smoke HTTP: stack reale (JWT + permessi + middleware entitlement) → 403 FEATURE_NOT_ENTITLED.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
import { signAccessToken, type AccessTokenPayload } from "../../core/auth/token.service.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireAuth } from "../authMiddleware.js";
import { intelligenceRoutes } from "./intelligence.routes.js";
import { connectorsRoutes } from "./connectors.routes.js";

const isWorkspaceEntitledToFeature = vi.hoisted(() => vi.fn());

vi.mock("../../core/workspaces/workspace-entitlements.service.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../core/workspaces/workspace-entitlements.service.js")>();
  return { ...orig, isWorkspaceEntitledToFeature };
});

vi.mock("../../core/reports/reports.service.js", () => ({
  runReport: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock("../../core/connectors/n8n.service.js", () => ({
  getN8nConfig: vi.fn().mockResolvedValue(null),
  saveN8nConfig: vi.fn(),
  triggerN8nWorkflow: vi.fn(),
  deleteN8nConfig: vi.fn(),
}));

vi.mock("../../core/connectors/whatsapp-config.service.js", () => ({
  getWhatsAppConfig: vi.fn(),
  saveWhatsAppConfig: vi.fn(),
  deleteWhatsAppConfig: vi.fn(),
}));

vi.mock("../../core/connectors/meta-whatsapp-config.service.js", () => ({
  getMetaWhatsAppConfig: vi.fn(),
  saveMetaWhatsAppConfig: vi.fn(),
  deleteMetaWhatsAppConfig: vi.fn(),
}));

vi.mock("../../core/communications/whatsapp.service.js", () => ({
  sendWhatsAppMessage: vi.fn(),
}));

vi.mock("../../core/messaging/messaging-gateway.service.js", () => ({
  sendWithMessagingGateway: vi.fn(),
}));

vi.mock("../../core/connectors/outlook.service.js", () => ({
  getAuthUrl: vi.fn(),
  getCalendarEvents: vi.fn(),
  hasOutlookConnected: vi.fn(),
  deleteOutlookCredentials: vi.fn(),
}));

function makeToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: "u1",
    email: "u@test.it",
    role: "user",
    isAdmin: false,
    permissions: [PERMISSIONS.REPORTS_READ, PERMISSIONS.INTEGRATIONS_READ],
    projectId: null,
    ...overrides,
  });
}

function mountV1Subset(...routers: express.Router[]): express.Application {
  const app = express();
  app.use(express.json());
  const r = express.Router();
  r.use(requireAuth);
  for (const sub of routers) {
    r.use("/", sub);
  }
  app.use("/v1", r);
  return app;
}

const entitlementApp = mountV1Subset(intelligenceRoutes, connectorsRoutes);

describe("HTTP entitlement enforcement", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const x = await listenStable(entitlementApp);
    server = x.server;
    origin = x.origin;
  });

  afterAll(async () => {
    await closeStable(server);
  });

  const st = () => stableRequest(origin);

  beforeEach(() => {
    isWorkspaceEntitledToFeature.mockReset();
  });

  it("POST /v1/reports/:type → 403 FEATURE_NOT_ENTITLED se reports non attivo", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(false);
    const token = makeToken();
    const res = await st()
      .post("/v1/reports/pipeline")
      .set("Authorization", `Bearer ${token}`)
      .send({ workspaceId: "ws1", projectIds: ["p1"] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FEATURE_NOT_ENTITLED");
    expect(isWorkspaceEntitledToFeature).toHaveBeenCalledWith("ws1", "reports");
  });

  it("GET /v1/workspaces/:workspaceId/connectors/n8n/config → 403 FEATURE_NOT_ENTITLED se integrations non attivo", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(false);
    const token = makeToken();
    const res = await st()
      .get("/v1/workspaces/ws2/connectors/n8n/config")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FEATURE_NOT_ENTITLED");
    expect(isWorkspaceEntitledToFeature).toHaveBeenCalledWith("ws2", "integrations");
  });
});
