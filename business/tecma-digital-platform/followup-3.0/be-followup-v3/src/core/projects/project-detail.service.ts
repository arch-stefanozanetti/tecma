import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace } from "./project-access.js";

const COLLECTION_TZ_PROJECTS = "tz_projects";

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
  const idFilter = ObjectId.isValid(projectId) ? new ObjectId(projectId) : (projectId as unknown as ObjectId);
  const tzDoc = await db.collection(COLLECTION_TZ_PROJECTS).findOne({ _id: idFilter });
  if (!tzDoc) {
    throw new HttpError("Project not found", 404);
  }
  return {
    id: String(tzDoc._id ?? projectId),
    name: typeof tzDoc.name === "string" ? tzDoc.name : projectId,
    displayName: typeof tzDoc.displayName === "string" ? tzDoc.displayName : (tzDoc.name as string) ?? projectId,
    mode: tzDoc.mode === "rent" ? "rent" : "sell",
    city: typeof tzDoc.city === "string" ? tzDoc.city : undefined,
    payoff: typeof tzDoc.payoff === "string" ? tzDoc.payoff : undefined,
  };
};
