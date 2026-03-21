/**
 * Lockout per account (email normalizzata) dopo troppi tentativi di password errata.
 * Collection: tz_account_lockout
 */
import { ENV } from "../../config/env.js";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { observeSecurityAccountLockout } from "../../observability/metrics.js";

const COLLECTION = "tz_account_lockout";

export interface AccountLockoutDoc {
  _id: string;
  failedAttempts: number;
  windowStart: Date;
  lockedUntil?: Date;
}

function coll() {
  return getDb().collection<AccountLockoutDoc>(COLLECTION);
}

export async function isEmailLocked(emailLower: string): Promise<Date | null> {
  const doc = await coll().findOne({ _id: emailLower });
  if (!doc?.lockedUntil) return null;
  if (doc.lockedUntil > new Date()) return doc.lockedUntil;
  return null;
}

export async function clearLockoutForEmail(emailLower: string): Promise<void> {
  try {
    await coll().deleteOne({ _id: emailLower });
  } catch (err) {
    logger.error({ err, emailLower }, "[lockout] clear failed");
  }
}

/** Chiamare solo quando l'utente esiste e la password è errata. */
export async function recordFailedPasswordAttempt(emailLower: string): Promise<void> {
  const now = new Date();
  const windowMs = ENV.AUTH_LOCKOUT_WINDOW_MS;
  const max = ENV.AUTH_LOCKOUT_MAX_ATTEMPTS;
  const lockMs = ENV.AUTH_LOCKOUT_DURATION_MS;

  try {
    const existing = await coll().findOne({ _id: emailLower });
    if (!existing) {
      await coll().insertOne({
        _id: emailLower,
        failedAttempts: 1,
        windowStart: now
      });
      return;
    }

    const windowExpired = now.getTime() - existing.windowStart.getTime() > windowMs;
    if (windowExpired) {
      await coll().updateOne(
        { _id: emailLower },
        { $set: { failedAttempts: 1, windowStart: now }, $unset: { lockedUntil: "" } }
      );
      return;
    }

    const next = existing.failedAttempts + 1;
    if (next >= max) {
      const lockedUntil = new Date(now.getTime() + lockMs);
      await coll().updateOne(
        { _id: emailLower },
        { $set: { failedAttempts: next, lockedUntil } }
      );
      observeSecurityAccountLockout();
      return;
    }
    await coll().updateOne({ _id: emailLower }, { $set: { failedAttempts: next } });
  } catch (err) {
    logger.error({ err, emailLower }, "[lockout] record failed");
  }
}
