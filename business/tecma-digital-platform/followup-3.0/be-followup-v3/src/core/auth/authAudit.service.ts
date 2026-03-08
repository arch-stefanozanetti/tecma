import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION_NAME = "tz_authEvents";

export type AuthEventType = "login" | "logout" | "sso_exchange";

export interface AuthEventDoc {
  _id?: import("mongodb").ObjectId;
  eventType: AuthEventType;
  userId: string;
  email?: string;
  at: Date;
}

const getCollection = () => getDb().collection<AuthEventDoc>(COLLECTION_NAME);

/**
 * Log an auth event (login, logout, sso_exchange) for audit.
 * Does not throw; failures are logged to console to avoid breaking the auth flow.
 */
export async function logAuthEvent(
  eventType: AuthEventType,
  payload: { userId: string; email?: string }
): Promise<void> {
  try {
    const doc: OptionalId<AuthEventDoc> = {
      eventType,
      userId: payload.userId,
      email: payload.email,
      at: new Date()
    };
    await getCollection().insertOne(doc);
  } catch (err) {
    console.error("[authAudit] Failed to write auth event:", eventType, err);
  }
}
