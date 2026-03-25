import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { HttpError } from "../../types/http.js";

/** Segreto restituito da generateSecret nel servizio (mock). */
const TEST_OTP_SECRET = "JBSWY3DPEHPK3PXP";
/** Token TOTP considerato valido nei test (verify mockata). */
const VALID_TOTP = "123456";

type SecDoc = {
  _id: string;
  totpSecretEnc?: string;
  totpPendingEnc?: string;
  totpEnabled: boolean;
  backupCodesBcrypt?: string[];
  updatedAt: Date;
};

const docs = new Map<string, SecDoc>();

const collectionMock = {
  findOne: vi.fn(async (query: { _id: string }) => docs.get(query._id) ?? null),
  updateOne: vi.fn(
    async (
      filter: { _id: string },
      update: { $set?: Record<string, unknown>; $unset?: Record<string, string> },
      options?: { upsert?: boolean }
    ) => {
      const id = filter._id;
      let doc = docs.get(id);
      if (!doc && options?.upsert) {
        doc = { _id: id, totpEnabled: false, updatedAt: new Date() };
      }
      if (!doc) {
        return { acknowledged: true, matchedCount: 0 };
      }
      if (update.$set) {
        Object.assign(doc, update.$set as Partial<SecDoc>);
      }
      if (update.$unset) {
        for (const k of Object.keys(update.$unset)) {
          delete (doc as Record<string, unknown>)[k];
        }
      }
      docs.set(id, doc);
      return { acknowledged: true, matchedCount: 1 };
    }
  ),
};

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name !== "tz_user_security") {
        throw new Error(`unexpected collection ${name}`);
      }
      return collectionMock;
    },
  }),
}));

vi.mock("../security/fieldCrypto.js", () => ({
  encryptUtf8: (plain: string) => `v:test:${plain}`,
  decryptUtf8: (payload: string) => {
    if (!payload.startsWith("v:test:")) {
      throw new Error("bad payload");
    }
    return payload.slice("v:test:".length);
  },
}));

