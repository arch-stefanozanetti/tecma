import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { signAccessToken, verifyAccessToken } from "./token.service.js";

describe("token.service", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", "token-svc-test-secret-32chars-min!!");
    vi.stubEnv("AUTH_JWT_EXPIRES_IN", "15m");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sign + verify roundtrip", () => {
    const t = signAccessToken({
      sub: "s1",
      email: "e@test.it",
      role: "admin",
      isAdmin: false,
      permissions: ["clients.read"],
      projectId: "p1",
    });
    const v = verifyAccessToken(t);
    expect(v.sub).toBe("s1");
    expect(v.email).toBe("e@test.it");
    expect(v.permissions).toEqual(["clients.read"]);
    expect(v.projectId).toBe("p1");
  });

  it("verify: isAdmin senza permissions → *", () => {
    const t = signAccessToken({
      sub: "s1",
      email: "e@test.it",
      role: null,
      isAdmin: true,
      permissions: [],
      projectId: null,
    });
    const v = verifyAccessToken(t);
    expect(v.isAdmin).toBe(true);
    expect(v.permissions).toEqual(["*"]);
  });

  it("verify: filtra permissions non stringa", () => {
    const raw = jwt.sign(
      {
        sub: "s1",
        email: "e@test.it",
        role: null,
        isAdmin: false,
        permissions: ["a", 1, "b", null, "c"],
        projectId: "",
      },
      process.env.AUTH_JWT_SECRET,
      { expiresIn: "15m" }
    );
    const v = verifyAccessToken(raw);
    expect(v.permissions).toEqual(["a", "b", "c"]);
    expect(v.projectId).toBeNull();
  });

  it("verify: isTecmaAdmin da system_role o flag", () => {
    const t1 = jwt.sign(
      {
        sub: "s1",
        email: "e@test.it",
        role: null,
        isAdmin: false,
        permissions: [],
        system_role: "tecma_admin",
      },
      process.env.AUTH_JWT_SECRET,
      { expiresIn: "15m" }
    );
    expect(verifyAccessToken(t1).isTecmaAdmin).toBe(true);

    const t2 = jwt.sign(
      {
        sub: "s1",
        email: "e@test.it",
        role: null,
        isAdmin: false,
        permissions: [],
        isTecmaAdmin: true,
      },
      process.env.AUTH_JWT_SECRET,
      { expiresIn: "15m" }
    );
    expect(verifyAccessToken(t2).isTecmaAdmin).toBe(true);
  });
});
