import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const JWT_SECRET = "mfa-pending-test-secret-32chars!!";

describe("mfaPendingToken.service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    vi.stubEnv("AUTH_JWT_SECRET", JWT_SECRET);
    return import("./mfaPendingToken.service.js");
  }

  it("sign + verify roundtrip", async () => {
    const { signMfaPendingToken, verifyMfaPendingToken } = await load();
    const tok = signMfaPendingToken({ sub: "u1", email: "a@b.it" });
    expect(verifyMfaPendingToken(tok)).toEqual({ sub: "u1", email: "a@b.it" });
  });

  it("verify rifiuta audience errata", async () => {
    const { verifyMfaPendingToken } = await load();
    const bad = jwt.sign(
      { sub: "u1", email: "a@b.it", aud: "other" },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    expect(() => verifyMfaPendingToken(bad)).toThrowError(/non valido/);
  });

  it("verify rifiuta sub/email mancanti", async () => {
    const { verifyMfaPendingToken } = await load();
    const noSub = jwt.sign({ email: "a@b.it", aud: "followup_mfa_pending" }, JWT_SECRET, { expiresIn: "5m" });
    expect(() => verifyMfaPendingToken(noSub)).toThrowError(/non valido/);
  });

  it("verify token scaduto → HttpError", async () => {
    const { signMfaPendingToken, verifyMfaPendingToken } = await load();
    const tok = jwt.sign(
      { sub: "u1", email: "a@b.it", aud: "followup_mfa_pending" },
      JWT_SECRET,
      { expiresIn: "-10s" }
    );
    expect(() => verifyMfaPendingToken(tok)).toThrowError(/scaduto o non valido/);
  });

  it("verify firma errata → HttpError", async () => {
    const { verifyMfaPendingToken } = await load();
    const tok = jwt.sign(
      { sub: "u1", email: "a@b.it", aud: "followup_mfa_pending" },
      "wrong-secret-must-be-32chars-min!!",
      { expiresIn: "5m" }
    );
    expect(() => verifyMfaPendingToken(tok)).toThrowError(/scaduto o non valido/);
  });
});
