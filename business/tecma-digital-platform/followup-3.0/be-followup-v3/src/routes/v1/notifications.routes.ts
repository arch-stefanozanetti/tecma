import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import {
  queryNotifications,
  markRead as markNotificationRead,
  markAllRead as markAllNotificationsRead,
  type NotificationType,
} from "../../core/notifications/notifications.service.js";

export const notificationsRoutes = Router();

notificationsRoutes.get("/notifications", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  const read = req.query.read === "true" ? true : req.query.read === "false" ? false : undefined;
  const type = typeof req.query.type === "string" && req.query.type ? req.query.type : undefined;
  const dateFrom = typeof req.query.dateFrom === "string" && req.query.dateFrom ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" && req.query.dateTo ? req.query.dateTo : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
  return queryNotifications(workspaceId, {
    read,
    type: type as NotificationType | undefined,
    dateFrom,
    dateTo,
    page: Number.isNaN(page) ? 1 : page,
    perPage: Number.isNaN(perPage) ? 25 : Math.min(200, perPage),
  });
}));

notificationsRoutes.patch("/notifications/:id", handleAsync(async (req) => {
  const notification = await markNotificationRead(req.params.id);
  if (!notification) throw new HttpError("Notification not found", 404);
  return { notification };
}));

notificationsRoutes.post("/notifications/read-all", handleAsync(async (req) => {
  const body = z.object({ workspaceId: z.string().min(1) }).parse(req.body);
  const count = await markAllNotificationsRead(body.workspaceId);
  return { count };
}));
