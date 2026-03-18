import crypto from "node:crypto";
import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { ENV } from "../../config/env.js";

const COLLECTION_NAME = "tz_authSessions";

export interface AuthSessionDoc {
  _id: import("mongodb").ObjectId;
  userId: string;
  email?: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revoked?: boolean;
}

const getCollection = () => getDb().collection<AuthSessionDoc>(COLLECTION_NAME);

function now(): Date {
  return new Date();
}

function expiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ENV.AUTH_REFRESH_EXPIRES_DAYS);
  return d;
}

/**
 * Generate a secure opaque refresh token (64 hex chars).
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new refresh session for the user. Returns the opaque token (store this, not a hash).
 */
export async function createSession(userId: string, email?: string): Promise<string> {
  const token = generateRefreshToken();
  const doc: OptionalId<AuthSessionDoc> = {
    userId,
    email,
    token,
    expiresAt: expiresAt(),
    createdAt: now()
  };
  await getCollection().insertOne(doc as AuthSessionDoc);
  return token;
}

/**
 * Find session by token. Returns null if not found or expired.
 */
export async function getSession(token: string): Promise<AuthSessionDoc | null> {
  const session = await getCollection().findOne({
    token,
    expiresAt: { $gt: now() },
    $or: [{ revoked: { $exists: false } }, { revoked: false }]
  });
  return session;
}

/**
 * Delete a single session by token.
 */
export async function deleteSession(token: string): Promise<boolean> {
  const result = await getCollection().deleteOne({ token });
  return (result.deletedCount ?? 0) > 0;
}

/**
 * Delete all sessions for a user (e.g. on password change or security event).
 */
export async function deleteSessionsByUser(userId: string): Promise<number> {
  const result = await getCollection().deleteMany({ userId });
  return result.deletedCount ?? 0;
}

export async function revokeSessionsByUser(userId: string): Promise<number> {
  const result = await getCollection().updateMany({ userId, revoked: { $ne: true } }, { $set: { revoked: true } });
  return result.modifiedCount ?? 0;
}
