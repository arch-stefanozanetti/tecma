/**
 * MFA TOTP (opzionale) + backup codes. Dati in tz_user_security (per userId).
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { authenticator } from "otplib";
import { getDb } from "../../config/db.js";
import { ENV } from "../../config/env.js";
import { encryptUtf8, decryptUtf8 } from "../security/fieldCrypto.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_user_security";
const BACKUP_CODE_COUNT = 10;

export interface UserSecurityDoc {
  _id: string;
  totpSecretEnc?: string;
  totpPendingEnc?: string;
  totpEnabled: boolean;
  backupCodesBcrypt?: string[];
  updatedAt: Date;
}

function coll() {
  return getDb().collection<UserSecurityDoc>(COLLECTION);
}

export async function getUserSecurity(userId: string): Promise<UserSecurityDoc | null> {
  const doc = await coll().findOne({ _id: userId });
  return doc ?? null;
}

export async function isMfaEnabledForUser(userId: string): Promise<boolean> {
  const d = await getUserSecurity(userId);
  return Boolean(d?.totpEnabled && d.totpSecretEnc);
}

function generateBackupCodesPlain(): string[] {
  const out: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    out.push(randomBytes(5).toString("hex"));
  }
  return out;
}

export async function startMfaSetup(userId: string, email: string): Promise<{ otpauthUrl: string }> {
  const existing = await getUserSecurity(userId);
  if (existing?.totpEnabled) {
    throw new HttpError("MFA già attivo. Disattivalo prima di riconfigurare.", 409, "MFA_ALREADY_ENABLED");
  }
  const secret = authenticator.generateSecret();
  const enc = encryptUtf8(secret);
  const now = new Date();
  await coll().updateOne(
    { _id: userId },
    {
      $set: {
        totpPendingEnc: enc,
        totpEnabled: false,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  const issuer = ENV.AUTH_MFA_ISSUER;
  const account = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  return { otpauthUrl };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
  const doc = await getUserSecurity(userId);
  if (!doc?.totpPendingEnc) {
    throw new HttpError("Nessuna configurazione MFA in corso. Avvia di nuovo il setup.", 400, "MFA_SETUP_MISSING");
  }
  let secret: string;
  try {
    secret = decryptUtf8(doc.totpPendingEnc);
  } catch {
    throw new HttpError("Errore lettura segreto MFA", 500, "MFA_CRYPTO_ERROR");
  }
  const ok = authenticator.verify({ token: code.trim().replace(/\s/g, ""), secret });
  if (!ok) {
    throw new HttpError("Codice non valido", 400, "MFA_INVALID_CODE");
  }
  const plainBackup = generateBackupCodesPlain();
  const backupCodesBcrypt = await Promise.all(plainBackup.map((c) => bcrypt.hash(c, 10)));
  const now = new Date();
  await coll().updateOne(
    { _id: userId },
    {
      $set: {
        totpSecretEnc: doc.totpPendingEnc,
        totpEnabled: true,
        backupCodesBcrypt,
        updatedAt: now
      },
      $unset: { totpPendingEnc: "" }
    }
  );
  return { backupCodes: plainBackup };
}

/** Verifica TOTP o un backup code; se backup, rimuove l'hash usato. */
export async function verifyMfaForLogin(userId: string, rawCode: string): Promise<boolean> {
  const code = rawCode.trim().replace(/\s/g, "");
  if (!code) return false;
  const doc = await getUserSecurity(userId);
  if (!doc?.totpEnabled || !doc.totpSecretEnc) return false;

  let secret: string;
  try {
    secret = decryptUtf8(doc.totpSecretEnc);
  } catch {
    return false;
  }
  if (authenticator.verify({ token: code, secret })) {
    return true;
  }

  const hashes = doc.backupCodesBcrypt ?? [];
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i];
    if (await bcrypt.compare(code, h)) {
      const next = hashes.filter((_, j) => j !== i);
      await coll().updateOne(
        { _id: userId },
        { $set: { backupCodesBcrypt: next, updatedAt: new Date() } }
      );
      return true;
    }
  }
  return false;
}

export async function disableMfa(userId: string, code: string): Promise<void> {
  const ok = await verifyMfaForLogin(userId, code);
  if (!ok) {
    throw new HttpError("Codice MFA non valido", 400, "MFA_INVALID_CODE");
  }
  await coll().updateOne(
    { _id: userId },
    {
      $set: { totpEnabled: false, updatedAt: new Date() },
      $unset: { totpSecretEnc: "", totpPendingEnc: "", backupCodesBcrypt: "" }
    }
  );
}
