import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { signAccessToken, type AccessTokenPayload } from "../core/auth/token.service.js";

function makeToken(overrides: Partial<AccessTokenPayload> = {}): string {
  return signAccessToken({
    sub: "u1",
    email: "u@test.it",
    role: "user",
    isAdmin: false,
    permissions: ["apartments.read"],
    projectId: null,
    ...overrides
  });
}
import { ListQuerySchema } from "../core/shared/list-query.js";

vi.mock("../core/clients/clients.service.js", () => ({
  queryClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  getClientById: vi.fn().mockImplementation(async (rawId: unknown) => {
    const id = String(rawId);
    if (id === "404") {
      const err = new Error("Client not found");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return {
      client: {
        _id: id,
        projectId: "p1",
        fullName: "Test Client",
        email: "test@test.it",
        phone: "+39 123",
        status: "lead",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        city: "Roma",
        source: undefined,
        myhomeVersion: undefined,
        createdBy: undefined
      }
    };
  })
}));

vi.mock("../core/apartments/apartments.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/apartments/apartments.service.js")>();
  return {
    ...actual,
    queryApartments: vi.fn().mockImplementation(async (rawInput: unknown) => {
      ListQuerySchema.parse(rawInput);
      return {
        data: [],
        pagination: { page: 1, perPage: 25, total: 0, totalPages: 0 }
      };
    }),
    getApartmentById: vi.fn(),
    createApartment: vi.fn(),
    updateApartment: vi.fn(),
  };
});

vi.mock("../core/requests/requests.service.js", () => ({
  queryRequests: vi.fn().mockImplementation(async (rawInput: unknown) => {
    ListQuerySchema.parse(rawInput);
    return {
      data: [],
      pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 }
    };
  }),
  getRequestById: vi.fn(),
  createRequest: vi.fn().mockImplementation(async (rawInput: unknown) => {
    const input = rawInput as { workspaceId: string; projectId: string; clientId: string; apartmentId?: string; type: string; status?: string };
    if (!input?.workspaceId || !input?.projectId || !input?.clientId || !input?.type) {
      throw new Error("Invalid request body");
    }
    const now = new Date().toISOString();
    return {
      request: {
        _id: "req-mock-1",
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        clientId: input.clientId,
        apartmentId: input.apartmentId ?? undefined,
        type: input.type,
        status: input.status ?? "new",
        createdAt: now,
        updatedAt: now,
        clientName: undefined,
        apartmentCode: undefined
      }
    };
  })
}));

import { v1Router } from "./v1.js";

const app = express();
app.use(express.json());
app.use("/v1", v1Router);

