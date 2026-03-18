import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";

const COLLECTION = "tz_auditLogs";

export interface AuditLogDoc {
  _id?: import("mongodb").ObjectId;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: { before?: unknown; after?: unknown } | null;
  projectId: string | null;
  createdAt: Date;
}

const coll = () => getDb().collection<AuditLogDoc>(COLLECTION);

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: { before?: unknown; after?: unknown } | null;
  projectId?: string | null;
}): Promise<void> {
  try {
    const doc: OptionalId<AuditLogDoc> = {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes ?? null,
      projectId: params.projectId ?? null,
      createdAt: new Date()
    };
    await coll().insertOne(doc as AuditLogDoc);
  } catch (err) {
    logger.error({ err }, "[audit] write failed");
  }
}
