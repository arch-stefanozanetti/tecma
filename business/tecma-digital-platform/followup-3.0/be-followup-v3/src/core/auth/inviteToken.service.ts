import crypto from "node:crypto";
import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { ENV } from "../../config/env.js";

const COLLECTION = "tz_inviteTokens";

export interface InviteTokenDoc {
  _id?: import("mongodb").ObjectId;
  email: string;
  tokenHash: string;
  role: string;
  projectId: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const coll = () => getDb().collection<InviteTokenDoc>(COLLECTION);

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateInviteRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createInviteToken(params: {
  email: string;
  role: string;
  projectId: string;
  userId: string;
}): Promise<string> {
  const raw = generateInviteRawToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ENV.INVITE_TOKEN_EXPIRES_HOURS);
  const doc: OptionalId<InviteTokenDoc> = {
    email: params.email.toLowerCase().trim(),
    tokenHash: hashToken(raw),
    role: params.role,
    projectId: params.projectId,
    userId: params.userId,
    expiresAt,
    used: false,
    createdAt: new Date()
  };
  await coll().insertOne(doc as InviteTokenDoc);
  return raw;
}

export async function deleteInviteTokensForUserId(userId: string): Promise<void> {
  await coll().deleteMany({ userId });
}

export async function consumeInviteToken(rawToken: string): Promise<InviteTokenDoc | null> {
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
