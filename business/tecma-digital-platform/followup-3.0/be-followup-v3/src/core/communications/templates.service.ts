/**
 * Template di comunicazione per canale (email, whatsapp, sms, in_app).
 * Collection tz_communication_templates.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { WhatsAppTemplatePayload } from "../messaging/messaging.types.js";

const COLLECTION = "tz_communication_templates";

export const COMMUNICATION_CHANNELS = ["email", "whatsapp", "sms", "in_app"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export interface CommunicationTemplateRow {
  _id: string;
  workspaceId: string;
  projectId?: string;
  channel: CommunicationChannel;
  name: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  variables: string[];
  /** Nome template approvato in Meta (WhatsApp Cloud API), solo per channel whatsapp con provider Meta. */
  metaTemplateName?: string;
  /** Codice lingua Meta, es. it, en_US. */
  metaTemplateLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  channel: z.enum(COMMUNICATION_CHANNELS),
  name: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
  variables: z.array(z.string().max(64)).default([]),
  metaTemplateName: z.string().max(512).optional(),
  metaTemplateLanguage: z.string().max(32).optional(),
});

const UpdateSchema = z.object({
  projectId: z.string().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  subject: z.string().max(500).optional(),
  bodyText: z.string().min(1).optional(),
  bodyHtml: z.string().optional(),
  variables: z.array(z.string().max(64)).optional(),
  metaTemplateName: z.string().max(512).nullable().optional(),
  metaTemplateLanguage: z.string().max(32).nullable().optional(),
});

const toIso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
};

function docToRow(doc: Record<string, unknown>): CommunicationTemplateRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    projectId: doc.projectId != null ? String(doc.projectId) : undefined,
    channel: (doc.channel as CommunicationChannel) ?? "email",
    name: String(doc.name ?? ""),
    subject: doc.subject != null ? String(doc.subject) : undefined,
    bodyText: String(doc.bodyText ?? ""),
    bodyHtml: doc.bodyHtml != null ? String(doc.bodyHtml) : undefined,
    variables: Array.isArray(doc.variables) ? doc.variables.map(String) : [],
    metaTemplateName: doc.metaTemplateName != null ? String(doc.metaTemplateName) : undefined,
    metaTemplateLanguage: doc.metaTemplateLanguage != null ? String(doc.metaTemplateLanguage) : undefined,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const listByWorkspace = async (
  workspaceId: string,
  options?: { projectId?: string; channel?: CommunicationChannel }
): Promise<CommunicationTemplateRow[]> => {
  const db = getDb();
  const filter: Record<string, unknown> = { workspaceId };
  if (options?.projectId != null) filter.projectId = options.projectId;
  if (options?.channel != null) filter.channel = options.channel;
  const docs = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => docToRow(d as Record<string, unknown>));
};

export const getById = async (id: string): Promise<CommunicationTemplateRow | null> => {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  return doc ? docToRow(doc as Record<string, unknown>) : null;
};

export const create = async (input: z.infer<typeof CreateSchema>): Promise<CommunicationTemplateRow> => {
  const parsed = CreateSchema.parse(input);
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId: parsed.workspaceId,
    ...(parsed.projectId && { projectId: parsed.projectId }),
    channel: parsed.channel,
    name: parsed.name.trim(),
    ...(parsed.subject && { subject: parsed.subject.trim() }),
    bodyText: parsed.bodyText.trim(),
    ...(parsed.bodyHtml && { bodyHtml: parsed.bodyHtml.trim() }),
    variables: parsed.variables ?? [],
    ...(parsed.metaTemplateName?.trim() && { metaTemplateName: parsed.metaTemplateName.trim() }),
    ...(parsed.metaTemplateLanguage?.trim() && { metaTemplateLanguage: parsed.metaTemplateLanguage.trim() }),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc as never);
  const inserted = await db.collection(COLLECTION).findOne({ _id: result.insertedId });
  return docToRow(inserted as Record<string, unknown>);
};

export const update = async (
  id: string,
  input: z.infer<typeof UpdateSchema>
): Promise<CommunicationTemplateRow | null> => {
  if (!ObjectId.isValid(id)) return null;
  const parsed = UpdateSchema.parse(input);
  const db = getDb();
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.name !== undefined) updateFields.name = parsed.name.trim();
  if (parsed.subject !== undefined) updateFields.subject = parsed.subject?.trim() ?? null;
  if (parsed.bodyText !== undefined) updateFields.bodyText = parsed.bodyText.trim();
  if (parsed.bodyHtml !== undefined) updateFields.bodyHtml = parsed.bodyHtml?.trim() ?? null;
  if (parsed.variables !== undefined) updateFields.variables = parsed.variables;
  if (parsed.projectId !== undefined) updateFields.projectId = parsed.projectId || null;
  if (parsed.metaTemplateName !== undefined) {
    updateFields.metaTemplateName = parsed.metaTemplateName?.trim() || null;
  }
  if (parsed.metaTemplateLanguage !== undefined) {
    updateFields.metaTemplateLanguage = parsed.metaTemplateLanguage?.trim() || null;
  }
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

export interface ResolvedTemplate {
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
}

/** Sostituisce {{var}} con i valori in context. */
function substitute(text: string, context: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? "");
}

export function resolveTemplate(
  template: CommunicationTemplateRow,
  context: Record<string, string | undefined>
): ResolvedTemplate {
  return {
    ...(template.subject != null && { subject: substitute(template.subject, context) }),
    bodyText: substitute(template.bodyText, context),
    ...(template.bodyHtml != null && { bodyHtml: substitute(template.bodyHtml, context) }),
  };
}

/**
 * Costruisce il payload template Meta: ordine parametri = ordine di `template.variables` (chiavi contesto).
 */
export function buildMetaWhatsAppTemplatePayload(
  template: CommunicationTemplateRow,
  context: Record<string, string | undefined>
): WhatsAppTemplatePayload | null {
  const name = template.metaTemplateName?.trim();
  const languageCode = template.metaTemplateLanguage?.trim();
  if (!name || !languageCode) return null;
  const bodyParameterValues = template.variables.map((key) => context[key] ?? "");
  return { name, languageCode, bodyParameterValues };
}
