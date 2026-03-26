import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace } from "./project-access.js";

const COLLECTION_TZ_PROJECTS = "tz_projects";
const COLLECTION_PROJECTS = "projects";

export interface ProjectDetailRow {
  id: string;
  name: string;
  displayName: string;
  mode: "rent" | "sell";
  city?: string;
  payoff?: string;
  contactEmail?: string;
  contactPhone?: string;
  projectUrl?: string;
  customDomain?: string;
  defaultLang?: string;
  hostKey?: string;
  assetKey?: string;
  feVendorKey?: string;
  automaticQuoteEnabled?: boolean;
  accountManagerEnabled?: boolean;
  hasDAS?: boolean;
  broker?: string | null;
  iban?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  migration?: Record<string, unknown>;
  legacyPayload?: Record<string, unknown>;
}

export const getProjectDetail = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectDetailRow> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const db = getDb();
  const tzColl = db.collection<Record<string, unknown>>(COLLECTION_TZ_PROJECTS);
  const legacyColl = db.collection<Record<string, unknown>>(COLLECTION_PROJECTS);
  const idFilter = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
  const tzDoc =
    (await tzColl.findOne({ _id: idFilter as never })) ??
    (await tzColl.findOne({ _id: projectId as never })) ??
    (await tzColl.findOne({ legacyProjectId: projectId }));
  const legacyDoc =
    tzDoc == null
      ? (await legacyColl.findOne({ _id: idFilter as never })) ??
        (await legacyColl.findOne({ _id: projectId as never }))
      : null;
  const doc = tzDoc ?? legacyDoc;
  if (!doc) throw new HttpError("Project not found", 404);

  const resolvedMode = doc.mode === "rent" ? "rent" : "sell";
  const resolvedName = typeof doc.name === "string" ? doc.name : projectId;
  const resolvedDisplayName =
    typeof doc.displayName === "string" && doc.displayName.trim() !== ""
      ? doc.displayName
      : resolvedName;

  return {
    id: String(doc._id ?? projectId),
    name: resolvedName,
    displayName: resolvedDisplayName,
    mode: resolvedMode,
    city: typeof doc.city === "string" ? doc.city : undefined,
    payoff: typeof doc.payoff === "string" ? doc.payoff : undefined,
    contactEmail: typeof doc.contactEmail === "string" ? doc.contactEmail : undefined,
    contactPhone: typeof doc.contactPhone === "string" ? doc.contactPhone : undefined,
    projectUrl: typeof doc.projectUrl === "string" ? doc.projectUrl : undefined,
    customDomain: typeof doc.customDomain === "string" ? doc.customDomain : undefined,
    defaultLang: typeof doc.defaultLang === "string" ? doc.defaultLang : undefined,
    hostKey: typeof doc.hostKey === "string" ? doc.hostKey : undefined,
    assetKey: typeof doc.assetKey === "string" ? doc.assetKey : undefined,
    feVendorKey: typeof doc.feVendorKey === "string" ? doc.feVendorKey : undefined,
    automaticQuoteEnabled:
      typeof doc.automaticQuoteEnabled === "boolean" ? doc.automaticQuoteEnabled : undefined,
    accountManagerEnabled:
      typeof doc.accountManagerEnabled === "boolean" ? doc.accountManagerEnabled : undefined,
    hasDAS: typeof doc.hasDAS === "boolean" ? doc.hasDAS : undefined,
    broker:
      doc.broker === null || typeof doc.broker === "string"
        ? (doc.broker as string | null)
        : undefined,
    iban: typeof doc.iban === "string" ? doc.iban : undefined,
    archived: typeof doc.archived === "boolean" ? doc.archived : undefined,
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : undefined,
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : undefined,
    migration:
      typeof doc.migration === "object" && doc.migration !== null
        ? (doc.migration as Record<string, unknown>)
        : undefined,
    legacyPayload:
      typeof doc.legacyPayload === "object" && doc.legacyPayload !== null
        ? (doc.legacyPayload as Record<string, unknown>)
        : undefined,
  };
};
