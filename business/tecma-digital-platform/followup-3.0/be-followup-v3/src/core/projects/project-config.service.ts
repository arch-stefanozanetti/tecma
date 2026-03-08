/**
 * Config progetto: tz_project_policies, tz_project_email_config, tz_project_email_templates, tz_project_pdf_templates.
 * Solo main DB (test-zanetti).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, getDbByName } from "../../config/db.js";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";

const COLLECTION_TZ_PROJECTS = "tz_projects";
const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";
const COLLECTION_POLICIES = "tz_project_policies";
const COLLECTION_EMAIL_CONFIG = "tz_project_email_config";
const COLLECTION_EMAIL_TEMPLATES = "tz_project_email_templates";
const COLLECTION_PDF_TEMPLATES = "tz_project_pdf_templates";

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const LEGACY_WORKSPACES = ["dev-1", "demo", "prod"];

/** Verifica che il progetto sia associato al workspace. Se isAdmin o workspace legacy, bypass. */
export const ensureProjectInWorkspace = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<void> => {
  if (isAdmin || LEGACY_WORKSPACES.includes(workspaceId)) return;
  const db = getDb();
  const wp = await db.collection(COLLECTION_WORKSPACE_PROJECTS).findOne({
    workspaceId,
    projectId,
  });
  if (!wp) {
    throw new HttpError("Project not found or not in workspace", 404);
  }
};

/** Dettaglio progetto: merge tz_projects + project DB legacy se ObjectId. */
export interface ProjectDetailRow {
  id: string;
  name: string;
  displayName: string;
  mode: "rent" | "sell";
  city?: string;
  payoff?: string;
}

export const getProjectDetail = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectDetailRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const tzDoc = await db.collection(COLLECTION_TZ_PROJECTS).findOne({ _id: projectId });
  if (tzDoc) {
    return {
      id: String(tzDoc._id ?? projectId),
      name: typeof tzDoc.name === "string" ? tzDoc.name : projectId,
      displayName: typeof tzDoc.displayName === "string" ? tzDoc.displayName : tzDoc.name ?? projectId,
      mode: tzDoc.mode === "rent" ? "rent" : "sell",
      city: typeof tzDoc.city === "string" ? tzDoc.city : undefined,
      payoff: typeof tzDoc.payoff === "string" ? tzDoc.payoff : undefined,
    };
  }
  const projectsDb = getDbByName(ENV.MONGO_PROJECT_DB_NAME);
  const projectsColl = projectsDb.collection("projects");
  const legacyQuery = ObjectId.isValid(projectId) && projectId.length === 24
    ? { _id: new ObjectId(projectId) }
    : { _id: projectId };
  const legacyDoc = await projectsColl.findOne(legacyQuery);
  if (!legacyDoc) {
    throw new HttpError("Project not found", 404);
  }
  return {
    id: String(legacyDoc._id ?? projectId),
    name: typeof legacyDoc.name === "string" ? legacyDoc.name : projectId,
    displayName: typeof legacyDoc.displayName === "string" ? legacyDoc.displayName : legacyDoc.name ?? projectId,
    mode: legacyDoc.mode === "rent" ? "rent" : "sell",
    city: typeof legacyDoc.city === "string" ? legacyDoc.city : undefined,
    payoff: typeof legacyDoc.payoff === "string" ? legacyDoc.payoff : undefined,
  };
};

// ─── Policies ────────────────────────────────────────────────────────────────

export interface ProjectPoliciesRow {
  projectId: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  content?: string;
  updatedAt: string;
}

const PoliciesPutSchema = z.object({
  privacyPolicyUrl: z.string().url().optional().or(z.literal("")),
  termsUrl: z.string().url().optional().or(z.literal("")),
  content: z.string().optional(),
});

export const getProjectPolicies = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectPoliciesRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const doc = await db.collection(COLLECTION_POLICIES).findOne({ projectId });
  const now = new Date().toISOString();
  if (!doc) {
    return { projectId, updatedAt: now };
  }
  return {
    projectId,
    privacyPolicyUrl: typeof doc.privacyPolicyUrl === "string" ? doc.privacyPolicyUrl : undefined,
    termsUrl: typeof doc.termsUrl === "string" ? doc.termsUrl : undefined,
    content: typeof doc.content === "string" ? doc.content : undefined,
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const putProjectPolicies = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectPoliciesRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = PoliciesPutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    projectId,
    ...(input.privacyPolicyUrl !== undefined && { privacyPolicyUrl: input.privacyPolicyUrl || undefined }),
    ...(input.termsUrl !== undefined && { termsUrl: input.termsUrl || undefined }),
    ...(input.content !== undefined && { content: input.content }),
    updatedAt: now,
  };
  await db.collection(COLLECTION_POLICIES).updateOne(
    { projectId },
    { $set: doc },
    { upsert: true }
  );
  return getProjectPolicies(projectId, workspaceId, isAdmin);
};

