import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import { dispatchEvent } from "../automations/automation-events.service.js";
import { logger } from "../../observability/logger.js";
import { hasPermission, PERMISSIONS } from "../rbac/permissions.js";
import {
  CalendarEventCreateExtendedSchema,
  CalendarEventUpdateExtendedSchema,
  type CalendarEventRecord,
  CALENDAR_ACTIVITY_TYPES,
  CALENDAR_ACTIVITY_STATUSES,
  CALENDAR_SOURCES,
  type CalendarActivityType,
  type CalendarActivityStatus,
  type CalendarOutcome,
} from "./calendar-domain.js";

export interface CalendarEvent {
  _id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: (typeof CALENDAR_SOURCES)[number];
  clientId?: string;
  /** @deprecated usare apartmentIds */
  apartmentId?: string;
  activityType: CalendarActivityType;
  activityStatus: CalendarActivityStatus;
  outcome?: CalendarOutcome | null;
  assignedUserId?: string;
  apartmentIds?: string[];
  allDay?: boolean;
  notesInternal?: string;
  notesClientVisible?: string;
  additionalInfo?: string;
  /** Persistito; invio email in iterazione successiva */
  notifyClientOnActivityUpdate?: boolean;
  createdByUserId?: string;
  updatedAt?: string;
}

export type CalendarQueryContext = {
  userEmail: string;
  permissions: string[];
};

async function assertWorkspaceMember(workspaceId: string, userIdEmail: string): Promise<void> {
  const uid = userIdEmail.trim().toLowerCase();
  if (!uid) return;
  const db = getDb();
  const u = await db.collection("tz_user_workspaces").findOne({ workspaceId, userId: uid });
  if (!u) throw new HttpError("L'utente assegnato non appartiene a questo workspace", 400);
}

function canAssignToOthers(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSIONS.ALL) || hasPermission(permissions, PERMISSIONS.CALENDAR_ASSIGN_ANY);
}

function canReadAllVendors(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSIONS.ALL) || hasPermission(permissions, PERMISSIONS.CALENDAR_READ_ALL_VENDORS);
}

function docToEvent(doc: CalendarEventRecord): CalendarEvent {
  const _id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "");
  const activityTypeRaw = doc.activityType;
  const activityType =
    typeof activityTypeRaw === "string" && (CALENDAR_ACTIVITY_TYPES as readonly string[]).includes(activityTypeRaw)
      ? (activityTypeRaw as CalendarActivityType)
      : "meeting";
  const activityStatusRaw = doc.activityStatus;
  const activityStatus =
    typeof activityStatusRaw === "string" && (CALENDAR_ACTIVITY_STATUSES as readonly string[]).includes(activityStatusRaw)
      ? (activityStatusRaw as CalendarActivityStatus)
      : "none";
  const sourceRaw = doc.source;
  const source =
    typeof sourceRaw === "string" && (CALENDAR_SOURCES as readonly string[]).includes(sourceRaw)
      ? (sourceRaw as CalendarEvent["source"])
      : "CUSTOM_SERVICE";

  const apartmentIdsRaw = doc.apartmentIds;
  const apartmentIds = Array.isArray(apartmentIdsRaw)
    ? apartmentIdsRaw.map((x) => String(x)).filter(Boolean)
    : undefined;
  const legacyApt = doc.apartmentId != null && String(doc.apartmentId).length > 0 ? String(doc.apartmentId) : undefined;
  const mergedApartmentIds =
    apartmentIds && apartmentIds.length > 0 ? apartmentIds : legacyApt ? [legacyApt] : undefined;

  return {
    _id,
    workspaceId: String(doc.workspaceId ?? ""),
    projectId: String(doc.projectId ?? ""),
    title: String(doc.title ?? ""),
    startsAt: String(doc.startsAt ?? ""),
    endsAt: String(doc.endsAt ?? ""),
    source,
    ...(doc.clientId != null && String(doc.clientId).length > 0 && { clientId: String(doc.clientId) }),
    ...(legacyApt && { apartmentId: legacyApt }),
    activityType,
    activityStatus,
    ...(doc.outcome != null && String(doc.outcome).length > 0 && { outcome: doc.outcome as CalendarOutcome }),
    ...(doc.assignedUserId != null && String(doc.assignedUserId).length > 0 && {
      assignedUserId: String(doc.assignedUserId).toLowerCase(),
    }),
    ...(mergedApartmentIds && mergedApartmentIds.length > 0 && { apartmentIds: mergedApartmentIds }),
    ...(doc.allDay === true && { allDay: true }),
    ...(typeof doc.notesInternal === "string" && doc.notesInternal.length > 0 && { notesInternal: doc.notesInternal }),
    ...(typeof doc.notesClientVisible === "string" &&
      doc.notesClientVisible.length > 0 && { notesClientVisible: doc.notesClientVisible }),
    ...(typeof doc.additionalInfo === "string" && doc.additionalInfo.length > 0 && { additionalInfo: doc.additionalInfo }),
    ...(doc.notifyClientOnActivityUpdate === true && { notifyClientOnActivityUpdate: true }),
    ...(doc.createdByUserId != null &&
      String(doc.createdByUserId).length > 0 && { createdByUserId: String(doc.createdByUserId) }),
    ...(typeof doc.updatedAt === "string" && doc.updatedAt.length > 0 && { updatedAt: doc.updatedAt }),
  };
}