describe("v1 routes", () => {
  describe("GET /v1/health", () => {
    it("returns 200 and { ok: true, service: string }", async () => {
      const res = await request(app).get("/v1/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, service: "be-followup-v3" });
    });
  });

  describe("GET /v1/openapi.json", () => {
    it("returns 200 and OpenAPI object with openapi and paths", async () => {
      const res = await request(app).get("/v1/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBeDefined();
      expect(res.body.paths).toBeDefined();
      expect(typeof res.body.paths).toBe("object");
    });
    it("exposes Riusabili tag and tags apartments/query and clients/lite/query as Riusabili", async () => {
      const res = await request(app).get("/v1/openapi.json");
      expect(res.status).toBe(200);
      const tags = res.body.tags || [];
      expect(tags.some((t: { name: string }) => t.name === "Riusabili")).toBe(true);
      expect(res.body.paths["/apartments/query"]?.post?.tags).toContain("Riusabili");
      expect(res.body.paths["/clients/lite/query"]?.post?.tags).toContain("Riusabili");
    });
    it("documents public listings path", async () => {
      const res = await request(app).get("/v1/openapi.json");
      expect(res.status).toBe(200);
      expect(res.body.paths["/public/listings"]?.post).toBeDefined();
      expect(res.body.paths["/public/listings"].post.summary).toContain("Public");
    });
  });

  describe("POST /v1/public/listings", () => {
    it("returns 200 with paginated data when body is valid (no JWT required)", async () => {
      const res = await request(app)
        .post("/v1/public/listings")
        .set("Content-Type", "application/json")
        .send({
          workspaceId: "dev-1",
          projectIds: ["project-01"],
          page: 1,
          perPage: 25
        });
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toEqual({ page: 1, perPage: 25, total: 0, totalPages: 0 });
    });
    it("returns 400 when body is invalid", async () => {
      const res = await request(app)
        .post("/v1/public/listings")
        .set("Content-Type", "application/json")
        .send({ workspaceId: "dev-1" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("platform boundary", () => {
    it("GET /v1/platform/capabilities returns 401 without x-api-key", async () => {
      const res = await request(app).get("/v1/platform/capabilities");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /v1/session/projects-by-email", () => {
    it("returns 400 when body is invalid", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/session/projects-by-email")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("auth middleware", () => {
    it("returns 401 when no token", async () => {
      const res = await request(app).get("/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("returns 401 when token is invalid", async () => {
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", "Bearer invalid.jwt.token");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("sets req.user and returns user when valid token", async () => {
      const token = makeToken({
        sub: "user-1",
        email: "u@test.it",
        role: "user",
        isAdmin: false,
        permissions: ["apartments.read"],
        projectId: "p1"
      });
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: "user-1",
        email: "u@test.it",
        role: "user",
        isAdmin: false,
        permissions: ["apartments.read"],
        projectId: "p1",
        isTecmaAdmin: false,
      });
    });
  });

  describe("realtime stream", () => {
    it("returns 401 when token is missing", async () => {
      const res = await request(app).get("/v1/realtime/stream?workspaceId=ws1");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /v1/auth/refresh", () => {
    it("returns 400 when body is invalid", async () => {
      const res = await request(app).post("/v1/auth/refresh").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /v1/requests/query", () => {
    const validBody = {
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 10
    };

    it("returns 401 when no token", async () => {
      const res = await request(app).post("/v1/requests/query").send(validBody);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("returns 200 with data and pagination when body is valid and JWT present", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/requests/query")
        .set("Authorization", `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(typeof res.body.pagination.page).toBe("number");
      expect(typeof res.body.pagination.perPage).toBe("number");
      expect(typeof res.body.pagination.total).toBe("number");
      expect(typeof res.body.pagination.totalPages).toBe("number");
    });

    it("returns 400 when body is invalid (missing workspaceId)", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/requests/query")
        .set("Authorization", `Bearer ${token}`)
        .send({ projectIds: ["p1"] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 400 when body is invalid (empty projectIds)", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/requests/query")
        .set("Authorization", `Bearer ${token}`)
        .send({ workspaceId: "ws1", projectIds: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("POST /v1/requests", () => {
    const validBody = {
      workspaceId: "ws1",
      projectId: "p1",
      clientId: "c1",
      type: "sell",
      status: "new"
    };

    it("returns 401 when no token", async () => {
      const res = await request(app).post("/v1/requests").send(validBody);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("returns 200 with request when body is valid and JWT present", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/requests")
        .set("Authorization", `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(200);
      expect(res.body.request).toBeDefined();
      expect(res.body.request._id).toBeDefined();
      expect(res.body.request.workspaceId).toBe("ws1");
      expect(res.body.request.projectId).toBe("p1");
      expect(res.body.request.clientId).toBe("c1");
      expect(res.body.request.type).toBe("sell");
      expect(res.body.request.status).toBe("new");
      expect(res.body.request.createdAt).toBeDefined();
      expect(res.body.request.updatedAt).toBeDefined();
    });

    it("returns 400 when body is invalid (missing clientId)", async () => {
      const token = makeToken();
      const res = await request(app)
        .post("/v1/requests")
        .set("Authorization", `Bearer ${token}`)
        .send({ workspaceId: "ws1", projectId: "p1", type: "sell" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("GET /v1/clients/:id", () => {
    it("returns 401 when no token", async () => {
      const res = await request(app).get("/v1/clients/c1");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("returns 200 with client when id is valid and JWT present", async () => {
      const token = makeToken();
      const res = await request(app)
        .get("/v1/clients/c1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.client).toBeDefined();
      expect(res.body.client._id).toBe("c1");
      expect(res.body.client.fullName).toBe("Test Client");
      expect(res.body.client.email).toBe("test@test.it");
      expect(res.body.client.status).toBe("lead");
    });

    it("returns 404 when client not found", async () => {
      const token = makeToken();
      const res = await request(app)
        .get("/v1/clients/404")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
