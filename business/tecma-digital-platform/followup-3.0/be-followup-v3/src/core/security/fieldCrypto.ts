/**
 * Crittografia AES-256-GCM per segreti MFA a riposo.
 * Chiave: AUTH_FIELD_ENCRYPTION_KEY (32 byte base64) oppure derivata da AUTH_JWT_SECRET (solo dev).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ENV, isProductionLike } from "../../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;

function encryptionKey(): Buffer {
  const raw = (ENV.AUTH_FIELD_ENCRYPTION_KEY ?? "").trim();
  if (raw.length > 0) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error("AUTH_FIELD_ENCRYPTION_KEY deve decodificare esattamente 32 byte (base64).");
    }
    return buf;
  }
  if (isProductionLike()) {
    throw new Error(
      "AUTH_FIELD_ENCRYPTION_KEY è obbligatoria in produzione/staging per MFA e dati sensibili cifrati."
    );
  }
  return createHash("sha256").update(ENV.AUTH_JWT_SECRET, "utf8").digest();
}

/** Formato: v1:base64url(iv):base64url(tag):base64url(ciphertext) */
export function encryptUtf8(plain: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptUtf8(payload: string): string {
  const key = encryptionKey();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted payload format");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
