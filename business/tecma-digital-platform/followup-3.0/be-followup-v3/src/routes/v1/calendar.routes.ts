import { Router } from "express";
import { queryCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../../core/calendar/calendar.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";

export const calendarRoutes = Router();

calendarRoutes.post("/calendar/events/query", handleAsync((req) => queryCalendarEvents(req.body)));
calendarRoutes.post("/calendar/events", handleAsync((req) => createCalendarEvent(req.body)));
calendarRoutes.patch("/calendar/events/:id", handleAsync((req) => {
  const workspaceId =
    typeof req.body?.workspaceId === "string"
      ? req.body.workspaceId.trim()
      : typeof req.query.workspaceId === "string"
        ? req.query.workspaceId.trim()
        : "";
  if (!workspaceId) {
    return Promise.reject(new HttpError("workspaceId required", 400, { code: "WORKSPACE_REQUIRED" }));
  }
  return updateCalendarEvent(req.params.id, req.body, { workspaceId });
}));
calendarRoutes.delete("/calendar/events/:id", handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) {
    return Promise.reject(new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" }));
  }
  return deleteCalendarEvent(req.params.id, { workspaceId });
}));
