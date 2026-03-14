/**
 * Configurazione webhook per workspace (Wave 4). Collection tz_webhook_configs.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { AUTOMATION_EVENT_TYPES, type AutomationEventType } from "./automation-rules.service.js";

const COLLECTION = "tz_webhook_configs";

export interface WebhookConfigRow {
  _id: string;
  workspaceId: string;
  url: string;
  secret?: string;
  events: AutomationEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(AUTOMATION_EVENT_TYPES as unknown as [string, ...string[]])).min(1),
  enabled: z.boolean().default(true),
});

const UpdateSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().optional(),
  events: z.array(z.enum(AUTOMATION_EVENT_TYPES as unknown as [string, ...string[]])).min(1).optional(),
  enabled: z.boolean().optional(),
});

const toIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

function docToRow(doc: Record<string, unknown>): WebhookConfigRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    url: String(doc.url ?? ""),
    secret: doc.secret as string | undefined,
    events: (doc.events as AutomationEventType[]) ?? [],
    enabled: Boolean(doc.enabled),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const listByWorkspace = async (workspaceId: string): Promise<WebhookConfigRow[]> => {
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => docToRow(d as Record<string, unknown>));
};

export const getById = async (id: string): Promise<WebhookConfigRow | null> => {
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return null;
  }
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: oid });
  if (!doc) return null;
  return docToRow(doc as Record<string, unknown>);
};

export const create = async (rawInput: unknown): Promise<WebhookConfigRow> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId: input.workspaceId,
    url: input.url.trim(),
    ...(input.secret != null && input.secret !== "" && { secret: input.secret }),
    events: input.events,
    enabled: input.enabled,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return docToRow({
    ...doc,
    _id: result.insertedId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  } as Record<string, unknown>);
};

export const update = async (
  id: string,
  rawInput: unknown
): Promise<WebhookConfigRow | null> => {
  const input = UpdateSchema.parse(rawInput);
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    throw new HttpError("Invalid webhook config id", 400);
  }
  const db = getDb();
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (input.url !== undefined) updateFields.url = input.url.trim();
  if (input.secret !== undefined) updateFields.secret = input.secret || undefined;
  if (input.events !== undefined) updateFields.events = input.events;
  if (input.enabled !== undefined) updateFields.enabled = input.enabled;

  const result = await db
    .collection(COLLECTION)
    .findOneAndUpdate({ _id: oid }, { $set: updateFields }, { returnDocument: "after" });
  if (!result) return null;
  return docToRow(result as Record<string, unknown>);
};

export const remove = async (id: string): Promise<boolean> => {
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return false;
  }
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ _id: oid });
  return result.deletedCount === 1;
};
