import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";

const COLLECTION_NAME = "tz_authEvents";

/** Legacy + MDOO event types */
export type AuthEventType =
  | "login"
  | "logout"
  | "sso_exchange"
  | "login_success"
  | "login_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "invite_accepted";

export interface AuthEventDoc {
  _id?: import("mongodb").ObjectId;
  eventType: string;
  userId?: string;
  email?: string;
  at: Date;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

const getCollection = () => getDb().collection<AuthEventDoc>(COLLECTION_NAME);

/**
 * Log an auth event for audit. Non logga token o password.
 */
export async function logAuthEvent(
  eventType: AuthEventType | string,
  payload: {
    userId?: string;
    email?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    success?: boolean;
  }
): Promise<void> {
  try {
    const doc: OptionalId<AuthEventDoc> = {
      eventType,
      userId: payload.userId,
      email: payload.email,
      at: new Date(),
      ipAddress: payload.ipAddress ?? undefined,
      userAgent: payload.userAgent ?? undefined,
      success: payload.success
    };
    await getCollection().insertOne(doc);
  } catch (err) {
    logger.error({ err, eventType }, "[authAudit] failed to write auth event");
  }
}
