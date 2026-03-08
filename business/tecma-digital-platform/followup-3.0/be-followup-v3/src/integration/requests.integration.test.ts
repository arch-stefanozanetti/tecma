/**
 * Integration test: requests.service con MongoDB in-memory.
 * Verifica createRequest, getRequestById, queryRequests con DB reale (no mock).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("integration: requests service", () => {
  let mongod: MongoMemoryServer;
  let clientId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-db";
    const { connectDb } = await import("../config/db.js");
    await connectDb();
    const { createClient } = await import("../core/clients/clients.service.js");
    const { client } = await createClient({
      workspaceId: "ws1",
      projectId: "p1",
      fullName: "Cliente Request Test",
    });
    clientId = client._id;
  }, 30_000);

  afterAll(async () => {
    await mongod?.stop();
  });

  it("createRequest inserts and getRequestById returns the request", async () => {
    const { createRequest, getRequestById } = await import("../core/requests/requests.service.js");

    const { request: created } = await createRequest({
      workspaceId: "ws1",
      projectId: "p1",
      clientId,
      type: "sell",
      status: "new",
    });
    expect(created._id).toBeDefined();
    expect(created.workspaceId).toBe("ws1");
    expect(created.projectId).toBe("p1");
    expect(created.clientId).toBe(clientId);
    expect(created.type).toBe("sell");
    expect(created.status).toBe("new");
    expect(created.createdAt).toBeDefined();
    expect(created.updatedAt).toBeDefined();

    const { request: found } = await getRequestById(created._id);
    expect(found._id).toBe(created._id);
    expect(found.clientId).toBe(clientId);
    expect(found.type).toBe("sell");
  });

  it("queryRequests returns paginated list", async () => {
    const { queryRequests } = await import("../core/requests/requests.service.js");

    const result = await queryRequests({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 10,
    });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination).toBeDefined();
    expect(typeof result.pagination.page).toBe("number");
    expect(typeof result.pagination.total).toBe("number");
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });
});
