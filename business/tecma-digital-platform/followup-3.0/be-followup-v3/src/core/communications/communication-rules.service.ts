/**
 * Regole di comunicazione: evento → azioni (send_email, send_whatsapp, create_notification) e schedules.
 * Collection tz_communication_rules.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { AUTOMATION_EVENT_TYPES, type AutomationEventType } from "../automations/automation-rules.service.js";

const COLLECTION = "tz_communication_rules";

export type CommunicationRecipientType = "client" | "vendor" | "assignee";

export interface CommunicationRuleTrigger {
  eventType: AutomationEventType;
  toStatus?: string;
}

export interface SendEmailAction {
  type: "send_email";
  templateId: string;
  recipientType: CommunicationRecipientType;
}

export interface SendWhatsappAction {
  type: "send_whatsapp";
  templateId: string;
  recipientType: "client";
}

export interface SendSmsAction {
  type: "send_sms";
  templateId: string;
  recipientType: CommunicationRecipientType;
}

export interface CreateNotificationAction {
  type: "create_notification";
  title: string;
  body?: string;
  link?: string;
}

export type CommunicationRuleAction =
  | SendEmailAction
  | SendWhatsappAction
  | SendSmsAction
  | CreateNotificationAction;

export interface CommunicationSchedule {
  offset: { value: number; unit: "minutes" | "hours" | "days" };
  channel: "email" | "whatsapp" | "sms" | "in_app";
  templateId: string;
  recipientType: CommunicationRecipientType;
}

export interface CommunicationRuleRow {
  _id: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  enabled: boolean;
  trigger: CommunicationRuleTrigger;
  actions: CommunicationRuleAction[];
  schedules: CommunicationSchedule[];
  createdAt: string;
  updatedAt: string;
}

const TriggerSchema = z.object({
  eventType: z.enum(AUTOMATION_EVENT_TYPES as unknown as [string, ...string[]]),
  toStatus: z.string().optional(),
});

const OffsetSchema = z.object({
  value: z.number().int(),
  unit: z.enum(["minutes", "hours", "days"]),
});

const ScheduleSchema = z.object({
  offset: OffsetSchema,
  channel: z.enum(["email", "whatsapp", "sms", "in_app"]),
  templateId: z.string().min(1),
  recipientType: z.enum(["client", "vendor", "assignee"]),
});

const SendEmailActionSchema = z.object({
  type: z.literal("send_email"),
  templateId: z.string().min(1),
  recipientType: z.enum(["client", "vendor", "assignee"]),
});

const SendWhatsappActionSchema = z.object({
  type: z.literal("send_whatsapp"),
  templateId: z.string().min(1),
  recipientType: z.literal("client"),
});

const SendSmsActionSchema = z.object({
  type: z.literal("send_sms"),
  templateId: z.string().min(1),
  recipientType: z.enum(["client", "vendor", "assignee"]),
});

const CreateNotificationActionSchema = z.object({
  type: z.literal("create_notification"),
  title: z.string().min(1),
  body: z.string().optional(),
  link: z.string().optional(),
});

const ActionSchema = z.union([
  SendEmailActionSchema,
  SendWhatsappActionSchema,
  SendSmsActionSchema,
  CreateNotificationActionSchema,
]);

const CreateRuleSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1),
  schedules: z.array(ScheduleSchema).default([]),
});

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  trigger: TriggerSchema.optional(),
  actions: z.array(ActionSchema).min(1).optional(),
  schedules: z.array(ScheduleSchema).optional(),
});

const toIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

function docToRow(doc: Record<string, unknown>): CommunicationRuleRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    projectId: doc.projectId != null ? String(doc.projectId) : undefined,
    name: String(doc.name ?? ""),
    enabled: Boolean(doc.enabled),
    trigger: doc.trigger as CommunicationRuleTrigger,
    actions: (doc.actions as CommunicationRuleAction[]) ?? [],
    schedules: (doc.schedules as CommunicationSchedule[]) ?? [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const listByWorkspace = async (
  workspaceId: string,
  options?: { projectId?: string }
): Promise<CommunicationRuleRow[]> => {
  const db = getDb();
  const filter: Record<string, unknown> = { workspaceId };
  if (options?.projectId != null) filter.projectId = options.projectId;
  const docs = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => docToRow(d as Record<string, unknown>));
};

export const getById = async (id: string): Promise<CommunicationRuleRow | null> => {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  return doc ? docToRow(doc as Record<string, unknown>) : null;
};

export const create = async (input: z.infer<typeof CreateRuleSchema>): Promise<CommunicationRuleRow> => {
  const parsed = CreateRuleSchema.parse(input);
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId: parsed.workspaceId,
    ...(parsed.projectId && { projectId: parsed.projectId }),
    name: parsed.name.trim(),
    enabled: parsed.enabled ?? true,
    trigger: parsed.trigger,
    actions: parsed.actions,
    schedules: parsed.schedules ?? [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc as never);
  const inserted = await db.collection(COLLECTION).findOne({ _id: result.insertedId });
  return docToRow(inserted as Record<string, unknown>);
};

export const update = async (
  id: string,
  input: z.infer<typeof UpdateRuleSchema>
): Promise<CommunicationRuleRow | null> => {
  if (!ObjectId.isValid(id)) return null;
  const parsed = UpdateRuleSchema.parse(input);
  const db = getDb();
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.name !== undefined) updateFields.name = parsed.name.trim();
  if (parsed.enabled !== undefined) updateFields.enabled = parsed.enabled;
  if (parsed.trigger !== undefined) updateFields.trigger = parsed.trigger;
  if (parsed.actions !== undefined) updateFields.actions = parsed.actions;
  if (parsed.schedules !== undefined) updateFields.schedules = parsed.schedules;
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateFields },
    { returnDocument: "after" }
  );
  return result ? docToRow(result as Record<string, unknown>) : null;
};

export const remove = async (id: string): Promise<boolean> => {
  if (!ObjectId.isValid(id)) return false;
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  return (result.deletedCount ?? 0) > 0;
};
