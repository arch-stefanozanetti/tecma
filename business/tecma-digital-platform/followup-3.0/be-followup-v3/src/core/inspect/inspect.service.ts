import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, getDbByName } from "../../config/db.js";
import { ENV } from "../../config/env.js";

const SAMPLE_SIZE = 2;
const LEGACY_DB_ASSET = "asset";

function anonymizeClientDoc(doc: Record<string, unknown>, index: number): Record<string, unknown> {
  const out = { ...doc };
  const redact = () => "[REDACTED]";
  if (out.fullName !== undefined) out.fullName = redact();
  if (out.firstName !== undefined) out.firstName = redact();
  if (out.lastName !== undefined) out.lastName = redact();
  if (out.email !== undefined) out.email = redact();
  if (out.phone !== undefined) out.phone = redact();
  if (out.tel !== undefined) out.tel = redact();
  out._inspectIndex = index + 1;
  return out;
}

function anonymizeApartmentDoc(doc: Record<string, unknown>, index: number): Record<string, unknown> {
  const out = { ...doc };
  out._inspectIndex = index + 1;
  return out;
}

/**
 * Returns a small sample of client and apartment documents for a given project,
 * from primary and/or legacy DBs, with PII anonymized. Used to align model and inspect DB shape.
 * Requires JWT. Query: projectId (required), workspaceId (optional, for primary queries).
 */
export async function getModelSample(raw: unknown): Promise<{
  projectId: string;
  workspaceId?: string;
  clients: { source: "primary" | "legacy"; data: Record<string, unknown>[] };
  apartments: { source: "primary" | "legacy"; data: Record<string, unknown>[] };
}> {
  const schema = z.object({
    projectId: z.string().min(1),
    workspaceId: z.string().min(1).optional(),
  });
  const { projectId, workspaceId } = schema.parse(raw);

  const clientsPrimary: Record<string, unknown>[] = [];
  const clientsLegacy: Record<string, unknown>[] = [];
  const apartmentsPrimary: Record<string, unknown>[] = [];
  const apartmentsLegacy: Record<string, unknown>[] = [];

  if (workspaceId) {
    const primaryDb = getDb();
    const primaryClients = await primaryDb
      .collection("clients")
      .find({ workspaceId, projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    clientsPrimary.push(
      ...primaryClients.map((d, i) => anonymizeClientDoc(d as Record<string, unknown>, i))
    );

    const primaryApts = await primaryDb
      .collection("apartments")
      .find({ workspaceId, projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    apartmentsPrimary.push(
      ...primaryApts.map((d, i) => anonymizeApartmentDoc(d as Record<string, unknown>, i))
    );
  }

  try {
    const legacyClientDb = getDbByName(ENV.MONGO_CLIENT_DB_NAME);
    const projectIdObj = ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;
    const legacyClientMatch =
      projectIdObj != null
        ? { project_id: { $in: [projectId, projectIdObj] } }
        : { project_id: projectId };
    const legacyClients = await legacyClientDb
      .collection("clients")
      .find(legacyClientMatch)
      .limit(SAMPLE_SIZE)
      .toArray();
    clientsLegacy.push(
      ...legacyClients.map((d, i) => anonymizeClientDoc(d as Record<string, unknown>, i))
    );
  } catch {
    // Legacy client DB may not exist or be configured
  }

  try {
    const assetDb = getDbByName(LEGACY_DB_ASSET);
    const projectIdObj = ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;
    const legacyAptMatch =
      projectIdObj != null
        ? { project_id: { $in: [projectId, projectIdObj] } }
        : { project_id: projectId };
    const legacyApts = await assetDb
      .collection("apartments_view")
      .find(legacyAptMatch)
      .limit(SAMPLE_SIZE)
      .toArray();
    apartmentsLegacy.push(
      ...legacyApts.map((d, i) => anonymizeApartmentDoc(d as Record<string, unknown>, i))
    );
  } catch {
    // Legacy asset DB may not exist
  }

  return {
    projectId,
    workspaceId,
    clients: {
      source: clientsPrimary.length > 0 ? "primary" : "legacy",
      data: clientsPrimary.length > 0 ? clientsPrimary : clientsLegacy,
    },
    apartments: {
      source: apartmentsPrimary.length > 0 ? "primary" : "legacy",
      data: apartmentsPrimary.length > 0 ? apartmentsPrimary : apartmentsLegacy,
    },
  };
}