const buildMatch = (q: ListQueryInput, ctx?: CalendarQueryContext): Record<string, unknown> => {
  const conditions: Record<string, unknown>[] = [{ workspaceId: q.workspaceId, projectId: { $in: q.projectIds } }];

  const dateFrom = q.filters?.dateFrom;
  const dateTo = q.filters?.dateTo;
  if (typeof dateFrom === "string" || typeof dateTo === "string") {
    const range: Record<string, unknown> = {};
    if (typeof dateFrom === "string" && dateFrom) range.$gte = dateFrom;
    if (typeof dateTo === "string" && dateTo) range.$lte = dateTo;
    conditions.push({ startsAt: range });
  }

  if (q.searchText && q.searchText.trim()) {
    conditions.push({ $or: [{ title: { $regex: q.searchText.trim(), $options: "i" } }] });
  }

  const clientId = q.filters?.clientId;
  if (typeof clientId === "string" && clientId.trim()) {
    conditions.push({ clientId: clientId.trim() });
  }

  const activityStatus = q.filters?.activityStatus;
  if (typeof activityStatus === "string" && activityStatus && activityStatus !== "all") {
    conditions.push({ activityStatus });
  }

  const activityType = q.filters?.activityType;
  if (typeof activityType === "string" && activityType && activityType !== "all") {
    conditions.push({ activityType });
  }

  const readAll = ctx ? canReadAllVendors(ctx.permissions) : true;
  const assignedUserIdsFilter = q.filters?.assignedUserIds;
  if (readAll && Array.isArray(assignedUserIdsFilter) && assignedUserIdsFilter.length > 0) {
    const normalized = assignedUserIdsFilter.map((x) => String(x).toLowerCase()).filter(Boolean);
    if (normalized.length > 0) conditions.push({ assignedUserId: { $in: normalized } });
  } else if (ctx && !readAll && ctx.userEmail) {
    const me = ctx.userEmail.toLowerCase();
    conditions.push({
      $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }, { assignedUserId: "" }, { assignedUserId: me }],
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const queryPrimaryCalendarEvents = async (
  input: ListQueryInput,
  ctx?: CalendarQueryContext
): Promise<PaginatedResponse<CalendarEvent>> => {
  const db = getDb();
  const collection = db.collection("calendar_events");

  const [raw, total] = await Promise.all([
    collection
      .find(buildMatch(input, ctx))
      .sort({ startsAt: 1 })
      .skip(buildPagination(input.page, input.perPage).skip)
      .limit(buildPagination(input.page, input.perPage).limit)
      .toArray(),
    collection.countDocuments(buildMatch(input, ctx)),
  ]);

  const data = (raw as CalendarEventRecord[]).map(docToEvent);
  return {
    data,
    pagination: {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage),
    },
  };
};

export const queryCalendarEvents = async (
  rawInput: unknown,
  ctx?: CalendarQueryContext
): Promise<PaginatedResponse<CalendarEvent>> => {
  const input = ListQuerySchema.parse(rawInput);
  return queryPrimaryCalendarEvents(input, ctx);
};

export const getCalendarEventById = async (eventId: string): Promise<CalendarEvent | null> => {
  if (!ObjectId.isValid(eventId)) return null;
  const db = getDb();
  const collection = db.collection("calendar_events");
  const doc = await collection.findOne({ _id: new ObjectId(eventId) } as never);
  if (!doc) return null;
  return docToEvent(doc as CalendarEventRecord);
};

export const createCalendarEvent = async (
  rawInput: unknown,
  ctx: CalendarQueryContext
): Promise<{ event: CalendarEvent }> => {
  const input = CalendarEventCreateExtendedSchema.parse(rawInput);
  const me = ctx.userEmail.trim().toLowerCase();
  const assigneeInput = input.assignedUserId?.trim().toLowerCase();
  const assignee = assigneeInput && assigneeInput.length > 0 ? assigneeInput : me;

  if (assignee !== me && !canAssignToOthers(ctx.permissions)) {
    throw new HttpError("Non puoi assegnare l'evento ad un altro utente", 403);
  }
  await assertWorkspaceMember(input.workspaceId, assignee);

  const db = getDb();
  const collection = db.collection("calendar_events");
  const now = new Date().toISOString();
  /** Singolo `apartmentId` legacy viene mappato su `apartmentIds` quando l’array non è inviato. */
  const apartmentIds =
    input.apartmentIds && input.apartmentIds.length > 0
      ? input.apartmentIds
      : input.apartmentId && input.apartmentId.trim()
        ? [input.apartmentId.trim()]
        : undefined;

  const doc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    title: input.title.trim(),
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    source: input.source,
    activityType: input.activityType,
    activityStatus: input.activityStatus,
    assignedUserId: assignee,
    createdByUserId: me,
    updatedAt: now,
  };
  if (input.outcome != null && String(input.outcome).length > 0) doc.outcome = input.outcome;
  if (input.clientId && input.clientId.trim()) doc.clientId = input.clientId.trim();
  if (apartmentIds && apartmentIds.length > 0) doc.apartmentIds = apartmentIds;
  if (input.apartmentId && input.apartmentId.trim() && !apartmentIds?.length) doc.apartmentId = input.apartmentId.trim();
  if (input.allDay === true) doc.allDay = true;
  if (input.notesInternal && input.notesInternal.trim()) doc.notesInternal = input.notesInternal.trim();
  if (input.notesClientVisible && input.notesClientVisible.trim()) doc.notesClientVisible = input.notesClientVisible.trim();
  if (input.additionalInfo && input.additionalInfo.trim()) doc.additionalInfo = input.additionalInfo.trim();
  if (input.notifyClientOnActivityUpdate === true) doc.notifyClientOnActivityUpdate = true;

  const result = await collection.insertOne(doc as never);
  const _id = result.insertedId.toHexString();
  const inserted = await collection.findOne({ _id: result.insertedId } as never);
  const event = docToEvent(inserted as CalendarEventRecord);

  if (event.clientId) {
    dispatchEvent(input.workspaceId, "visit.scheduled", {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      entityType: "calendar_event",
      entityId: _id,
      clientId: event.clientId,
      apartmentId: event.apartmentId ?? event.apartmentIds?.[0],
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: event.title,
    }).catch((err) => logger.error({ err }, "[calendar] dispatch visit.scheduled failed"));
  }
  return { event };
};

