import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { writeAuditLog } from "../../core/audit/audit.service.js";
import {
  inviteUser,
  findUserById,
  updateUserById,
  deleteUserById,
} from "../../core/users/users-mutations.service.js";
import { requirePermission, requireAnyPermission } from "../permissionMiddleware.js";
import { listUsersWithVisibility } from "../../core/users/users-admin.service.js";

export const usersAdminRoutes = Router();

usersAdminRoutes.get("/users", requirePermission(PERMISSIONS.USERS_READ), handleAsync(() => listUsersWithVisibility()));

usersAdminRoutes.post(
  "/users",
  requireAnyPermission(PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_CREATE),
  handleAsync(async (req) => {
    const body = z
      .object({
        email: z.string().email(),
        role: z.string().min(1),
        projectId: z.string().min(1),
        projectName: z.string().min(1).optional(),
        appPublicUrl: z.string().url().optional(),
      })
      .parse(req.body);

    const { resolveInviteAppBaseUrl } = await import("../../utils/inviteLinkBaseUrl.js");
    const appPublicBaseUrl = resolveInviteAppBaseUrl(req, body.appPublicUrl ?? null);
    const result = await inviteUser({
      email: body.email,
      roleLabel: body.role,
      projectId: body.projectId,
      projectName: body.projectName ?? body.projectId,
      appPublicBaseUrl,
    });

    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.invite",
      entityType: "user",
      entityId: result.userId,
      changes: { after: { email: body.email, role: body.role, projectId: body.projectId } },
      projectId: req.user!.projectId ?? body.projectId,
    });

    return result;
  })
);

usersAdminRoutes.patch(
  "/users/:id",
  requirePermission(PERMISSIONS.USERS_UPDATE),
  handleAsync(async (req) => {
    const id = req.params.id;
    const before = await findUserById(id);
    if (!before) throw new HttpError("Utente non trovato", 404);

    const body = z
      .object({
        role: z.string().optional(),
        status: z.enum(["invited", "active", "disabled"]).optional(),
        permissions_override: z.array(z.string()).optional(),
        isDisabled: z.boolean().optional(),
      })
      .parse(req.body);

    const after = await updateUserById(id, body);
    const safe = (u: typeof before) => ({
      email: u.email,
      role: u.role,
      status: u.status,
      permissions_override: u.permissions_override,
      isDisabled: u.isDisabled,
    });

    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.update",
      entityType: "user",
      entityId: id,
      changes: { before: safe(before), after: after ? safe(after) : null },
      projectId: req.user!.projectId,
    });

    return { ok: true, user: after };
  })
);

usersAdminRoutes.delete(
  "/users/:id",
  requirePermission(PERMISSIONS.USERS_DELETE),
  handleAsync(async (req) => {
    const id = req.params.id;
    const before = await findUserById(id);
    if (!before) throw new HttpError("Utente non trovato", 404);

    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.delete",
      entityType: "user",
      entityId: id,
      changes: { before: { email: before.email, role: before.role } },
      projectId: req.user!.projectId,
    });

    const ok = await deleteUserById(id);
    if (!ok) throw new HttpError("Eliminazione non riuscita", 500);
    return { ok: true };
  })
);
