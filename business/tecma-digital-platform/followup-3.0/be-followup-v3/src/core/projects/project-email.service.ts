import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";

const COLLECTION_EMAIL_CONFIG = "tz_project_email_config";
const COLLECTION_EMAIL_TEMPLATES = "tz_project_email_templates";

export interface ProjectEmailConfigRow {
  projectId: string;
  smtpHost?: string;
  smtpPort?: number;
  fromEmail?: string;
  defaultTemplateId?: string;
  updatedAt: string;
}

const EmailConfigPutSchema = z.object({
  smtpHost: z.string().max(300).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  fromEmail: z.string().email().optional().or(z.literal("")),
  defaultTemplateId: z.string().max(100).optional(),
});

export const getProjectEmailConfig = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectEmailConfigRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const doc = await db.collection(COLLECTION_EMAIL_CONFIG).findOne({ projectId });
  const now = new Date().toISOString();
  if (!doc) {
    return { projectId, updatedAt: now };
  }
  return {
    projectId,
    smtpHost: typeof doc.smtpHost === "string" ? doc.smtpHost : undefined,
    smtpPort: typeof doc.smtpPort === "number" ? doc.smtpPort : undefined,
    fromEmail: typeof doc.fromEmail === "string" ? doc.fromEmail : undefined,
    defaultTemplateId: typeof doc.defaultTemplateId === "string" ? doc.defaultTemplateId : undefined,
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const putProjectEmailConfig = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectEmailConfigRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = EmailConfigPutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    projectId,
    updatedAt: now,
  };
  if (input.smtpHost !== undefined) doc.smtpHost = input.smtpHost || undefined;
  if (input.smtpPort !== undefined) doc.smtpPort = input.smtpPort;
  if (input.fromEmail !== undefined) doc.fromEmail = input.fromEmail || undefined;
  if (input.defaultTemplateId !== undefined) doc.defaultTemplateId = input.defaultTemplateId;
  await db.collection(COLLECTION_EMAIL_CONFIG).updateOne(
    { projectId },
    { $set: doc },
    { upsert: true }
  );
  return getProjectEmailConfig(projectId, workspaceId, isAdmin);
};

export interface ProjectEmailTemplateRow {
  _id: string;
  projectId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  createdAt: string;
  updatedAt: string;
}

const EmailTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
});

const EmailTemplatePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(500).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().optional(),
});

export const listProjectEmailTemplates = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectEmailTemplateRow[]> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const docs = await db
    .collection(COLLECTION_EMAIL_TEMPLATES)
    .find({ projectId })
    .sort({ name: 1 })
    .toArray();
  return docs.map((d) => ({
    _id: String(d._id ?? ""),
    projectId: String(d.projectId ?? ""),
    name: typeof d.name === "string" ? d.name : "",
    subject: typeof d.subject === "string" ? d.subject : "",
    bodyHtml: typeof d.bodyHtml === "string" ? d.bodyHtml : "",
    bodyText: typeof d.bodyText === "string" ? d.bodyText : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

export const createProjectEmailTemplate = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectEmailTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = EmailTemplateCreateSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_EMAIL_TEMPLATES);
  const existing = await coll.findOne({ projectId, name: input.name.trim() });
  if (existing) {
    throw new HttpError(`Template with name "${input.name}" already exists`, 400);
  }
  const now = new Date().toISOString();
  const doc = {
    projectId,
    name: input.name.trim(),
    subject: input.subject.trim(),
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText?.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await coll.insertOne(doc);
  const inserted = await coll.findOne({ _id: result.insertedId });
  if (!inserted) throw new HttpError("Failed to create template", 500);
  return {
    _id: String(inserted._id),
    projectId: String(inserted.projectId ?? ""),
    name: typeof inserted.name === "string" ? inserted.name : "",
    subject: typeof inserted.subject === "string" ? inserted.subject : "",
    bodyHtml: typeof inserted.bodyHtml === "string" ? inserted.bodyHtml : "",
    bodyText: typeof inserted.bodyText === "string" ? inserted.bodyText : undefined,
    createdAt: toIsoDate(inserted.createdAt),
    updatedAt: toIsoDate(inserted.updatedAt),
  };
};

export const getProjectEmailTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectEmailTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const templateIdFilter = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
  const doc = await db.collection(COLLECTION_EMAIL_TEMPLATES).findOne({
    _id: templateIdFilter,
    projectId,
  });
  if (!doc) {
    throw new HttpError("Email template not found", 404);
  }
  return {
    _id: String(doc._id),
    projectId: String(doc.projectId ?? ""),
    name: typeof doc.name === "string" ? doc.name : "",
    subject: typeof doc.subject === "string" ? doc.subject : "",
    bodyHtml: typeof doc.bodyHtml === "string" ? doc.bodyHtml : "",
    bodyText: typeof doc.bodyText === "string" ? doc.bodyText : undefined,
    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const patchProjectEmailTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectEmailTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = EmailTemplatePatchSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_EMAIL_TEMPLATES);
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
  const existing = await coll.findOne({ _id: id, projectId });
  if (!existing) {
    throw new HttpError("Email template not found", 404);
  }
  if (input.name !== undefined && input.name !== existing.name) {
    const dup = await coll.findOne({ projectId, name: input.name.trim() });
    if (dup) throw new HttpError(`Template with name "${input.name}" already exists`, 400);
  }
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.subject !== undefined) update.subject = input.subject.trim();
  if (input.bodyHtml !== undefined) update.bodyHtml = input.bodyHtml;
  if (input.bodyText !== undefined) update.bodyText = input.bodyText?.trim();
  await coll.updateOne({ _id: id, projectId }, { $set: update });
  return getProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
};

export const deleteProjectEmailTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<{ deleted: true }> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
  const result = await db.collection(COLLECTION_EMAIL_TEMPLATES).deleteOne({ _id: id, projectId });
  if (result.deletedCount === 0) {
    throw new HttpError("Email template not found", 404);
  }
  return { deleted: true };
};