describe("mfa.service", () => {
  beforeEach(() => {
    docs.clear();
    vi.clearAllMocks();
    vi.spyOn(authenticator, "generateSecret").mockReturnValue(TEST_OTP_SECRET as never);
    vi.spyOn(authenticator, "verify").mockImplementation(({ token }: { token: string }) => {
      return token.trim().replace(/\s/g, "") === VALID_TOTP;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getUserSecurity ritorna null se assente", async () => {
    const { getUserSecurity } = await import("./mfa.service.js");
    expect(await getUserSecurity("u1")).toBeNull();
  });

  it("isMfaEnabledForUser è false senza segreto attivo", async () => {
    const { isMfaEnabledForUser } = await import("./mfa.service.js");
    expect(await isMfaEnabledForUser("u1")).toBe(false);
    docs.set("u1", { _id: "u1", totpEnabled: true, updatedAt: new Date() });
    expect(await isMfaEnabledForUser("u1")).toBe(false);
  });

  it("startMfaSetup rifiuta se MFA già attivo", async () => {
    const { startMfaSetup } = await import("./mfa.service.js");
    docs.set("u1", {
      _id: "u1",
      totpEnabled: true,
      totpSecretEnc: "v:test:sec",
      updatedAt: new Date(),
    });
    await expect(startMfaSetup("u1", "a@b.it")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("startMfaSetup → confirmMfaSetup abilita MFA e restituisce backup codes", async () => {
    const { startMfaSetup, confirmMfaSetup, isMfaEnabledForUser, verifyMfaForLogin } = await import(
      "./mfa.service.js"
    );
    const { otpauthUrl } = await startMfaSetup("u1", "user@example.com");
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

    expect(docs.get("u1")?.totpPendingEnc).toBe(`v:test:${TEST_OTP_SECRET}`);

    const { backupCodes } = await confirmMfaSetup("u1", VALID_TOTP);
    expect(backupCodes).toHaveLength(10);

    expect(await isMfaEnabledForUser("u1")).toBe(true);
    expect(await verifyMfaForLogin("u1", VALID_TOTP)).toBe(true);
  });

  it("confirmMfaSetup senza pending → 400", async () => {
    const { confirmMfaSetup } = await import("./mfa.service.js");
    await expect(confirmMfaSetup("u1", VALID_TOTP)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("confirmMfaSetup con codice errato → 400", async () => {
    const { startMfaSetup, confirmMfaSetup } = await import("./mfa.service.js");
    await startMfaSetup("u1", "user@example.com");
    await expect(confirmMfaSetup("u1", "000000")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("confirmMfaSetup con decrypt fallito → 500", async () => {
    const { confirmMfaSetup } = await import("./mfa.service.js");
    docs.set("u1", {
      _id: "u1",
      totpPendingEnc: "bad-format",
      totpEnabled: false,
      updatedAt: new Date(),
    });
    await expect(confirmMfaSetup("u1", VALID_TOTP)).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("verifyMfaForLogin: codice vuoto, MFA off, TOTP e backup code", async () => {
    const { verifyMfaForLogin } = await import("./mfa.service.js");
    expect(await verifyMfaForLogin("u1", "   ")).toBe(false);

    docs.set("u1", { _id: "u1", totpEnabled: false, totpSecretEnc: "v:test:x", updatedAt: new Date() });
    expect(await verifyMfaForLogin("u1", "111111")).toBe(false);

    docs.set("u1", {
      _id: "u1",
      totpEnabled: true,
      totpSecretEnc: `v:test:${TEST_OTP_SECRET}`,
      backupCodesBcrypt: [],
      updatedAt: new Date(),
    });
    expect(await verifyMfaForLogin("u1", VALID_TOTP)).toBe(true);

    const plainBackup = "backup-plain-1";
    const hash = await bcrypt.hash(plainBackup, 4);
    docs.set("u1", {
      _id: "u1",
      totpEnabled: true,
      totpSecretEnc: `v:test:${TEST_OTP_SECRET}`,
      backupCodesBcrypt: [hash],
      updatedAt: new Date(),
    });
    expect(await verifyMfaForLogin("u1", plainBackup)).toBe(true);
    const after = docs.get("u1")?.backupCodesBcrypt ?? [];
    expect(after.length).toBe(0);
  });

  it("verifyMfaForLogin: decrypt segreto fallito → false", async () => {
    const { verifyMfaForLogin } = await import("./mfa.service.js");
    docs.set("u1", {
      _id: "u1",
      totpEnabled: true,
      totpSecretEnc: "not-valid",
      updatedAt: new Date(),
    });
    expect(await verifyMfaForLogin("u1", VALID_TOTP)).toBe(false);
  });

  it("disableMfa rimuove configurazione dopo verifica codice", async () => {
    const { startMfaSetup, confirmMfaSetup, disableMfa, isMfaEnabledForUser } = await import(
      "./mfa.service.js"
    );
    await startMfaSetup("u1", "user@example.com");
    await confirmMfaSetup("u1", VALID_TOTP);
    expect(await isMfaEnabledForUser("u1")).toBe(true);

    await disableMfa("u1", VALID_TOTP);

    expect(await isMfaEnabledForUser("u1")).toBe(false);
    expect(docs.get("u1")?.totpSecretEnc).toBeUndefined();
  });

  it("disableMfa con codice errato → HttpError 400", async () => {
    const { startMfaSetup, confirmMfaSetup, disableMfa } = await import("./mfa.service.js");
    await startMfaSetup("u1", "user@example.com");
    await confirmMfaSetup("u1", VALID_TOTP);

    await expect(disableMfa("u1", "000000")).rejects.toBeInstanceOf(HttpError);
    await expect(disableMfa("u1", "000000")).rejects.toMatchObject({ statusCode: 400 });
  });
});
