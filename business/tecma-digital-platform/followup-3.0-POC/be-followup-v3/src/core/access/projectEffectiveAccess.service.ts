import { getPermissionsForRole } from "../rbac/roleDefinitions.service.js";
import { PERMISSIONS, resolveEffectivePermissionsList } from "../rbac/permissions.js";
import { shouldRestrictToAssignments } from "../auth/projectAccess.service.js";
import { listWorkspaceUserProjects } from "../workspaces/workspace-user-projects.service.js";
import { getUserProjectAccess } from "./user-project-access.service.js";
import type { AccessScope } from "../../types/models.js";
import { getDb } from "../../config/db.js";

export type ProjectEffectiveAccess = {
  workspaceId: string;
  userId: string;
  projectId: string;
  role: string;
  accessScope: AccessScope;
  permissions: string[];
  restrictToAssignments: boolean;
  inScope: boolean;
};

async function loadWorkspaceMembership(
  workspaceId: string,
  email: string
): Promise<{ role: string; access_scope: AccessScope } | null> {
  const db = getDb();
  const row = await db.collection("tz_user_workspaces").findOne({
    workspaceId: workspaceId.trim(),
    userId: email.trim().toLowerCase(),
  });
  if (!row) return null;
  return {
    role: String((row as { role?: string }).role ?? "collaborator"),
    access_scope:
      (row as { access_scope?: string }).access_scope === "assigned" ? "assigned" : "all",
  };
}

export async function resolveProjectEffectiveAccess(
  email: string,
  workspaceId: string,
  projectId: string,
  opts?: { isAdmin?: boolean; isTecmaAdmin?: boolean }
): Promise<ProjectEffectiveAccess> {
  const userId = email.trim().toLowerCase();
  const wid = workspaceId.trim();
  const pid = projectId.trim();

  if (opts?.isTecmaAdmin) {
    return {
      workspaceId: wid,
      userId,
      projectId: pid,
      role: "admin",
      accessScope: "all",
      permissions: [PERMISSIONS.ALL],
      restrictToAssignments: false,
      inScope: true,
    };
  }

  const membership = await loadWorkspaceMembership(wid, userId);
  const projectRow = await getUserProjectAccess(wid, userId, pid);
  const { data: assignedProjectIds } = await listWorkspaceUserProjects(wid, userId);

  const role = projectRow?.role ?? membership?.role ?? "collaborator";
  const accessScope = projectRow?.access_scope ?? membership?.access_scope ?? "all";
  const isAdmin = opts?.isAdmin === true || role === "admin" || role === "owner";

  const inScope =
    isAdmin ||
    assignedProjectIds.length === 0 ||
    assignedProjectIds.includes(pid) ||
    !shouldRestrictToAssignments(membership?.role, membership?.access_scope, assignedProjectIds.length > 0);

  const rolePerms = await getPermissionsForRole(role);
  const globalUser = await getDb()
    .collection("tz_users")
    .findOne({ email: { $regex: `^${userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  const globalOverride = Array.isArray(globalUser?.permissions_override)
    ? (globalUser!.permissions_override as string[])
    : [];
  const globalDeny = Array.isArray(globalUser?.permissions_deny)
    ? (globalUser!.permissions_deny as string[])
    : [];
  const projectOverride = projectRow?.permissions_override ?? [];
  const projectDeny = projectRow?.permissions_deny ?? [];

  const permissions = isAdmin
    ? [PERMISSIONS.ALL]
    : resolveEffectivePermissionsList(
        rolePerms,
        [...globalOverride, ...projectOverride],
        [...globalDeny, ...projectDeny]
      );

  const restrictToAssignments =
    !isAdmin &&
    shouldRestrictToAssignments(role, accessScope, assignedProjectIds.length > 0);

  return {
    workspaceId: wid,
    userId,
    projectId: pid,
    role,
    accessScope,
    permissions,
    restrictToAssignments,
    inScope,
  };
}
