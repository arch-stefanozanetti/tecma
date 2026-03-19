/**
 * Identity MDOO: invito, set-password, login, permessi GET /users.
 * Nessun import statico di moduli che leggono ENV prima del beforeAll.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("integration: identity (MDOO)", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.INVITE_ALLOW_MOCK_EMAIL = "true";
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-identity";
    process.env.EMAIL_TRANSPORT = "mock";
    process.env.AUTH_JWT_SECRET = "integration-identity-secret";
    const { disconnectDb, connectDb, getDb } = await import("../config/db.js");
    await disconnectDb();
    await connectDb();
    const { ensureDefaultRoleDefinitions } = await import("../core/rbac/roleDefinitions.service.js");
    await ensureDefaultRoleDefinitions();
    const db = getDb();
    await db.collection("tz_users").deleteMany({
      email: {
        $in: ["admin-identity@test.local", "invonly@test.local", "invited-flow@test.local"]
      }
    });
    const hash = await bcrypt.hash("AdminPass123", 12);
    await db.collection("tz_users").insertOne({
      email: "admin-identity@test.local",
      password: hash,
      role: "admin",
      isDisabled: false,
      status: "active"
    });
  }, 45_000);

  afterAll(async () => {
    const { disconnectDb } = await import("../config/db.js");
    await disconnectDb();
    await mongod?.stop();
  });

  it("invited user without password cannot login", async () => {
    const { loginWithCredentials } = await import("../core/auth/auth.service.js");
    const { getDb } = await import("../config/db.js");
    await getDb().collection("tz_users").deleteOne({ email: "invonly@test.local" });
    await getDb().collection("tz_users").insertOne({
      email: "invonly@test.local",
      role: "agent",
      status: "invited"
    });
    await expect(
      loginWithCredentials({ email: "invonly@test.local", password: "whatever" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("invite → set password → login works", async () => {
    const { resetEmailMockOutbox, getEmailMockOutbox } = await import("../core/email/email.service.js");
    const { getDb } = await import("../config/db.js");
    resetEmailMockOutbox();
    await getDb().collection("tz_users").deleteOne({ email: "invited-flow@test.local" });
    const { inviteUser, setPasswordFromInvite } = await import("../core/users/users-mutations.service.js");
    const { loginWithCredentials } = await import("../core/auth/auth.service.js");
    await inviteUser({
      email: "invited-flow@test.local",
      projectId: "proj-1",
      projectName: "Test Project",
      appPublicBaseUrl: "http://localhost:5177",
      roleLabel: "Vendor"
    });
    const out = getEmailMockOutbox();
    expect(out.length).toBe(1);
    const tokenMatch = out[0].html.match(/token=([a-f0-9]+)/i);
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch![1];
    const activated = await setPasswordFromInvite({ token: rawToken, password: "NewUserPass99" });
    expect(activated.accessToken).toBeTruthy();
    expect(activated.user).toMatchObject({ email: "invited-flow@test.local" });
    const login = await loginWithCredentials({ email: "invited-flow@test.local", password: "NewUserPass99" });
    expect(login.user.permissions).toBeDefined();
    expect(Array.isArray(login.user.permissions)).toBe(true);
  });

  it("GET /v1/users returns 403 without users.read", async () => {
    const { signAccessToken } = await import("../core/auth/token.service.js");
    const { v1Router } = await import("../routes/v1.js");
    const app = express();
    app.use(express.json());
    app.use("/v1", v1Router);
    const vendorToken = signAccessToken({
      sub: "vendor-1",
      email: "vendor@test.local",
      role: "vendor",
      isAdmin: false,
      permissions: ["apartments.read", "deals.close"],
      projectId: null
    });
    const res = await request(app).get("/v1/users").set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /v1/users returns 200 for admin JWT", async () => {
    const { signAccessToken } = await import("../core/auth/token.service.js");
    const { v1Router } = await import("../routes/v1.js");
    const app = express();
    app.use(express.json());
    app.use("/v1", v1Router);
    const adminToken = signAccessToken({
      sub: "adm",
      email: "admin-identity@test.local",
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      projectId: null
    });
    const res = await request(app).get("/v1/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
