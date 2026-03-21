/**
 * Worker cancellazione GDPR: pending erasure → profilo anonimizzato e correlati rimossi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ObjectId } from "mongodb";

describe("integration: GDPR erasure worker", () => {
  let mongod: MongoMemoryServer;
  let storedUserId: ObjectId;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-gdpr-erasure";
    process.env.AUTH_JWT_SECRET = "gdpr-erasure-test-secret";
    const { disconnectDb, connectDb, getDb } = await import("../config/db.js");
    await disconnectDb();
    await connectDb();
    const db = getDb();
    const userId = new ObjectId();
    storedUserId = userId;
    const email = "erase-me@test.local";
    await db.collection("tz_users").deleteMany({ email });
    await db.collection("tz_gdpr_requests").deleteMany({ email });
    await db.collection("tz_users").insertOne({
      _id: userId,
      email,
      fullName: "Da Cancellare",
      role: "agent",
      isDisabled: false,
      status: "active"
    });
    await db.collection("tz_user_workspaces").insertOne({
      userId: email,
      workspaceId: "w1",
      role: "viewer"
    });
    await db.collection("tz_gdpr_requests").insertOne({
      _id: new ObjectId(),
      userId: userId.toHexString(),
      email,
      type: "erasure",
      status: "pending",
      createdAt: new Date()
    });
  }, 45_000);

  afterAll(async () => {
    const { disconnectDb } = await import("../config/db.js");
    await disconnectDb();
    await mongod?.stop();
  });

  it("processPendingGdprErasureBatch completa richiesta e anonimizza utente", async () => {
    const { getDb } = await import("../config/db.js");
    const { processPendingGdprErasureBatch } = await import("../core/gdpr/gdpr-erasure.worker.js");
    const before = await getDb().collection("tz_gdpr_requests").countDocuments({ type: "erasure", status: "pending" });
    expect(before).toBeGreaterThanOrEqual(1);

    const { processed, failed } = await processPendingGdprErasureBatch({ limit: 5 });
    expect(failed).toBe(0);
    expect(processed).toBeGreaterThanOrEqual(1);

    const req = await getDb().collection("tz_gdpr_requests").findOne({ type: "erasure", email: "erase-me@test.local" });
    expect(req?.status).toBe("completed");

    const user = await getDb().collection("tz_users").findOne({ _id: storedUserId });
    expect(user?.email).toMatch(/^erased\+/);
    expect(user?.fullName).toBe("[Dati cancellati]");
    expect(user?.status).toBe("deleted");

    const ws = await getDb().collection("tz_user_workspaces").countDocuments({ userId: "erase-me@test.local" });
    expect(ws).toBe(0);
  });
});
