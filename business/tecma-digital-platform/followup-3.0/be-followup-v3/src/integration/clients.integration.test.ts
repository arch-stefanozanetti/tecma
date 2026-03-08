/**
 * Integration test: clients.service con MongoDB in-memory.
 * Verifica createClient, getClientById, queryClients con DB reale (no mock).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("integration: clients service", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-db";
  }, 30_000);

  afterAll(async () => {
    await mongod?.stop();
  });

  it("createClient inserts and getClientById returns the client", async () => {
    const { connectDb } = await import("../config/db.js");
    await connectDb();
    const { createClient, getClientById } = await import("../core/clients/clients.service.js");

    const { client: created } = await createClient({
      workspaceId: "ws1",
      projectId: "p1",
      fullName: "Mario Rossi",
      email: "mario@test.it",
      status: "lead",
    });
    expect(created._id).toBeDefined();
    expect(created.fullName).toBe("Mario Rossi");
    expect(created.email).toBe("mario@test.it");
    expect(created.status).toBe("lead");
    expect(created.projectId).toBe("p1");

    const { client: found } = await getClientById(created._id);
    expect(found._id).toBe(created._id);
    expect(found.fullName).toBe("Mario Rossi");
    expect(found.email).toBe("mario@test.it");
  });

  it("queryClients returns paginated list", async () => {
    const { getDb } = await import("../config/db.js");
    const db = getDb();
    const { queryClients } = await import("../core/clients/clients.service.js");

    const result = await queryClients({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 10,
    });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination).toBeDefined();
    expect(typeof result.pagination.page).toBe("number");
    expect(typeof result.pagination.perPage).toBe("number");
    expect(typeof result.pagination.total).toBe("number");
    expect(typeof result.pagination.totalPages).toBe("number");
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });
});
