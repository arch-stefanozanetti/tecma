import { Router } from "express";
import { listWorkspaceMembershipRoles, getPermissionsForRole } from "../../core/rbac/roleDefinitions.service.js";
import { buildPermissionCatalog, PERMISSIONS } from "../../core/rbac/permissions.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";

export const rbacRoutes = Router();

/** Elenco ruoli workspace (membership) — autenticato, senza permesso extra (stesso comportamento storico). */
rbacRoutes.get(
  "/workspace-roles",
  handleAsync(async () => {
    const data = await listWorkspaceMembershipRoles();
    return { data };
  })
);

/** Catalogo permessi per UI override — richiede lettura utenti. */
rbacRoutes.get(
  "/rbac/permission-catalog",
  requirePermission(PERMISSIONS.USERS_READ),
  handleAsync(async () => {
    const data = buildPermissionCatalog();
    return { data };
  })
);

/** Permessi effettivi (DB + builtin) per un ruolo workspace — anteprima UI wizard utenti. */
rbacRoutes.get(
  "/rbac/roles/:roleKey/effective-permissions",
  requirePermission(PERMISSIONS.USERS_READ),
  handleAsync(async (req) => {
    const roleKey = decodeURIComponent(req.params.roleKey ?? "").trim();
    if (!roleKey) throw new HttpError("roleKey richiesto", 400);
    const resolved = await getPermissionsForRole(roleKey);
    const permissions = resolved === PERMISSIONS.ALL ? [PERMISSIONS.ALL] : resolved;
    return { data: { roleKey, permissions } };
  })
);
