import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { PERMISSIONS, ALL_PERMISSION_IDS, hasPermission } from "../../core/rbac/permissions.js";
import { writeAuditLog } from "../../core/audit/audit.service.js";
import { recordSecurityEvent } from "../../core/compliance/security-audit.service.js";
import { listUsersWithVisibility } from "../../core/users/users-admin.service.js";
import { inviteUser, findUserById, updateUserById, deleteUserById } from "../../core/users/users-mutations.service.js";
import { requirePermission, requireAnyPermission } from "../permissionMiddleware.js";
import { handleAsync } from "../asyncHandler.js";
import { getClientIp } from "../requestMeta.js";

export const usersRoutes = Router();

usersRoutes.get("/users", requirePermission(PERMISSIONS.USERS_READ), handleAsync(() => listUsersWithVisibility()));

usersRoutes.post(
  "/users",
  requireAnyPermission(PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_CREATE),
  handleAsync(async (req) => {
    const body = z
      .object({
        email: z.string().email(),
        projectId: z.string().min(1),
        projectName: z.string().min(1).optional(),
        appPublicUrl: z.string().url().optional(),
        workspaceId: z.string().optional(),
        roleLabel: z.string().optional()
      })
      .parse(req.body);
    const { resolveInviteAppBaseUrl } = await import("../../utils/inviteLinkBaseUrl.js");
    const appPublicBaseUrl = resolveInviteAppBaseUrl(req, body.appPublicUrl ?? null);
    const result = await inviteUser({
      email: body.email,
      projectId: body.projectId,
      projectName: body.projectName ?? body.projectId,
      appPublicBaseUrl,
      roleLabel: body.roleLabel
    });
    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.invite",
      entityType: "user",
      entityId: result.userId,
      changes: { after: { email: body.email, projectId: body.projectId } },
      projectId: req.user!.projectId ?? body.projectId,
      workspaceId: body.workspaceId ?? (req.query.workspaceId as string) ?? (req.body as Record<string, unknown>).workspaceId as string
    });
    const workspaceId =
      body.workspaceId ?? (typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined);
    void recordSecurityEvent({
      action: "users.invited",
      entityType: "user",
      entityId: result.userId,
      userId: req.user!.sub,
      projectId: body.projectId,
      ...(workspaceId && { workspaceId }),
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      ...(body.roleLabel && { metadata: { roleLabel: body.roleLabel } })
    });
    return result;
  })
);

usersRoutes.patch("/users/:id", requirePermission(PERMISSIONS.USERS_UPDATE), handleAsync(async (req) => {
  const id = req.params.id;
  const before = await findUserById(id);
  if (!before) throw new HttpError("Utente non trovato", 404);
  const body = z
    .object({
      role: z.string().optional(),
      status: z.enum(["invited", "active", "disabled"]).optional(),
      permissions_override: z.array(z.string()).optional(),
      isDisabled: z.boolean().optional(),
      workspaceId: z.string().optional()
    })
    .parse(req.body);
  if (body.permissions_override !== undefined) {
    const granted = (req.user?.permissions as string[]) ?? [];
    const isAdmin =
      req.user?.system_role === "admin" ||
      req.user?.system_role === "tecma_admin" ||
      hasPermission(granted, PERMISSIONS.ALL);
    for (const p of body.permissions_override) {
      if (p === PERMISSIONS.ALL || p === "*") {
        if (!isAdmin) throw new HttpError("Solo gli admin possono assegnare il permesso '*'", 403);
      } else if (!ALL_PERMISSION_IDS.includes(p)) {
        throw new HttpError(`Permesso non valido: ${p}`, 400);
      }
    }
  }
  const after = await updateUserById(id, body);
  const safe = (u: typeof before) => ({
    email: u.email,
    role: u.role,
    status: u.status,
    permissions_override: u.permissions_override,
    isDisabled: u.isDisabled
  });
  await writeAuditLog({
    userId: req.user!.sub,
    action: "user.update",
    entityType: "user",
    entityId: id,
    changes: { before: safe(before), after: after ? safe(after) : null },
    projectId: req.user!.projectId,
    workspaceId: body.workspaceId ?? (req.query.workspaceId as string)
  });
  return { ok: true, user: after };
}));

usersRoutes.delete("/users/:id", requirePermission(PERMISSIONS.USERS_DELETE), handleAsync(async (req) => {
  const id = req.params.id;
  const before = await findUserById(id);
  if (!before) throw new HttpError("Utente non trovato", 404);
  const workspaceId = (req.query.workspaceId as string) ?? (req.body as Record<string, unknown>).workspaceId as string;
  await writeAuditLog({
    userId: req.user!.sub,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    changes: {
      before: { email: before.email, role: before.role }
    },
    projectId: req.user!.projectId,
    workspaceId
  });
  const ok = await deleteUserById(id);
  if (!ok) throw new HttpError("Eliminazione non riuscita", 500);
  return { ok: true };
}));
