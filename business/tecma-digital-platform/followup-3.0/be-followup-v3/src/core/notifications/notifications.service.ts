/**
 * Notifiche per Inbox (Wave 2). Collection tz_notifications.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { PaginatedResponse } from "../../types/http.js";

const COLLECTION = "tz_notifications";

export const NOTIFICATION_TYPES = [
  "request_action_due",
  "calendar_reminder",
  "assignment",
  "mention",
  "other",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRow {
  _id: string;
  workspaceId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | { section: string; state?: Record<string, unknown> };
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

export interface QueryNotificationsParams {
  read?: boolean;
  page?: number;
  perPage?: number;
}

export interface CreateNotificationInput {
  workspaceId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | { section: string; state?: Record<string, unknown> };
  entityType?: string;
  entityId?: string;
}

export const queryNotifications = async (
  workspaceId: string,
  params: QueryNotificationsParams = {}
): Promise<PaginatedResponse<NotificationRow>> => {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(200, Math.max(1, params.perPage ?? 25));
  const skip = (page - 1) * perPage;

  const db = getDb();
  const coll = db.collection(COLLECTION);

  const filter: Record<string, unknown> = { workspaceId };
  if (params.read !== undefined) {
    filter.read = params.read;
  }

  const [data, total] = await Promise.all([
    coll.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).toArray(),
    coll.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const notifications: NotificationRow[] = data.map((doc) => ({
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: doc.workspaceId ?? "",
    userId: doc.userId,
    type: NOTIFICATION_TYPES.includes(doc.type as NotificationType) ? doc.type : "other",
    title: doc.title ?? "",
    body: doc.body,
    link: doc.link,
    read: Boolean(doc.read),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    entityType: doc.entityType,
    entityId: doc.entityId,
  }));

  return {
    data: notifications,
    pagination: { page, perPage, total, totalPages },
  };
};

export const markRead = async (id: string): Promise<NotificationRow | null> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    throw new HttpError("Invalid notification id", 400);
  }
  const result = await coll.findOneAndUpdate(
    { _id: oid },
    { $set: { read: true } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  const doc = result as Record<string, unknown>;
  return {
    _id: (doc._id as ObjectId).toHexString(),
    workspaceId: String(doc.workspaceId ?? ""),
    userId: doc.userId as string | undefined,
    type: (NOTIFICATION_TYPES as readonly string[]).includes(doc.type as string) ? (doc.type as NotificationType) : "other",
    title: String(doc.title ?? ""),
    body: doc.body as string | undefined,
    link: doc.link as NotificationRow["link"],
    read: true,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    entityType: doc.entityType as string | undefined,
    entityId: doc.entityId as string | undefined,
  };
};

export const markAllRead = async (workspaceId: string): Promise<number> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const result = await coll.updateMany({ workspaceId, read: false }, { $set: { read: true } });
  return result.modifiedCount;
};

export const createNotification = async (
  input: CreateNotificationInput
): Promise<NotificationRow> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date();
  const doc = {
    workspaceId: input.workspaceId,
    ...(input.userId && { userId: input.userId }),
    type: NOTIFICATION_TYPES.includes(input.type) ? input.type : "other",
    title: input.title,
    ...(input.body != null && { body: input.body }),
    ...(input.link != null && { link: input.link }),
    read: false,
    createdAt: now,
    ...(input.entityType && { entityType: input.entityType }),
    ...(input.entityId && { entityId: input.entityId }),
  };
  const insertResult = await coll.insertOne(doc);
  const _id = insertResult.insertedId.toHexString();
  return {
    _id,
    workspaceId: doc.workspaceId,
    userId: input.userId,
    type: doc.type as NotificationType,
    title: doc.title,
    body: input.body,
    link: input.link,
    read: false,
    createdAt: now.toISOString(),
    entityType: input.entityType,
    entityId: input.entityId,
  };
};
