import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
const SECRET = "unit-sso-hs256-secret-key-32chars!!";

async function loadVerify() {
  vi.resetModules();
  process.env.SSO_JWKS_URI = "";
  process.env.SSO_JWT_HS256_SECRET = SECRET;
  return import("./ssoJwtVerify.service.js");
}

describe("verifySsoJwtAndGetPayload (HS256)", () => {
  it("restituisce il payload per JWT valido", async () => {
    const { verifySsoJwtAndGetPayload } = await loadVerify();
    const tok = jwt.sign({ email: "sso-unit@test.local", sub: "u1" }, SECRET, { algorithm: "HS256" });
    const p = await verifySsoJwtAndGetPayload(tok);
    expect(p.email).toBe("sso-unit@test.local");
  });

  it("401 se la firma non coincide", async () => {
    const { verifySsoJwtAndGetPayload } = await loadVerify();
    const bad = jwt.sign({ email: "x@test.local" }, "altro-segreto-hs256-min-32-char!!", {
      algorithm: "HS256"
    });
    await expect(verifySsoJwtAndGetPayload(bad)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("401 se il token è scaduto", async () => {
    const { verifySsoJwtAndGetPayload } = await loadVerify();
    const tok = jwt.sign({ email: "exp@test.local" }, SECRET, {
      algorithm: "HS256",
      expiresIn: "-60s"
    });
    await expect(verifySsoJwtAndGetPayload(tok)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("503 se SSO non è configurato (né JWKS né HS256)", async () => {
    vi.resetModules();
    process.env.SSO_JWKS_URI = "";
    process.env.SSO_JWT_HS256_SECRET = "";
    const { verifySsoJwtAndGetPayload } = await import("./ssoJwtVerify.service.js");
    await expect(verifySsoJwtAndGetPayload("eyJhbGciOiJIUzI1NiJ9.e30.x")).rejects.toMatchObject({
      statusCode: 503
    });
  });
});
