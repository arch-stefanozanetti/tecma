import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

const SAMPLE_SIZE = 2;

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

  const db = getDb();
  if (workspaceId) {
    const primaryClients = await db
      .collection("tz_clients")
      .find({ workspaceId, projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    clientsPrimary.push(
      ...primaryClients.map((d, i) => anonymizeClientDoc(d as Record<string, unknown>, i))
    );

    const primaryApts = await db
      .collection("tz_apartments")
      .find({ workspaceId, projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    apartmentsPrimary.push(
      ...primaryApts.map((d, i) => anonymizeApartmentDoc(d as Record<string, unknown>, i))
    );
  }

  if (clientsPrimary.length === 0 && clientsLegacy.length === 0) {
    const fallbackClients = await db
      .collection("tz_clients")
      .find({ projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    clientsLegacy.push(
      ...fallbackClients.map((d, i) => anonymizeClientDoc(d as Record<string, unknown>, i))
    );
  }
  if (apartmentsPrimary.length === 0 && apartmentsLegacy.length === 0) {
    const fallbackApts = await db
      .collection("tz_apartments")
      .find({ projectId })
      .limit(SAMPLE_SIZE)
      .toArray();
    apartmentsLegacy.push(
      ...fallbackApts.map((d, i) => anonymizeApartmentDoc(d as Record<string, unknown>, i))
    );
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
