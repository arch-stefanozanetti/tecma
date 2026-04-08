import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace } from "../projects/project-access.js";

const ListInputSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  requestedBucket: z.string().optional(),
  requestedPrefix: z.string().optional(),
  isTecmaAdmin: z.boolean().default(false),
});

export interface StorageScope {
  bucket: string;
  prefix: string;
  projectDisplayName?: string;
}

function sanitizePrefix(raw: string | undefined): string {
  const p = (raw ?? "").trim().replace(/^\/+/, "").replace(/\/+/g, "/");
  if (p.includes("..")) throw new HttpError("Prefix non valido", 400);
  return p;
}

function slugSegment(v: string): string {
  const s = v.trim().replace(/\s+/g, " ").slice(0, 120);
  return encodeURIComponent(s);
}

function allowedBuckets(): string[] {
  const fromEnv = (process.env.OCI_ALLOWED_BUCKETS ?? "").trim();
  if (!fromEnv) {
    const fallback = process.env.ASSETS_S3_BUCKET ?? process.env.EMAIL_FLOW_S3_BUCKET ?? "";
    return fallback ? [fallback] : [];
  }
  return fromEnv
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function resolveProjectDisplayName(projectId: string): Promise<string | undefined> {
  const db = getDb();
  const project = await db
    .collection<Record<string, unknown>>("tz_projects")
    .findOne({ $or: [{ _id: projectId as never }, { legacyProjectId: projectId }] });
  const name = typeof project?.displayName === "string" && project.displayName.trim() !== ""
    ? project.displayName
    : typeof project?.name === "string"
      ? project.name
      : "";
  return name || undefined;
}

export async function resolveStorageScope(inputRaw: unknown): Promise<StorageScope> {
  const input = ListInputSchema.parse(inputRaw);
  const prefix = sanitizePrefix(input.requestedPrefix);
  const buckets = allowedBuckets();
  if (buckets.length === 0) throw new HttpError("Bucket storage non configurato", 500);

  if (input.isTecmaAdmin) {
    const bucket = input.requestedBucket?.trim() || buckets[0];
    if (!buckets.includes(bucket)) {
      throw new HttpError("Bucket non consentito", 403);
    }
    const safePrefix = prefix || "initiatives/";
    if (!safePrefix.startsWith("initiatives/") && !safePrefix.startsWith("workspaces/")) {
      throw new HttpError("Prefix non consentito per admin", 403);
    }
    return { bucket, prefix: safePrefix.endsWith("/") ? safePrefix : `${safePrefix}/` };
  }

  const bucket = buckets[0];
  if (input.requestedBucket && input.requestedBucket !== bucket) {
    throw new HttpError("Bucket non consentito per workspace user", 403);
  }

  let root = `workspaces/${input.workspaceId}/`;
  if (input.projectId) {
    await ensureProjectInWorkspace(input.projectId, input.workspaceId, false);
    const projectDisplayName = await resolveProjectDisplayName(input.projectId);
    if (projectDisplayName) {
      root = `initiatives/${slugSegment(projectDisplayName)}/`;
      if (prefix && !prefix.startsWith(root)) {
        throw new HttpError("Prefix fuori scope progetto", 403);
      }
      return { bucket, prefix: prefix || root, projectDisplayName };
    }
  }

  if (prefix && !prefix.startsWith(root)) {
    throw new HttpError("Prefix fuori scope workspace", 403);
  }
  return { bucket, prefix: prefix || root };
}

export function buildStandardProjectFolders(projectDisplayName: string): string[] {
  const base = `initiatives/${slugSegment(projectDisplayName)}`;
  return [
    `${base}/global/img/`,
    `${base}/floorplanning/img/planimetrie/`,
    `${base}/neurosales/configuration/`,
    `${base}/email-flows/assets/`,
  ];
}

