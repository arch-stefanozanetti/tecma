import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("integration: db", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-db";
  }, 30_000);

  afterAll(async () => {
    await mongod?.stop();
  });

  it("connects and lists collections", async () => {
    const { connectDb } = await import("../config/db.js");
    const db = await connectDb();
    const cols = await db.listCollections().toArray();
    expect(Array.isArray(cols)).toBe(true);
  });

  it("inserts and finds a document", async () => {
    const { getDb } = await import("../config/db.js");
    const db = getDb();
    const coll = db.collection("integration_test");
    await coll.deleteMany({});
    const inserted = await coll.insertOne({ name: "test", value: 1 });
    expect(inserted.acknowledged).toBe(true);
    const found = await coll.findOne({ name: "test" });
    expect(found).not.toBeNull();
    expect(found?.value).toBe(1);
  });
});