export const updateCalendarEvent = async (
  eventId: string,
  rawInput: unknown,
  ctx: CalendarQueryContext
): Promise<{ event: CalendarEvent }> => {
  const input = CalendarEventUpdateExtendedSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection("calendar_events");
  if (!ObjectId.isValid(eventId)) {
    throw new HttpError("Event not found", 404);
  }
  const _id = new ObjectId(eventId);
  const existing = await collection.findOne({ _id } as never);
  if (!existing) {
    throw new HttpError("Event not found", 404);
  }
  const existingDoc = existing as CalendarEventRecord;
  const workspaceId = String(existingDoc.workspaceId ?? "");

  const me = ctx.userEmail.trim().toLowerCase();
  const update: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  const now = new Date().toISOString();
  update.updatedAt = now;

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
  if (input.activityType !== undefined) update.activityType = input.activityType;
  if (input.activityStatus !== undefined) update.activityStatus = input.activityStatus;
  if (input.outcome !== undefined) {
    if (input.outcome === null) unset.outcome = 1;
    else update.outcome = input.outcome;
  }
  if (input.assignedUserId !== undefined) {
    if (input.assignedUserId === null || input.assignedUserId === "") {
      unset.assignedUserId = 1;
    } else {
      const next = input.assignedUserId.trim().toLowerCase();
      if (next !== me && !canAssignToOthers(ctx.permissions)) {
        throw new HttpError("Non puoi riassegnare l'evento ad un altro utente", 403);
      }
      await assertWorkspaceMember(workspaceId, next);
      update.assignedUserId = next;
    }
  }
  if (input.apartmentIds !== undefined) {
    if (input.apartmentIds === null || input.apartmentIds.length === 0) unset.apartmentIds = 1;
    else update.apartmentIds = input.apartmentIds;
  }
  if (input.allDay !== undefined) {
    if (input.allDay === false) unset.allDay = 1;
    else update.allDay = true;
  }
  if (input.notesInternal !== undefined) {
    if (input.notesInternal === null || input.notesInternal === "") unset.notesInternal = 1;
    else update.notesInternal = input.notesInternal.trim();
  }
  if (input.notesClientVisible !== undefined) {
    if (input.notesClientVisible === null || input.notesClientVisible === "") unset.notesClientVisible = 1;
    else update.notesClientVisible = input.notesClientVisible.trim();
  }
  if (input.additionalInfo !== undefined) {
    if (input.additionalInfo === null || input.additionalInfo === "") unset.additionalInfo = 1;
    else update.additionalInfo = input.additionalInfo.trim();
  }
  if (input.notifyClientOnActivityUpdate !== undefined) {
    if (input.notifyClientOnActivityUpdate === false) unset.notifyClientOnActivityUpdate = 1;
    else update.notifyClientOnActivityUpdate = true;
  }

  const hasUnset = Object.keys(unset).length > 0;
  const meaningfulSet = Object.keys(update).filter((k) => k !== "updatedAt");
  if (meaningfulSet.length === 0 && !hasUnset) {
    return { event: docToEvent(existingDoc) };
  }
  const updateOp = hasUnset ? { $set: update, $unset: unset } : { $set: update };
  await collection.updateOne({ _id } as never, updateOp);
  const updated = await collection.findOne({ _id } as never);
  const event = docToEvent(updated as CalendarEventRecord);

  if (event.clientId) {
    dispatchEvent(event.workspaceId, "visit.updated", {
      workspaceId: event.workspaceId,
      projectId: event.projectId,
      entityType: "calendar_event",
      entityId: event._id,
      clientId: event.clientId,
      apartmentId: event.apartmentId ?? event.apartmentIds?.[0],
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
  const collection = db.collection("calendar_events");
  const _id = new ObjectId(eventId);
  const result = await collection.deleteOne({ _id } as never);
  if (result.deletedCount === 0) {
    throw new HttpError("Event not found", 404);
  }
  return { deleted: true };
};
