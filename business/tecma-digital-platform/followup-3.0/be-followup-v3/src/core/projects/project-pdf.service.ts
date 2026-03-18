import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";

const COLLECTION_PDF_TEMPLATES = "tz_project_pdf_templates";

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
  const pdfTemplateIdFilter = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
  const doc = await db.collection(COLLECTION_PDF_TEMPLATES).findOne({
    _id: pdfTemplateIdFilter,
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
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
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
  const id = ObjectId.isValid(templateId) ? new ObjectId(templateId) : (templateId as unknown as ObjectId);
  const result = await db.collection(COLLECTION_PDF_TEMPLATES).deleteOne({ _id: id, projectId });
  if (result.deletedCount === 0) {
    throw new HttpError("PDF template not found", 404);
  }
  return { deleted: true };
};
