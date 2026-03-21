/**
 * Integration: route HTTP /v1/auth/*, POST /users, reset password, SSO HS256.
 * Env isolato: nessun import statico che carichi config prima del beforeAll.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import { closeStable, listenStable, stableRequest } from "../test/stableHttpServer.js";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { ObjectId } from "mongodb";

describe("integration: auth HTTP routes", () => {
  let mongod: MongoMemoryServer;
  let adminId: string;
  let server: Server;
  let origin: string;
  const SSO_SECRET = "integration-sso-hs256-secret-key-min-32";

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.INVITE_ALLOW_MOCK_EMAIL = "true";
    process.env.MONGO_URI = mongod.getUri();
    process.env.MONGO_DB_NAME = "test-auth-http";
    process.env.EMAIL_TRANSPORT = "mock";
    process.env.AUTH_JWT_SECRET = "integration-auth-routes-secret-32ch!!";
    process.env.APP_ENV = "dev-1";
    process.env.NODE_ENV = "test";
    process.env.SSO_JWT_HS256_SECRET = SSO_SECRET;
    const { disconnectDb, connectDb, getDb } = await import("../config/db.js");
    await disconnectDb();
    await connectDb();
    const { ensureDefaultRoleDefinitions } = await import("../core/rbac/roleDefinitions.service.js");
    await ensureDefaultRoleDefinitions();
    const db = getDb();
    await db.collection("tz_users").deleteMany({
      email: {
        $in: [
          "admin-auth-api@test.local",
          "reset-user@test.local",
          "invite-api@test.local",
          "dup-invite@test.local",
          "double-token@test.local"
        ]
      }
    });
    const ins = await db.collection("tz_users").insertOne({
      email: "admin-auth-api@test.local",
      password: await bcrypt.hash("SecureAdmin99", 12),
      role: "admin",
      isDisabled: false,
      status: "active",
      project_ids: ["proj-auth-1"]
    });
    adminId = (ins.insertedId as ObjectId).toHexString();
    await db.collection("tz_users").insertOne({
      email: "reset-user@test.local",
      password: await bcrypt.hash("OldPass12345", 12),
      role: "collaborator",
      status: "active",
      project_ids: ["proj-auth-1"]
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

  it("POST /auth/login returns 200 and tokens for valid credentials", async () => {
    const res = await st()
      .post("/v1/auth/login")
      .send({ email: "admin-auth-api@test.local", password: "SecureAdmin99" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user?.email).toBe("admin-auth-api@test.local");
  });

  it("POST /auth/login returns 401 for wrong password", async () => {
    const res = await st()
      .post("/v1/auth/login")
      .send({ email: "admin-auth-api@test.local", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenziali/i);
  });

  it("POST /auth/refresh rotates session; old refresh invalid", async () => {
    const login = await st()
      .post("/v1/auth/login")
      .send({ email: "admin-auth-api@test.local", password: "SecureAdmin99" });
    const rt1 = login.body.refreshToken as string;
    const r1 = await st().post("/v1/auth/refresh").send({ refreshToken: rt1 });
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();
    const rt2 = r1.body.refreshToken as string;
    expect(rt2).not.toBe(rt1);
    const rOld = await st().post("/v1/auth/refresh").send({ refreshToken: rt1 });
    expect(rOld.status).toBe(401);
    const r2 = await st().post("/v1/auth/refresh").send({ refreshToken: rt2 });
    expect(r2.status).toBe(200);
  });

  it("POST /auth/logout invalidates refresh", async () => {
    const login = await st()
      .post("/v1/auth/login")
      .send({ email: "admin-auth-api@test.local", password: "SecureAdmin99" });
    const rt = login.body.refreshToken as string;
    await st().post("/v1/auth/logout").send({ refreshToken: rt });
    const r = await st().post("/v1/auth/refresh").send({ refreshToken: rt });
    expect(r.status).toBe(401);
  });

  it("POST /auth/sso-exchange with valid HS256 JWT returns 200", async () => {
    const ssoJwt = jwt.sign({ email: "admin-auth-api@test.local" }, SSO_SECRET, {
      algorithm: "HS256"
    });
    const res = await st().post("/v1/auth/sso-exchange").send({ ssoJwt });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user?.email).toBe("admin-auth-api@test.local");
  });

  it("POST /auth/sso-exchange with bad signature returns 401", async () => {
    const bad = jwt.sign({ email: "admin-auth-api@test.local" }, "wrong-secret", {
      algorithm: "HS256"
    });
    const res = await st().post("/v1/auth/sso-exchange").send({ ssoJwt: bad });
    expect(res.status).toBe(401);
  });

  it("POST /auth/sso-exchange unknown user returns 401 generic", async () => {
    const ssoJwt = jwt.sign({ email: "nobody-ever@test.local" }, SSO_SECRET, {
      algorithm: "HS256"
    });
    const res = await st().post("/v1/auth/sso-exchange").send({ ssoJwt });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/sso|non consentito|accesso/i);
  });

  it("POST /auth/sso-exchange returns 503 when SSO not configured", async () => {
    const prevJwks = process.env.SSO_JWKS_URI;
    const prevHs = process.env.SSO_JWT_HS256_SECRET;
    process.env.SSO_JWKS_URI = "";
    process.env.SSO_JWT_HS256_SECRET = "";
    try {
      const res = await st()
        .post("/v1/auth/sso-exchange")
        .send({ ssoJwt: "eyJhbGciOiJIUzI1NiJ9.e30.x" });
      expect(res.status).toBe(503);
    } finally {
      if (prevJwks !== undefined) process.env.SSO_JWKS_URI = prevJwks;
      else delete process.env.SSO_JWKS_URI;
      if (prevHs !== undefined) process.env.SSO_JWT_HS256_SECRET = prevHs;
      else delete process.env.SSO_JWT_HS256_SECRET;
      process.env.SSO_JWT_HS256_SECRET = SSO_SECRET;
    }
  });

  it("reset password flow: request → reset → login with new password", async () => {
    const { resetEmailMockOutbox, getEmailMockOutbox } = await import("../core/email/email.service.js");
    resetEmailMockOutbox();
    const reqRes = await st()
      .post("/v1/auth/request-password-reset")
      .send({ email: "reset-user@test.local" });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.ok).toBe(true);
    const out = getEmailMockOutbox();
    expect(out.some((o) => o.kind === "password_reset")).toBe(true);
    const resetMail = out.find((o) => o.kind === "password_reset");
    const m = resetMail!.html.match(/token=([a-f0-9]+)/i);
    expect(m).not.toBeNull();
    const tok = m![1];
    const resetRes = await st()
      .post("/v1/auth/reset-password")
      .send({ token: tok, password: "BrandNewPass88" });
    expect(resetRes.status).toBe(200);
    const loginOld = await st()
      .post("/v1/auth/login")
      .send({ email: "reset-user@test.local", password: "OldPass12345" });
    expect(loginOld.status).toBe(401);
    const loginNew = await st()
      .post("/v1/auth/login")
      .send({ email: "reset-user@test.local", password: "BrandNewPass88" });
    expect(loginNew.status).toBe(200);
  });

  it("POST /users invite with admin JWT creates user", async () => {
    const { signAccessToken } = await import("../core/auth/token.service.js");
    const { resetEmailMockOutbox } = await import("../core/email/email.service.js");
    const { getDb } = await import("../config/db.js");
    await getDb().collection("tz_users").deleteOne({ email: "invite-api@test.local" });
    resetEmailMockOutbox();
    const token = signAccessToken({
      sub: adminId,
      email: "admin-auth-api@test.local",
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      projectId: "proj-auth-1"
    });
    const res = await st()
      .post("/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "invite-api@test.local",
        role: "collaborator",
        projectId: "proj-auth-1",
        projectName: "Auth test project",
        appPublicUrl: "http://localhost:5177"
      });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeTruthy();
    const u = await getDb().collection("tz_users").findOne({ email: "invite-api@test.local" });
    expect(u?.status).toBe("invited");
  });

  it("POST /users duplicate email returns 409", async () => {
    const { signAccessToken } = await import("../core/auth/token.service.js");
    const token = signAccessToken({
      sub: adminId,
      email: "admin-auth-api@test.local",
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      projectId: "proj-auth-1"
    });
    await st()
      .post("/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "dup-invite@test.local",
        role: "collaborator",
        projectId: "proj-auth-1",
        projectName: "P"
      });
    const res2 = await st()
      .post("/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "dup-invite@test.local",
        role: "collaborator",
        projectId: "proj-auth-1",
        projectName: "P"
      });
    expect(res2.status).toBe(409);
  });

  it("parallel set-password-from-invite: only first succeeds", async () => {
    const { resetEmailMockOutbox, getEmailMockOutbox } = await import("../core/email/email.service.js");
    const { getDb } = await import("../config/db.js");
    const { inviteUser } = await import("../core/users/users-mutations.service.js");
    await getDb().collection("tz_users").deleteOne({ email: "double-token@test.local" });
    resetEmailMockOutbox();
    await inviteUser({
      email: "double-token@test.local",
      projectId: "proj-auth-1",
      projectName: "P",
      appPublicBaseUrl: "http://localhost:5177",
      roleLabel: "Vendor"
    });
    const html = getEmailMockOutbox()[0].html;
    const m = html.match(/token=([a-f0-9]+)/i);
    const raw = m![1];
    const [a, b] = await Promise.all([
      st()
        .post("/v1/auth/set-password-from-invite")
        .send({ token: raw, password: "ParallelPass99" }),
      st()
        .post("/v1/auth/set-password-from-invite")
        .send({ token: raw, password: "ParallelPass99" })
    ]);
    const ok = [a.status, b.status].filter((s) => s === 200);
    const bad = [a.status, b.status].filter((s) => s === 400);
    expect(ok.length).toBe(1);
    expect(bad.length).toBe(1);
  });
});