// ─── Email config ─────────────────────────────────────────────────────────────

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

// ─── Email templates ─────────────────────────────────────────────────────────

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
  const doc = await db.collection(COLLECTION_EMAIL_TEMPLATES).findOne({
    _id: ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId,
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
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId;
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
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId;
  const result = await db.collection(COLLECTION_EMAIL_TEMPLATES).deleteOne({ _id: id, projectId });
  if (result.deletedCount === 0) {
    throw new HttpError("Email template not found", 404);
  }
  return { deleted: true };
};

// ─── PDF templates ─────────────────────────────────────────────────────────────

export interface ProjectPdfTemplateRow {
  _id: string;
  projectId: string;
  name: string;
  templateKey: string;
  config: Record<string, unknown>;
  updatedAt: string;
}

const PdfTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  templateKey: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional(),
});

const PdfTemplatePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
});

export const listProjectPdfTemplates = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectPdfTemplateRow[]> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const docs = await db
    .collection(COLLECTION_PDF_TEMPLATES)
    .find({ projectId })
    .sort({ templateKey: 1 })
    .toArray();
  return docs.map((d) => ({
    _id: String(d._id ?? ""),
    projectId: String(d.projectId ?? ""),
    name: typeof d.name === "string" ? d.name : "",
    templateKey: typeof d.templateKey === "string" ? d.templateKey : "",
    config: typeof d.config === "object" && d.config !== null ? (d.config as Record<string, unknown>) : {},
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

export const createProjectPdfTemplate = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectPdfTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = PdfTemplateCreateSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_PDF_TEMPLATES);
  const existing = await coll.findOne({ projectId, templateKey: input.templateKey.trim() });
  if (existing) {
    throw new HttpError(`PDF template with key "${input.templateKey}" already exists`, 400);
  }
  const now = new Date().toISOString();
  const doc = {
    projectId,
    name: input.name.trim(),
    templateKey: input.templateKey.trim(),
    config: input.config ?? {},
    updatedAt: now,
  };
  const result = await coll.insertOne(doc);
  const inserted = await coll.findOne({ _id: result.insertedId });
  if (!inserted) throw new HttpError("Failed to create PDF template", 500);
  return {
    _id: String(inserted._id),
    projectId: String(inserted.projectId ?? ""),
    name: typeof inserted.name === "string" ? inserted.name : "",
    templateKey: typeof inserted.templateKey === "string" ? inserted.templateKey : "",
    config: typeof inserted.config === "object" && inserted.config !== null ? (inserted.config as Record<string, unknown>) : {},
    updatedAt: toIsoDate(inserted.updatedAt),
  };
};

export const getProjectPdfTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectPdfTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const doc = await db.collection(COLLECTION_PDF_TEMPLATES).findOne({
    _id: ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId,
    projectId,
  });
  if (!doc) {
    throw new HttpError("PDF template not found", 404);
  }
  return {
    _id: String(doc._id),
    projectId: String(doc.projectId ?? ""),
    name: typeof doc.name === "string" ? doc.name : "",
    templateKey: typeof doc.templateKey === "string" ? doc.templateKey : "",
    config: typeof doc.config === "object" && doc.config !== null ? (doc.config as Record<string, unknown>) : {},
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const patchProjectPdfTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectPdfTemplateRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = PdfTemplatePatchSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_PDF_TEMPLATES);
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId;
  const existing = await coll.findOne({ _id: id, projectId });
  if (!existing) {
    throw new HttpError("PDF template not found", 404);
  }
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.config !== undefined) update.config = input.config;
  await coll.updateOne({ _id: id, projectId }, { $set: update });
  return getProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
};

export const deleteProjectPdfTemplate = async (
  projectId: string,
  templateId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<{ deleted: true }> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : templateId;
  const result = await db.collection(COLLECTION_PDF_TEMPLATES).deleteOne({ _id: id, projectId });
  if (result.deletedCount === 0) {
    throw new HttpError("PDF template not found", 404);
  }
  return { deleted: true };
};
