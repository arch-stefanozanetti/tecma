import { Router } from "express";
import { queryCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEventById } from "../../core/calendar/calendar.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { canAccess } from "../../core/access/canAccess.js";
import { HttpError } from "../../types/http.js";
import { resolveListQueryFromRequest } from "../helpers/listQueryViewer.js";
import type { AccessTokenPayload } from "../../core/auth/token.service.js";

function calendarCtx(req: { user?: AccessTokenPayload }, viewer?: ReturnType<typeof import("../../core/access/listQueryContext.js").toEntityAssignmentViewer>): {
  userEmail: string;
  permissions: string[];
  viewer?: typeof viewer;
} {
  const email = req.user?.email?.trim().toLowerCase();
  if (!email) throw new HttpError("Unauthorized", 401);
  return { userEmail: email, permissions: req.user?.permissions ?? [], viewer };
}

export const calendarRoutes = Router();

function toAccessUser(req: { user?: { sub?: string; email?: string; system_role?: string | null; isTecmaAdmin?: boolean } }): { sub: string; email: string; system_role?: string | null; isTecmaAdmin?: boolean } | null {
  const u = req.user;
  if (!u) return null;
  return { sub: u.sub ?? "", email: u.email ?? "", system_role: u.system_role ?? undefined, isTecmaAdmin: u.isTecmaAdmin };
}

calendarRoutes.post(
  "/calendar/events/query",
  requirePermission(PERMISSIONS.CALENDAR_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { input, viewer } = await resolveListQueryFromRequest(req.user, req.body);
    return queryCalendarEvents(input, calendarCtx(req, viewer));
  })
);
calendarRoutes.post(
  "/calendar/events",
  requirePermission(PERMISSIONS.CALENDAR_CREATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => createCalendarEvent(req.body, calendarCtx(req)))
);
calendarRoutes.patch(
  "/calendar/events/:id",
  requirePermission(PERMISSIONS.CALENDAR_UPDATE),
  handleAsync(async (req) => {
    const event = await getCalendarEventById(req.params.id);
    if (!event) throw new HttpError("Event not found", 404);
    const workspaceId = event.workspaceId ?? "";
    if (workspaceId) {
      const user = toAccessUser(req);
      if (!user) throw new HttpError("Unauthorized", 401);
      const ok = await canAccess(user, { type: "workspace", workspaceId });
      if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
    }
    return updateCalendarEvent(req.params.id, req.body, calendarCtx(req));
  })
);
calendarRoutes.delete(
  "/calendar/events/:id",
  requirePermission(PERMISSIONS.CALENDAR_DELETE),
  handleAsync(async (req) => {
    const event = await getCalendarEventById(req.params.id);
    if (!event) throw new HttpError("Event not found", 404);
    const workspaceId = event.workspaceId ?? "";
    if (workspaceId) {
      const user = toAccessUser(req);
      if (!user) throw new HttpError("Unauthorized", 401);
      const ok = await canAccess(user, { type: "workspace", workspaceId });
      if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
    }
    return deleteCalendarEvent(req.params.id);
  })
);
