import crypto from "node:crypto";
import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { ENV } from "../../config/env.js";

const COLLECTION = "tz_passwordResetTokens";

export interface PasswordResetTokenDoc {
  _id?: import("mongodb").ObjectId;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const coll = () => getDb().collection<PasswordResetTokenDoc>(COLLECTION);

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generatePasswordResetRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(userId: string, email: string): Promise<string> {
  const raw = generatePasswordResetRawToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ENV.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES);
  const doc: OptionalId<PasswordResetTokenDoc> = {
    userId,
    email: email.toLowerCase().trim(),
    tokenHash: hashToken(raw),
    expiresAt,
    used: false,
    createdAt: new Date()
  };
  await coll().insertOne(doc as PasswordResetTokenDoc);
  return raw;
}

export async function consumePasswordResetToken(rawToken: string): Promise<PasswordResetTokenDoc | null> {
  const tokenHash = hashToken(rawToken);
  const doc = await coll().findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() }
  });
  if (!doc) return null;
  await coll().updateOne({ _id: doc._id }, { $set: { used: true } });
  return doc;
}
