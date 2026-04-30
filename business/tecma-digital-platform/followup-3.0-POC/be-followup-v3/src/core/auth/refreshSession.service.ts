import crypto from "node:crypto";
import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { ENV } from "../../config/env.js";

const COLLECTION_NAME = "tz_authSessions";

export interface AuthSessionDoc {
  _id: import("mongodb").ObjectId;
  userId: string;
  email?: string;
  /** SHA-256 hex del refresh token opaco */
  tokenHash: string;
  /** @deprecated sessioni legacy prima dell’hash-at-rest */
  token?: string;
  expiresAt: Date;
  createdAt: Date;
  revoked?: boolean;
}

const getCollection = () => getDb().collection<AuthSessionDoc>(COLLECTION_NAME);

function now(): Date {
  return new Date();
}

function expiresAtDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ENV.AUTH_REFRESH_EXPIRES_DAYS);
  return d;
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string, email?: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const doc: OptionalId<AuthSessionDoc> = {
    userId,
    email,
    tokenHash,
    expiresAt: expiresAtDate(),
    createdAt: now()
  };
  await getCollection().insertOne(doc as AuthSessionDoc);
  return token;
}

export async function getSession(token: string): Promise<AuthSessionDoc | null> {
  const h = hashRefreshToken(token);
  return getCollection().findOne({
    expiresAt: { $gt: now() },
    $or: [{ tokenHash: h }, { token }],
    revoked: { $ne: true }
  });
}

export async function deleteSession(token: string): Promise<boolean> {
  const h = hashRefreshToken(token);
  const result = await getCollection().deleteMany({
    $or: [{ tokenHash: h }, { token }]
  });
  return (result.deletedCount ?? 0) > 0;
}

export async function deleteSessionsByUser(userId: string): Promise<number> {
  const result = await getCollection().deleteMany({ userId });
  return result.deletedCount ?? 0;
}

export async function revokeSessionsByUser(userId: string): Promise<number> {
  const result = await getCollection().updateMany({ userId, revoked: { $ne: true } }, { $set: { revoked: true } });
  return result.modifiedCount ?? 0;
}
