/**
 * Creazione progetti in tz_projects (main DB).
 * I progetti creati da Followup vanno in tz_projects; projectAccess unisce con project DB (read online).
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { ensureProjectInWorkspace } from "./project-access.js";

const COLLECTION_TZ_PROJECTS = "tz_projects";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  workspace_id: z.string().min(1).optional(),
  displayName: z.string().max(200).optional(),
  mode: z.enum(["rent", "sell"]).default("sell"),
  city: z.string().max(200).optional(),
  payoff: z.string().max(300).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  projectUrl: z.string().max(500).optional(),
  customDomain: z.string().max(300).optional(),
  defaultLang: z.string().max(10).optional(),
  hostKey: z.string().max(300).optional(),
  assetKey: z.string().max(300).optional(),
  feVendorKey: z.string().max(100).optional(),
  automaticQuoteEnabled: z.boolean().optional().default(false),
  accountManagerEnabled: z.boolean().optional().default(false),
  hasDAS: z.boolean().optional().default(false),
  broker: z.string().nullable().optional(),
  iban: z.string().max(50).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  displayName: z.string().max(200).optional(),
  mode: z.enum(["rent", "sell"]).optional(),
  city: z.string().max(200).optional(),
  payoff: z.string().max(300).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  projectUrl: z.string().max(500).optional(),
  customDomain: z.string().max(300).optional(),
  defaultLang: z.string().max(10).optional(),
  hostKey: z.string().max(300).optional(),
  assetKey: z.string().max(300).optional(),
  feVendorKey: z.string().max(100).optional(),
  automaticQuoteEnabled: z.boolean().optional(),
  accountManagerEnabled: z.boolean().optional(),
  hasDAS: z.boolean().optional(),
  broker: z.string().nullable().optional(),
  iban: z.string().max(50).optional(),
});

export interface ProjectRow {
  id: string;
  name: string;
  displayName: string;
  mode: "rent" | "sell";
}

/** Crea un nuovo progetto in tz_projects (admin). Scrittura sul main DB, unificato con project DB in lettura. */
export const createProject = async (rawInput: unknown): Promise<{ project: ProjectRow }> => {
  const input = CreateProjectSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_TZ_PROJECTS);

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const displayName = input.displayName?.trim() || `${input.name.trim()} (${input.mode === "rent" ? "Rent" : "Sell"})`;
  const code = input.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 16) || "proj";
  const feVendorKey = `${code}-${suffix.slice(0, 6)}`;

  const resolvedHostKey = input.hostKey?.trim() || `${code}-${input.mode}`;
  const resolvedAssetKey = input.assetKey?.trim() || `${code}-${input.mode}`;
  const resolvedFeVendorKey = input.feVendorKey?.trim() || feVendorKey;

  const doc: Record<string, unknown> = {
    name: input.name.trim(),
    displayName,
    ...(input.workspace_id && { workspace_id: input.workspace_id.trim() }),
    code: resolvedFeVendorKey,
    hostKey: resolvedHostKey,
    assetKey: resolvedAssetKey,
    feVendorKey: resolvedFeVendorKey,
    mode: input.mode,
    ...(input.city && { city: input.city }),
    ...(input.payoff && { payoff: input.payoff }),
    ...(input.contactEmail && { contactEmail: input.contactEmail }),
    ...(input.contactPhone && { contactPhone: input.contactPhone }),
    ...(input.projectUrl && { projectUrl: input.projectUrl }),
    ...(input.customDomain && { customDomain: input.customDomain }),
    defaultLang: input.defaultLang || "it",
    automaticQuoteEnabled: input.automaticQuoteEnabled ?? false,
    accountManagerEnabled: input.accountManagerEnabled ?? false,
    hasDAS: input.hasDAS ?? false,
    broker: input.broker ?? null,
    ...(input.iban && { iban: input.iban }),
    isCommercialDemo: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const inserted = await coll.insertOne(doc as never);
    return {
      project: {
        id: inserted.insertedId.toHexString(),
        name: String(doc.name ?? input.name),
        displayName: String(doc.displayName ?? displayName),
        mode: input.mode,
      },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Errore creazione progetto";
    throw new HttpError(msg, 400);
  }
};

export const updateProject = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectRow & Record<string, unknown>> => {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = UpdateProjectSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection<Record<string, unknown>>(COLLECTION_TZ_PROJECTS);

  const idFilter = ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId;
  const filter =
    ({ $or: [{ _id: idFilter as never }, { _id: projectId as never }, { legacyProjectId: projectId }] }) as never;

  const updateDoc: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) updateDoc.name = input.name.trim();
  if (input.displayName !== undefined) updateDoc.displayName = input.displayName.trim() || undefined;
  if (input.mode !== undefined) updateDoc.mode = input.mode;
  if (input.city !== undefined) updateDoc.city = input.city;
  if (input.payoff !== undefined) updateDoc.payoff = input.payoff;
  if (input.contactEmail !== undefined) updateDoc.contactEmail = input.contactEmail || undefined;
  if (input.contactPhone !== undefined) updateDoc.contactPhone = input.contactPhone;
  if (input.projectUrl !== undefined) updateDoc.projectUrl = input.projectUrl;
  if (input.customDomain !== undefined) updateDoc.customDomain = input.customDomain;
  if (input.defaultLang !== undefined) updateDoc.defaultLang = input.defaultLang;
  if (input.hostKey !== undefined) updateDoc.hostKey = input.hostKey;
  if (input.assetKey !== undefined) updateDoc.assetKey = input.assetKey;
  if (input.feVendorKey !== undefined) updateDoc.feVendorKey = input.feVendorKey;
  if (input.automaticQuoteEnabled !== undefined) updateDoc.automaticQuoteEnabled = input.automaticQuoteEnabled;
  if (input.accountManagerEnabled !== undefined) updateDoc.accountManagerEnabled = input.accountManagerEnabled;
  if (input.hasDAS !== undefined) updateDoc.hasDAS = input.hasDAS;
  if (input.broker !== undefined) updateDoc.broker = input.broker;
  if (input.iban !== undefined) updateDoc.iban = input.iban;

  const res = await coll.updateOne(filter, { $set: updateDoc });
  if (res.matchedCount === 0) throw new HttpError("Project not found", 404);

  const updated = await coll.findOne(filter);
  if (!updated) throw new HttpError("Project not found", 404);
  return {
    id: String(updated._id ?? projectId),
    name: String(updated.name ?? projectId),
    displayName: String(updated.displayName ?? updated.name ?? projectId),
    mode: updated.mode === "rent" ? "rent" : "sell",
    ...updated,
  };
};
