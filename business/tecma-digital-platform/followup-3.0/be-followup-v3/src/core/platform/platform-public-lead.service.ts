import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { createClient } from "../clients/clients.service.js";
import { createRequest } from "../requests/requests.service.js";
import { MarketingAttributionInputSchema } from "../marketing/marketing-attribution.schema.js";

/** Stesso shape di `PlatformAccessContext` (evita import ciclico routes → service). */
export interface PlatformLeadAccess {
  workspaceId: string;
  projectIds: string[];
}

const PublicLeadBodySchema = z.object({
  projectId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  apartmentId: z.string().optional(),
  apartmentCode: z.string().optional(),
  dealType: z.enum(["rent", "sell"]).optional().default("sell"),
  /** Se true (default) e risolviamo un appartamento, creiamo trattativa collegata. */
  createDeal: z.boolean().optional().default(true),
  marketingAttribution: MarketingAttributionInputSchema.optional(),
});

export interface CreatePublicLeadResult {
  clientId: string;
  requestId?: string;
  apartmentId?: string;
}

function allowedProjectIds(access: PlatformLeadAccess, requested: string): string[] {
  if (access.projectIds.length === 0) return [requested];
  return access.projectIds.includes(requested) ? [requested] : [];
}

async function resolveApartmentId(
  workspaceId: string,
  projectId: string,
  apartmentId?: string,
  apartmentCode?: string
): Promise<string | undefined> {
  const db = getDb();
  const coll = db.collection("tz_apartments");
  if (apartmentId && ObjectId.isValid(apartmentId)) {
    const doc = await coll.findOne({
      _id: new ObjectId(apartmentId),
      workspaceId,
      projectId,
    });
    if (doc) return apartmentId;
    throw new HttpError("Appartamento non trovato per questo progetto", 404);
  }
  const code = (apartmentCode || "").trim();
  if (!code) return undefined;
  const doc = await coll.findOne({
    workspaceId,
    projectId,
    code,
  });
  if (!doc?._id) throw new HttpError("Appartamento non trovato per questo codice", 404);
  return String(doc._id);
}

/**
 * Lead da sito Recommerce (Webflow) con API key piattaforma.
 * workspaceId deriva sempre dal contesto della key, mai dal body.
 */
export async function createPublicLeadFromPlatform(
  access: PlatformLeadAccess,
  rawBody: unknown
): Promise<{ data: CreatePublicLeadResult }> {
  const body = PublicLeadBodySchema.parse(rawBody);
  const allowed = allowedProjectIds(access, body.projectId);
  if (allowed.length === 0) {
    throw new HttpError("projectId non consentito per questa API key", 403);
  }

  const workspaceId = access.workspaceId;
  const apartmentResolved = await resolveApartmentId(
    workspaceId,
    body.projectId,
    body.apartmentId,
    body.apartmentCode
  );

  const { client } = await createClient({
    workspaceId,
    projectId: body.projectId,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    status: "lead",
    marketingAttribution: body.marketingAttribution,
  });

  let requestId: string | undefined;
  if (body.createDeal && apartmentResolved) {
    const { request } = await createRequest({
      workspaceId,
      projectId: body.projectId,
      clientId: client._id,
      apartmentId: apartmentResolved,
      type: body.dealType,
      status: "new",
    });
    requestId = request._id;
  }

  return {
    data: {
      clientId: client._id,
      ...(requestId && { requestId }),
      ...(apartmentResolved && { apartmentId: apartmentResolved }),
    },
  };
}
