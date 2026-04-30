/**
 * Log invii comunicazioni (audit e Notification Center). Collection tz_communication_deliveries.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_communication_deliveries";

export interface CommunicationDeliveryRow {
  _id: string;
  workspaceId: string;
  projectId?: string;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  templateId: string;
  recipientMasked: string;
  status: "sent" | "failed";
  sentAt: string;
  createdAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return local[0] + "***" + domain;
  return local.slice(0, 2) + "***" + domain;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "***";
  return "***" + phone.slice(-4);
}

export async function logDelivery(params: {
  workspaceId: string;
  projectId?: string;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  templateId: string;
  recipient: string;
  status: "sent" | "failed";
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  const recipientMasked =
    params.channel === "email"
      ? maskEmail(params.recipient)
      : params.channel === "whatsapp" || params.channel === "sms"
        ? maskPhone(params.recipient)
        : "in_app";
  await db.collection(COLLECTION).insertOne({
    workspaceId: params.workspaceId,
    projectId: params.projectId ?? null,
    channel: params.channel,
    templateId: params.templateId,
    recipientMasked,
    status: params.status,
    sentAt: now,
    createdAt: now,
  });
}

export async function listByWorkspace(
  workspaceId: string,
  limit = 50
): Promise<CommunicationDeliveryRow[]> {
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId })
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => {
    const doc = d as Record<string, unknown>;
    return {
      _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
      workspaceId: String(doc.workspaceId ?? ""),
      projectId: doc.projectId != null ? String(doc.projectId) : undefined,
      channel: (doc.channel as CommunicationDeliveryRow["channel"]) ?? "email",
      templateId: String(doc.templateId ?? ""),
      recipientMasked: String(doc.recipientMasked ?? "***"),
      status: (doc.status as "sent" | "failed") ?? "sent",
      sentAt: toIso(doc.sentAt),
      createdAt: toIso(doc.createdAt),
    };
  });
}
