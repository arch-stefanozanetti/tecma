import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";

const COLLECTION_BRANDING = "tz_project_branding";

export interface ProjectBrandingRow {
  projectId: string;
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  updatedAt: string;
}

const BrandingPutSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().max(50).optional(),
  footerText: z.string().max(1000).optional(),
});

export const getProjectBranding = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectBrandingRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const doc = await db.collection(COLLECTION_BRANDING).findOne({ projectId });
  const now = new Date().toISOString();
  if (!doc) {
    return { projectId, updatedAt: now };
  }
  return {
    projectId,
    logoUrl: typeof doc.logoUrl === "string" ? doc.logoUrl : undefined,
    primaryColor: typeof doc.primaryColor === "string" ? doc.primaryColor : undefined,
    footerText: typeof doc.footerText === "string" ? doc.footerText : undefined,
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const getProjectBrandingInternal = async (projectId: string): Promise<ProjectBrandingRow | null> => {
  const db = getDb();
  const doc = await db.collection(COLLECTION_BRANDING).findOne({ projectId });
  if (!doc) return null;
  return {
    projectId,
    logoUrl: typeof doc.logoUrl === "string" ? doc.logoUrl : undefined,
    primaryColor: typeof doc.primaryColor === "string" ? doc.primaryColor : undefined,
    footerText: typeof doc.footerText === "string" ? doc.footerText : undefined,
    updatedAt: toIsoDate(doc.updatedAt),
  };
};

export const putProjectBranding = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectBrandingRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = BrandingPutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    projectId,
    updatedAt: now,
  };
  if (input.logoUrl !== undefined) doc.logoUrl = input.logoUrl || undefined;
  if (input.primaryColor !== undefined) doc.primaryColor = input.primaryColor || undefined;
  if (input.footerText !== undefined) doc.footerText = input.footerText || undefined;
  await db.collection(COLLECTION_BRANDING).updateOne(
    { projectId },
    { $set: doc },
    { upsert: true }
  );
  return getProjectBranding(projectId, workspaceId, isAdmin);
};
