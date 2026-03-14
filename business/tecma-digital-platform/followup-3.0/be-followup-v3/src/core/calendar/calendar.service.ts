import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { PaginatedResponse } from "../../types/http.js";
import { dispatchEvent } from "../automations/automation-events.service.js";

const SOURCES = ["FOLLOWUP_SELL", "FOLLOWUP_RENT", "CUSTOM_SERVICE"] as const;
const CalendarEventCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1, "Titolo obbligatorio"),
  startsAt: z.string().min(1, "Data inizio obbligatoria"),
  endsAt: z.string().min(1, "Data fine obbligatoria"),
  source: z.enum(SOURCES).default("CUSTOM_SERVICE"),
  clientId: z.string().optional(),
  apartmentId: z.string().optional(),
});
const CalendarEventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  source: z.enum(SOURCES).optional(),
  clientId: z.string().nullable().optional(),
  apartmentId: z.string().nullable().optional(),
});

export interface CalendarEvent {
  _id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  clientId?: string;
  apartmentId?: string;
  source: "FOLLOWUP_SELL" | "FOLLOWUP_RENT" | "CUSTOM_SERVICE";
}

const buildMatch = (q: ListQueryInput) => {
  const conditions: Record<string, unknown>[] = [{ workspaceId: q.workspaceId, projectId: { $in: q.projectIds } }];

  const dateFrom = q.filters?.dateFrom;
  const dateTo = q.filters?.dateTo;
  if (typeof dateFrom === "string" || typeof dateTo === "string") {
    const range: Record<string, unknown> = {};
    if (typeof dateFrom === "string" && dateFrom) range.$gte = new Date(dateFrom);
    if (typeof dateTo === "string" && dateTo) range.$lte = new Date(dateTo);
    conditions.push({ startsAt: range });
  }

  if (q.searchText && q.searchText.trim()) {
    conditions.push({ $or: [{ title: { $regex: q.searchText.trim(), $options: "i" } }] });
  }

  const clientId = q.filters?.clientId;
  if (typeof clientId === "string" && clientId.trim()) {
    conditions.push({ clientId: clientId.trim() });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

type LegacyCalendarDoc = {
  _id?: ObjectId | string;
  project_id?: ObjectId | string;
  startDate?: Date | string;
  endDate?: Date | string;
  typology?: string;
  activityType?: string;
  info?: string | null;
  note?: string | null;
  comment?: string | null;
  client?: ObjectId | string | null;
};

const parseProjectIdsForLegacy = (projectIds: string[]) => {
  const objectIds: ObjectId[] = [];
  const asStrings = new Set<string>();
  for (const projectId of projectIds) {
    asStrings.add(projectId);
    if (ObjectId.isValid(projectId)) objectIds.push(new ObjectId(projectId));
  }
  return { objectIds, asStrings: [...asStrings] };
};

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const buildLegacyMatch = (q: ListQueryInput) => {
  const { objectIds, asStrings } = parseProjectIdsForLegacy(q.projectIds);
  const projectConditionValues: Array<ObjectId | string> = [...objectIds, ...asStrings];
  const conditions: Record<string, unknown>[] = [{ project_id: { $in: projectConditionValues } }];

  const dateFrom = q.filters?.dateFrom;
  const dateTo = q.filters?.dateTo;
  if (typeof dateFrom === "string" || typeof dateTo === "string") {
    const range: Record<string, unknown> = {};
    if (typeof dateFrom === "string" && dateFrom) range.$gte = new Date(dateFrom);
    if (typeof dateTo === "string" && dateTo) range.$lte = new Date(dateTo);
    conditions.push({ startDate: range });
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    conditions.push({
      $or: [
        { info: { $regex: safe, $options: "i" } },
        { typology: { $regex: safe, $options: "i" } },
        { activityType: { $regex: safe, $options: "i" } }
      ]
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const mapLegacyToCalendarEvent = (doc: LegacyCalendarDoc): CalendarEvent => {
  const projectId = doc.project_id instanceof ObjectId ? doc.project_id.toHexString() : typeof doc.project_id === "string" ? doc.project_id : "";
  const startsAt = toIsoDate(doc.startDate);
  const endsAt = toIsoDate(doc.endDate ?? doc.startDate);
  const compact = (value: string) => {
    const firstLine = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) return "";
    return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
  };
  const infoTitle = typeof doc.info === "string" && doc.info.trim() ? compact(doc.info) : "";
  const activityTitle = typeof doc.activityType === "string" && doc.activityType.trim() ? doc.activityType.trim() : "";
  const typologyTitle = typeof doc.typology === "string" && doc.typology.trim() ? doc.typology.trim() : "";
  const title = infoTitle || activityTitle || typologyTitle || "Attivita calendario";

  return {
    _id: String(doc._id ?? ""),
    workspaceId: "legacy",
    projectId,
    title,
    startsAt,
    endsAt,
    clientId: doc.client ? String(doc.client) : undefined,
    source: "FOLLOWUP_SELL"
  };
};

const queryPrimaryCalendarEvents = async (input: ListQueryInput): Promise<PaginatedResponse<CalendarEvent>> => {
  const db = getDb();
  const collection = db.collection<CalendarEvent>("calendar_events");

  const [data, total] = await Promise.all([
    collection
      .find(buildMatch(input))
      .sort({ startsAt: 1 })
      .skip(buildPagination(input.page, input.perPage).skip)
      .limit(buildPagination(input.page, input.perPage).limit)
      .toArray(),
    collection.countDocuments(buildMatch(input))
  ]);

  return {
    data,
    pagination: {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage)
    }
  };
};

const queryLegacyCalendarEvents = async (input: ListQueryInput): Promise<PaginatedResponse<CalendarEvent>> => {
  const db = getDb();
  const collection = db.collection<LegacyCalendarDoc>("calendars");

  const match = buildLegacyMatch(input);
  const { skip, limit } = buildPagination(input.page, input.perPage);

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        project_id: 1,
        startDate: 1,
        endDate: 1,
        typology: 1,
        activityType: 1,
        info: 1,
        note: 1,
        comment: 1,
        client: 1
      })
      .toArray(),
    collection.countDocuments(match)
  ]);

  return {
    data: rawData.map(mapLegacyToCalendarEvent),
    pagination: {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage)
    }
  };
};

