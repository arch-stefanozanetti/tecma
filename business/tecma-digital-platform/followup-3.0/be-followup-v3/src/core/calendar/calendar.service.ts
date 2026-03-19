import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import { dispatchEvent } from "../automations/automation-events.service.js";
import { logger } from "../../observability/logger.js";

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

export const queryCalendarEvents = async (rawInput: unknown): Promise<PaginatedResponse<CalendarEvent>> => {
  const input = ListQuerySchema.parse(rawInput);
  return queryPrimaryCalendarEvents(input);
};

export const getCalendarEventById = async (eventId: string): Promise<CalendarEvent | null> => {
  if (!ObjectId.isValid(eventId)) return null;
  const db = getDb();
  const collection = db.collection<CalendarEvent & { _id?: ObjectId }>("calendar_events");
  const doc = await collection.findOne({ _id: new ObjectId(eventId) } as never);
  if (!doc) return null;
  return {
    _id: String(doc._id),
    workspaceId: String(doc.workspaceId),
    projectId: String(doc.projectId),
    title: String(doc.title),
    startsAt: String(doc.startsAt),
    endsAt: String(doc.endsAt),
    source: (doc.source ?? "CUSTOM_SERVICE") as CalendarEvent["source"],
    ...(doc.clientId != null && { clientId: String(doc.clientId) }),
    ...(doc.apartmentId != null && { apartmentId: String(doc.apartmentId) }),
  };
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
    }).catch((err) => logger.error({ err }, "[calendar] dispatch visit.scheduled failed"));
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
    throw new HttpError("Event not found", 404);
  }
  const _id = new ObjectId(eventId);
  const existing = await collection.findOne({ _id } as never);
  if (!existing) {
    throw new HttpError("Event not found", 404);
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
    }).catch((err) => logger.error({ err }, "[calendar] dispatch visit.updated failed"));
  }
  return { event };
};

export const deleteCalendarEvent = async (eventId: string): Promise<{ deleted: boolean }> => {
  if (!ObjectId.isValid(eventId)) {
    throw new HttpError("Event not found", 404);
  }
  const db = getDb();
  const collection = db.collection<CalendarEvent & { _id?: ObjectId }>("calendar_events");
  const _id = new ObjectId(eventId);
  const result = await collection.deleteOne({ _id } as never);
  if (result.deletedCount === 0) {
    throw new HttpError("Event not found", 404);
  }
  return { deleted: true };
};
