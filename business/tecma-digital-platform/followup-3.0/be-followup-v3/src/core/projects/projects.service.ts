/**
 * Creazione progetti in tz_projects (main DB).
 * I progetti creati da Followup vanno in tz_projects; projectAccess unisce con project DB (read online).
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

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
  const baseId = `followup-${input.mode}-${suffix}`;
  const displayName = input.displayName?.trim() || `${input.name.trim()} (${input.mode === "rent" ? "Rent" : "Sell"})`;
  const code = input.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 16) || "proj";
  const feVendorKey = `${code}-${suffix.slice(0, 6)}`;

  const resolvedHostKey = input.hostKey?.trim() || baseId;
  const resolvedAssetKey = input.assetKey?.trim() || baseId;
  const resolvedFeVendorKey = input.feVendorKey?.trim() || feVendorKey;

  const doc: Record<string, unknown> = {
    _id: baseId,
    id: baseId,
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
    await coll.insertOne(doc as never);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Errore creazione progetto";
    throw new HttpError(msg, 400);
  }

  return {
    project: {
      id: baseId,
      name: String(doc.name ?? input.name),
      displayName: String(doc.displayName ?? displayName),
      mode: input.mode,
    },
  };
};
