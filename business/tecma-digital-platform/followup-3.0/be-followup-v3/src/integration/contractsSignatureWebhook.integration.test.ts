/**
 * Webhook firme: autenticazione con SIGNATURE_WEBHOOK_SECRET + applicazione stato.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import { closeStable, listenStable, stableRequest } from "../test/stableHttpServer.js";

describe("integration: contracts signature webhook", () => {
  let mongod: MongoMemoryServer;
  let server: Server;
  let origin: string;
  const WEBHOOK_SECRET = "integration-test-signature-webhook-32chars!!";

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-contracts-webhook";
    process.env.EMAIL_TRANSPORT = "mock";
    process.env.AUTH_JWT_SECRET = "integration-auth-secret-32chars-minimum!!";
    process.env.APP_ENV = "dev-1";
    process.env.NODE_ENV = "test";
    process.env.SIGNATURE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { disconnectDb, connectDb, getDb } = await import("../config/db.js");
    await disconnectDb();
    await connectDb();
    const db = getDb();
    await db.collection("tz_signature_requests").deleteMany({ providerRequestId: "prov-req-webhook-int" });
    await db.collection("tz_signature_requests").insertOne({
      workspaceId: "ws-test",
      requestId: "req-test",
      provider: "yousign",
      providerRequestId: "prov-req-webhook-int",
      signer: { fullName: "T", email: "t@test.local" },
      document: { title: "D", fileUrl: "https://example.com/f.pdf" },
      status: "pending",
      signingUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { v1Router } = await import("../routes/v1.js");
    const httpApp = express();
    httpApp.use(express.json());
    httpApp.use("/v1", v1Router);
    const x = await listenStable(httpApp);
    server = x.server;
    origin = x.origin;
  }, 60_000);

  afterAll(async () => {
    await closeStable(server);
    const { disconnectDb } = await import("../config/db.js");
    await disconnectDb();
    await mongod?.stop();
  });

  const st = () => stableRequest(origin);

  it("401 senza segreto", async () => {
    const res = await st()
      .post("/v1/contracts/signature-requests/webhook")
      .send({ provider: "yousign", providerRequestId: "prov-req-webhook-int", status: "ignored" });
    expect(res.status).toBe(401);
  });

  it("200 con Bearer e aggiorna stato", async () => {
    const res = await st()
      .post("/v1/contracts/signature-requests/webhook")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send({ provider: "yousign", providerRequestId: "prov-req-webhook-int", status: "done" });
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    const { getDb } = await import("../config/db.js");
    const doc = await getDb().collection("tz_signature_requests").findOne({ providerRequestId: "prov-req-webhook-int" });
    expect(doc?.status).toBe("completed");
  });
});
