import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_accessLogs";

export interface AccessLogDoc {
  _id?: import("mongodb").ObjectId;
  userId: string | null;
  endpoint: string;
  method: string;
  projectId: string | null;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string | null;
  createdAt: Date;
}

const coll = () => getDb().collection<AccessLogDoc>(COLLECTION);

export async function writeAccessLog(entry: Omit<AccessLogDoc, "_id" | "createdAt">): Promise<void> {
  try {
    getDb();
  } catch {
    return;
  }
  try {
    const doc: OptionalId<AccessLogDoc> = {
      ...entry,
      createdAt: new Date()
    };
    await coll().insertOne(doc as AccessLogDoc);
  } catch (err) {
    console.error("[accessLog] write failed:", err);
  }
}
