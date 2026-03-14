/**
 * Comunicazioni schedulate (es. 24h prima visita, 2h dopo). Collection tz_scheduled_communications.
 * Un worker/cron chiama runDueScheduled() periodicamente per inviare e marcare come inviate.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import type { DispatchEventPayload } from "../automations/automation-events.service.js";
import type { CommunicationSchedule } from "./communication-rules.service.js";
import { dispatchCommunicationJob } from "./channel-dispatcher.service.js";

const COLLECTION = "tz_scheduled_communications";

export type ScheduledStatus = "pending" | "sent" | "cancelled";

export interface ScheduledCommunicationRow {
  _id: string;
  workspaceId: string;
  projectId?: string;
  ruleId: string;
  triggerEventType: string;
  triggerEventId: string;
  payload: DispatchEventPayload;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  templateId: string;
  recipientType: string;
  runAt: string;
  status: ScheduledStatus;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function docToRow(doc: Record<string, unknown>): ScheduledCommunicationRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    projectId: doc.projectId != null ? String(doc.projectId) : undefined,
    ruleId: String(doc.ruleId ?? ""),
    triggerEventType: String(doc.triggerEventType ?? ""),
    triggerEventId: String(doc.triggerEventId ?? ""),
    payload: (doc.payload as DispatchEventPayload) ?? {},
    channel: (doc.channel as ScheduledCommunicationRow["channel"]) ?? "email",
    templateId: String(doc.templateId ?? ""),
    recipientType: String(doc.recipientType ?? "client"),
    runAt: toIso(doc.runAt),
    status: (doc.status as ScheduledStatus) ?? "pending",
    sentAt: doc.sentAt != null ? toIso(doc.sentAt) : undefined,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

/**
 * Calcola runAt a partire da startsAt (ISO string) e offset (es. { value: -24, unit: 'hours' }).
 */
export function computeRunAt(startsAt: string, offset: { value: number; unit: "minutes" | "hours" | "days" }): Date {
  const d = new Date(startsAt);
  const { value, unit } = offset;
  if (unit === "minutes") d.setMinutes(d.getMinutes() + value);
  else if (unit === "hours") d.setHours(d.getHours() + value);
  else if (unit === "days") d.setDate(d.getDate() + value);
  return d;
}

/**
 * Crea record schedulati per una regola che ha schedules, in seguito a un evento (es. visit.scheduled) con startsAt.
 */
export async function createScheduledForRule(
  ruleId: string,
  workspaceId: string,
  projectId: string | undefined,
  payload: DispatchEventPayload,
  schedules: CommunicationSchedule[]
): Promise<number> {
  const startsAt = payload.startsAt;
  if (typeof startsAt !== "string" || !startsAt) return 0;
  const db = getDb();
  const now = new Date();
  const docs = schedules.map((s) => {
    const runAt = computeRunAt(startsAt, s.offset);
    if (runAt.getTime() <= now.getTime()) return null;
    return {
      workspaceId,
      projectId: projectId ?? null,
      ruleId,
      triggerEventType: payload.entityType ?? "",
      triggerEventId: payload.entityId ?? "",
      payload,
      channel: s.channel,
      templateId: s.templateId,
      recipientType: s.recipientType,
      runAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
  }).filter(Boolean) as Record<string, unknown>[];
  if (docs.length === 0) return 0;
  await db.collection(COLLECTION).insertMany(docs as never[]);
  return docs.length;
}

/**
 * Restituisce le comunicazioni schedulate con runAt <= now e status = pending (limite default 50).
 */
export async function listDueScheduled(limit = 50): Promise<ScheduledCommunicationRow[]> {
  const db = getDb();
  const now = new Date();
  const docs = await db
    .collection(COLLECTION)
    .find({ status: "pending", runAt: { $lte: now } })
    .sort({ runAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => docToRow(d as Record<string, unknown>));
}

/**
 * Esegue una singola comunicazione schedulata (dispatcher) e la marca come inviata.
 */
export async function executeScheduled(id: string): Promise<boolean> {
  const db = getDb();
  if (!ObjectId.isValid(id)) return false;
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id), status: "pending" });
  if (!doc) return false;
  const row = docToRow(doc as Record<string, unknown>);
  try {
    await dispatchCommunicationJob({
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      channel: row.channel,
      templateId: row.templateId,
      recipientType: row.recipientType as "client" | "vendor" | "assignee",
      payload: row.payload,
    });
  } catch (err) {
    console.error("[scheduled-communications] execute failed:", id, err);
    return false;
  }
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "sent", sentAt: now, updatedAt: now } }
  );
  return true;
}

/**
 * Esegue tutte le comunicazioni schedulate in scadenza (da chiamare da cron/timer).
 */
export async function runDueScheduled(): Promise<{ processed: number; errors: number }> {
  const rows = await listDueScheduled(50);
  let errors = 0;
  for (const row of rows) {
    const ok = await executeScheduled(row._id);
    if (!ok) errors++;
  }
  return { processed: rows.length, errors };
}
