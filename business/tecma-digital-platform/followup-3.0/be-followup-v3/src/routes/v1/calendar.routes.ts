import { Router } from "express";
import { queryCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../../core/calendar/calendar.service.js";
import { handleAsync } from "../asyncHandler.js";

export const calendarRoutes = Router();

calendarRoutes.post("/calendar/events/query", handleAsync((req) => queryCalendarEvents(req.body)));
calendarRoutes.post("/calendar/events", handleAsync((req) => createCalendarEvent(req.body)));
calendarRoutes.patch("/calendar/events/:id", handleAsync((req) => updateCalendarEvent(req.params.id, req.body)));
calendarRoutes.delete("/calendar/events/:id", handleAsync((req) => deleteCalendarEvent(req.params.id)));
