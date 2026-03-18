import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";

const COLLECTION_POLICIES = "tz_project_policies";

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