export const queryCalendarEvents = async (rawInput: unknown): Promise<PaginatedResponse<CalendarEvent>> => {
  const input = ListQuerySchema.parse(rawInput);
  const primary = await queryPrimaryCalendarEvents(input);
  if (primary.pagination.total > 0) return primary;
  return queryLegacyCalendarEvents(input);
};

export const createCalendarEvent = async (rawInput: unknown): Promise<{ event: CalendarEvent }> => {
  const input = CalendarEventCreateSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection<CalendarEvent & { _id?: ObjectId }>("calendar_events");
  const doc: Omit<CalendarEvent, "_id"> & { _id?: ObjectId } = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    title: input.title.trim(),
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    source: input.source,
    ...(input.clientId && input.clientId.trim() && { clientId: input.clientId.trim() }),
    ...(input.apartmentId && input.apartmentId.trim() && { apartmentId: input.apartmentId.trim() }),
  };
  const result = await collection.insertOne(doc as never);
  const _id = result.insertedId.toHexString();
  const event: CalendarEvent = {
    _id,
    workspaceId: doc.workspaceId,
    projectId: doc.projectId,
    title: doc.title,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    source: doc.source,
    ...(doc.clientId && { clientId: doc.clientId }),
    ...(doc.apartmentId && { apartmentId: doc.apartmentId }),
  };
  if (event.clientId) {
    dispatchEvent(doc.workspaceId, "visit.scheduled", {
      workspaceId: doc.workspaceId,
      projectId: doc.projectId,
      entityType: "calendar_event",
      entityId: _id,
      clientId: event.clientId,
      apartmentId: event.apartmentId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: event.title,
    }).catch((err) => console.error("[calendar] dispatch visit.scheduled failed:", err));
  }
  return { event };
};

export const updateCalendarEvent = async (
  eventId: string,
  rawInput: unknown
): Promise<{ event: CalendarEvent }> => {
  const input = CalendarEventUpdateSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection<CalendarEvent & { _id?: ObjectId }>("calendar_events");
  if (!ObjectId.isValid(eventId)) {
    const err = new Error("Event not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const _id = new ObjectId(eventId);
  const existing = await collection.findOne({ _id } as never);
  if (!existing) {
    const err = new Error("Event not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const update: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.startsAt !== undefined) update.startsAt = new Date(input.startsAt).toISOString();
  if (input.endsAt !== undefined) update.endsAt = new Date(input.endsAt).toISOString();
  if (input.projectId !== undefined) update.projectId = input.projectId;
  if (input.source !== undefined) update.source = input.source;
  if (input.clientId !== undefined) {
    if (input.clientId === null || input.clientId === "") unset.clientId = 1;
    else update.clientId = input.clientId.trim();
  }
  if (input.apartmentId !== undefined) {
    if (input.apartmentId === null || input.apartmentId === "") unset.apartmentId = 1;
    else update.apartmentId = input.apartmentId.trim();
  }
  if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) return { event: existing as CalendarEvent };
  const updateOp = Object.keys(unset).length > 0 ? { $set: update, $unset: unset } : { $set: update };
  await collection.updateOne({ _id } as never, updateOp);
  const updated = await collection.findOne({ _id } as never);
  const event: CalendarEvent = {
    _id: String(updated!._id),
    workspaceId: String(updated!.workspaceId ?? existing.workspaceId),
    projectId: String(updated!.projectId ?? existing.projectId),
    title: String(updated!.title ?? existing.title),
    startsAt: String(updated!.startsAt ?? existing.startsAt),
    endsAt: String(updated!.endsAt ?? existing.endsAt),
    source: (updated!.source ?? existing.source) as CalendarEvent["source"],
    ...(updated!.clientId != null && { clientId: String(updated!.clientId) }),
    ...(updated!.apartmentId != null && { apartmentId: String(updated!.apartmentId) }),
  };
  if (event.clientId) {
    dispatchEvent(event.workspaceId, "visit.updated", {
      workspaceId: event.workspaceId,
      projectId: event.projectId,
      entityType: "calendar_event",
      entityId: event._id,
      clientId: event.clientId,
      apartmentId: event.apartmentId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: event.title,
    }).catch((err) => console.error("[calendar] dispatch visit.updated failed:", err));
  }
  return { event };
};

export const deleteCalendarEvent = async (eventId: string): Promise<{ deleted: boolean }> => {
  if (!ObjectId.isValid(eventId)) {
    const err = new Error("Event not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const db = getDb();
  const collection = db.collection<CalendarEvent & { _id?: ObjectId }>("calendar_events");
  const _id = new ObjectId(eventId);
  const result = await collection.deleteOne({ _id } as never);
  if (result.deletedCount === 0) {
    const err = new Error("Event not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  return { deleted: true };
};
