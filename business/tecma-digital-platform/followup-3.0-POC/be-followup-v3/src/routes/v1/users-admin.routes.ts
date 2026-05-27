import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { ALL_PERMISSION_IDS, PERMISSIONS, hasPermission } from "../../core/rbac/permissions.js";
import { writeAuditLog } from "../../core/audit/audit.service.js";
import { recordSecurityEvent } from "../../core/compliance/security-audit.service.js";
import {
  inviteUser,
  findUserById,
  updateUserById,
  deleteUserById,
} from "../../core/users/users-mutations.service.js";
import { requirePermission, requireAnyPermission } from "../permissionMiddleware.js";
import { listUsersWithVisibility } from "../../core/users/users-admin.service.js";
import { getClientIp } from "../requestMeta.js";

export const usersAdminRoutes = Router();

usersAdminRoutes.get("/users", requirePermission(PERMISSIONS.USERS_READ), handleAsync(() => listUsersWithVisibility()));

const inviteUserBodySchema = z.object({
  email: z.string().email(),
  role: z.string().min(1).optional(),
  roleLabel: z.string().min(1).optional(),
  projectId: z.string().min(1),
  projectName: z.string().min(1).optional(),
  appPublicUrl: z.string().url().optional(),
  workspaceId: z.string().optional(),
});

function resolveInviteRoleLabel(body: z.infer<typeof inviteUserBodySchema>): string {
  return body.roleLabel?.trim() || body.role?.trim() || "Membro";
}

function resolveInviteWorkspaceId(
  req: Parameters<Parameters<typeof handleAsync>[0]>[0],
  body: z.infer<typeof inviteUserBodySchema>
): string | undefined {
  return (
    body.workspaceId ??
    (typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined)
  );
}

usersAdminRoutes.post(
  "/users",
  requireAnyPermission(PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_CREATE),
  handleAsync(async (req) => {
    const body = inviteUserBodySchema.parse(req.body);
    const roleLabel = resolveInviteRoleLabel(body);
    const workspaceId = resolveInviteWorkspaceId(req, body);

    const { resolveInviteAppBaseUrl } = await import("../../utils/inviteLinkBaseUrl.js");
    const appPublicBaseUrl = resolveInviteAppBaseUrl(req, body.appPublicUrl ?? null);
    const result = await inviteUser({
      email: body.email,
      roleLabel,
      projectId: body.projectId,
      projectName: body.projectName ?? body.projectId,
      appPublicBaseUrl,
    });

    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.invite",
      entityType: "user",
      entityId: result.userId,
      changes: { after: { email: body.email, roleLabel, projectId: body.projectId } },
      projectId: req.user!.projectId ?? body.projectId,
      ...(workspaceId && { workspaceId }),
    });

    void recordSecurityEvent({
      action: "users.invited",
      entityType: "user",
      entityId: result.userId,
      userId: req.user!.sub,
      projectId: body.projectId,
      ...(workspaceId && { workspaceId }),
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { roleLabel },
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
        permissionsOverride: z.array(z.string()).optional(),
        isDisabled: z.boolean().optional(),
        system_role: z.union([z.literal("tecma_admin"), z.null()]).optional(),
        workspaceId: z.string().optional(),
      })
      .parse(req.body);

    const permissionsOverride =
      body.permissionsOverride !== undefined ? body.permissionsOverride : body.permissions_override;

    if (permissionsOverride !== undefined) {
      const granted = (req.user?.permissions as string[]) ?? [];
      const isAdmin =
        req.user?.system_role === "admin" ||
        req.user?.system_role === "tecma_admin" ||
        hasPermission(granted, PERMISSIONS.ALL);
      for (const p of permissionsOverride) {
        if (p === PERMISSIONS.ALL || p === "*") {
          if (!isAdmin) throw new HttpError("Solo gli admin possono assegnare il permesso '*'", 403);
        } else if (!ALL_PERMISSION_IDS.includes(p)) {
          throw new HttpError(`Permesso non valido: ${p}`, 400);
        }
      }
    }

    if (body.system_role !== undefined) {
      const isTecmaAdmin = req.user?.system_role === "tecma_admin" || req.user?.isTecmaAdmin === true;
      if (!isTecmaAdmin) {
        throw new HttpError("Solo i Tecma superadmin possono modificare system_role", 403);
      }
    }

    const patch: Parameters<typeof updateUserById>[1] = {
      ...(body.role !== undefined && { role: body.role }),
      ...(body.status !== undefined && { status: body.status }),
      ...(permissionsOverride !== undefined && { permissions_override: permissionsOverride }),
      ...(body.isDisabled !== undefined && { isDisabled: body.isDisabled }),
      ...(body.system_role !== undefined && { system_role: body.system_role }),
    };

    const after = await updateUserById(id, patch);
    const safe = (u: typeof before) => ({
      email: u.email,
      role: u.role,
      system_role: u.system_role ?? null,
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
      workspaceId:
        body.workspaceId ?? (typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined),
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
