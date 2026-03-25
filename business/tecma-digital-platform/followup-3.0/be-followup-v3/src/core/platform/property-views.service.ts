/**
 * Eventi first-party "property view" per Big Data (top listing visti).
 * Collezione tz_property_view_events.
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
const COLLECTION = "tz_property_view_events";

const IngestSchema = z.object({
  projectId: z.string().min(1),
  listingId: z.string().max(200).optional(),
  apartmentId: z.string().max(200).optional(),
  path: z.string().max(2000).optional(),
  occurredAt: z.string().optional(),
});

export interface PropertyViewPlatformAccess {
  workspaceId: string;
  projectIds: string[];
}

export async function ingestPropertyViewFromPlatform(
  access: PropertyViewPlatformAccess,
  rawBody: unknown
): Promise<{ ok: true; id: string }> {
  const body = IngestSchema.parse(rawBody ?? {});
  const pid = body.projectId.trim();
  if (access.projectIds.length > 0 && !access.projectIds.includes(pid)) {
    throw new HttpError("projectId non consentito per questa API key", 403);
  }
  const db = getDb();
  const now = new Date().toISOString();
  const occurredAt = body.occurredAt?.trim() ? body.occurredAt.trim() : now;
  const doc = {
    workspaceId: access.workspaceId,
    projectId: pid,
    ...(body.listingId?.trim() ? { listingId: body.listingId.trim() } : {}),
    ...(body.apartmentId?.trim() ? { apartmentId: body.apartmentId.trim() } : {}),
    ...(body.path?.trim() ? { path: body.path.trim() } : {}),
    occurredAt,
    createdAt: now,
  };
  const res = await db.collection(COLLECTION).insertOne(doc as never);
  return { ok: true, id: res.insertedId.toHexString() };
}

export interface TopPropertyViewRow {
  key: string;
  listingId?: string;
  apartmentId?: string;
  viewCount: number;
}

/** Aggregazione per listingId o apartmentId (chi ha più eventi nel periodo). */
export async function aggregateTopPropertyViews(
  workspaceId: string,
  projectId: string,
  dateFrom: string,
  dateTo: string,
  limit = 15
): Promise<TopPropertyViewRow[]> {
  const db = getDb();
  const dateFilter = { $gte: dateFrom, $lte: dateTo };
  const rows = await db
    .collection(COLLECTION)
    .aggregate<{ _id: { lid?: string; aid?: string }; c: number }>([
      {
        $match: {
          workspaceId,
          projectId,
          occurredAt: dateFilter,
        },
      },
      {
        $project: {
          listingId: 1,
          apartmentId: 1,
        },
      },
      {
        $group: {
          _id: {
            lid: "$listingId",
            aid: "$apartmentId",
          },
          c: { $sum: 1 },
        },
      },
      { $sort: { c: -1 } },
      { $limit: limit },
    ])
    .toArray();

  const out: TopPropertyViewRow[] = [];
  for (const r of rows) {
    const lid = r._id?.lid ? String(r._id.lid) : "";
    const aid = r._id?.aid ? String(r._id.aid) : "";
    const key = lid ? `listing:${lid}` : aid ? `apt:${aid}` : "unknown";
    out.push({
      key,
      ...(lid ? { listingId: lid } : {}),
      ...(aid ? { apartmentId: aid } : {}),
      viewCount: r.c,
    });
  }
  return out;
}
