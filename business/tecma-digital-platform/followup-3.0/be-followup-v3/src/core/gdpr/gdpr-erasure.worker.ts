/**
 * Elaborazione batch richieste GDPR type=erasure (pending → anonimizzazione + cleanup correlati).
 * Eseguito dal job-runner; non sostituisce policy legal hold / retention documentate in ops.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { USER_COLLECTION_CANDIDATES } from "../auth/userAccessPayload.js";
import { recordSecurityEvent } from "../compliance/security-audit.service.js";
import { logger } from "../../observability/logger.js";
import type { GdprRequestDoc } from "./user-gdpr.service.js";

const REQUESTS = "tz_gdpr_requests";

function requestsColl() {
  return getDb().collection<GdprRequestDoc>(REQUESTS);
}

async function executeErasureForRequest(doc: { userId: string; email: string }): Promise<void> {
  const userId = doc.userId;
  const emailLower = doc.email.trim().toLowerCase();
  const db = getDb();
  const oid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
  const redactedEmail = `erased+${userId.replace(/[^a-f0-9]/gi, "").slice(0, 24)}@invalid.followup.local`;

  if (oid) {
    for (const name of USER_COLLECTION_CANDIDATES) {
      const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
      if (!exists) continue;
      await db.collection(name).updateOne(
        { _id: oid },
        {
          $set: {
            email: redactedEmail,
            fullName: "[Dati cancellati]",
            firstName: "[Dati cancellati]",
            lastName: "[Dati cancellati]",
            phone: "",
            mobile: "",
            isDisabled: true,
            status: "deleted",
            gdprErasedAt: new Date()
          }
        }
      );
    }
  }

  await db.collection("tz_user_workspaces").deleteMany({ userId: emailLower });
  await db.collection("tz_user_workspaces").deleteMany({ userId });
  await db.collection("tz_authSessions").deleteMany({ userId });
  await db.collection<{ _id: string }>("tz_user_security").deleteOne({ _id: userId });
  await db.collection("tz_user_consents").deleteMany({ userId });
  await db.collection<{ _id: string }>("tz_account_lockout").deleteOne({ _id: emailLower });
}

/**
 * Processa fino a `limit` richieste erasure in stato pending (FIFO per createdAt).
 */
export async function processPendingGdprErasureBatch(options: { limit?: number } = {}): Promise<{
  processed: number;
  failed: number;
}> {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 50));
  let processed = 0;
  let failed = 0;
  const coll = requestsColl();

  for (let i = 0; i < limit; i++) {
    const pending = await coll.findOne({ type: "erasure", status: "pending" }, { sort: { createdAt: 1 } });
    if (!pending) break;

    const lock = await coll.updateOne(
      { _id: pending._id, status: "pending" },
      { $set: { status: "processing", processingStartedAt: new Date() } }
    );
    if (lock.matchedCount === 0) continue;

    try {
      await executeErasureForRequest({ userId: pending.userId, email: pending.email });
      await coll.updateOne(
        { _id: pending._id },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
            notes:
              "Cancellazione elaborata dal worker: profilo anonimizzato, sessioni e collegamenti workspace rimossi."
          }
        }
      );
      await recordSecurityEvent({
        action: "gdpr.erasure_completed",
        entityType: "gdpr_request",
        entityId: pending._id.toHexString(),
        userId: pending.userId,
        metadata: { source: "job_runner" }
      });
      processed += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, requestId: pending._id.toHexString() }, "[gdpr-erasure] item failed");
      await coll.updateOne(
        { _id: pending._id },
        {
          $set: {
            status: "rejected",
            completedAt: new Date(),
            notes: `Elaborazione fallita: ${err instanceof Error ? err.message : "unknown"}`
          },
          $unset: { processingStartedAt: "" }
        }
      );
    }
  }

  return { processed, failed };
}
