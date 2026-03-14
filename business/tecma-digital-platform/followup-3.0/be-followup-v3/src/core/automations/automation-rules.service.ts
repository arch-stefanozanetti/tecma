/**
 * Regole di automazione if/then (Wave 4). Collection tz_automation_rules.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_automation_rules";

export const AUTOMATION_EVENT_TYPES = [
  "request.created",
  "request.status_changed",
  "client.created",
  "visit.scheduled",
  "visit.updated",
  "visit.completed",
  "proposal.sent",
  "contract.signed",
] as const;
export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = ["create_notification", "webhook_call"] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export interface AutomationRuleTrigger {
  event_type: AutomationEventType;
  /** Per request.status_changed: stato di destinazione (opzionale). */
  toStatus?: string;
}

export interface CreateNotificationAction {
  type: "create_notification";
  title: string;
  body?: string;
  /** Link come stringa o { section, state }. */
  link?: string | { section: string; state?: Record<string, unknown> };
}

export interface WebhookCallAction {
  type: "webhook_call";
  /** Riferimento a webhook config id o URL diretto; per ora usiamo solo "use_workspace_webhooks". */
  useWorkspaceWebhooks?: boolean;
}

export type AutomationRuleAction = CreateNotificationAction | WebhookCallAction;

export interface AutomationRuleRow {
  _id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  trigger: AutomationRuleTrigger;
  actions: AutomationRuleAction[];
  createdAt: string;
  updatedAt: string;
}

const TriggerSchema = z.object({
  event_type: z.enum(AUTOMATION_EVENT_TYPES as unknown as [string, ...string[]]),
  toStatus: z.string().optional(),
});

const CreateNotificationActionSchema = z.object({
  type: z.literal("create_notification"),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.union([z.string(), z.object({ section: z.string(), state: z.record(z.unknown()).optional() })]).optional(),
});

const WebhookCallActionSchema = z.object({
  type: z.literal("webhook_call"),
  useWorkspaceWebhooks: z.boolean().optional(),
});

const ActionSchema = z.union([CreateNotificationActionSchema, WebhookCallActionSchema]);

const CreateRuleSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1),
});

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  trigger: TriggerSchema.optional(),
  actions: z.array(ActionSchema).min(1).optional(),
});

const toIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

function docToRow(doc: Record<string, unknown>): AutomationRuleRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    name: String(doc.name ?? ""),
    enabled: Boolean(doc.enabled),
    trigger: doc.trigger as AutomationRuleTrigger,
    actions: (doc.actions as AutomationRuleAction[]) ?? [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const listByWorkspace = async (workspaceId: string): Promise<AutomationRuleRow[]> => {
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => docToRow(d as Record<string, unknown>));
};

export const getById = async (id: string): Promise<AutomationRuleRow | null> => {
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

export const create = async (rawInput: unknown): Promise<AutomationRuleRow> => {
  const input = CreateRuleSchema.parse(rawInput);
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    enabled: input.enabled,
    trigger: input.trigger,
    actions: input.actions,
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
): Promise<AutomationRuleRow | null> => {
  const input = UpdateRuleSchema.parse(rawInput);
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    throw new HttpError("Invalid rule id", 400);
  }
  const db = getDb();
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateFields.name = input.name.trim();
  if (input.enabled !== undefined) updateFields.enabled = input.enabled;
  if (input.trigger !== undefined) updateFields.trigger = input.trigger;
  if (input.actions !== undefined) updateFields.actions = input.actions;

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
