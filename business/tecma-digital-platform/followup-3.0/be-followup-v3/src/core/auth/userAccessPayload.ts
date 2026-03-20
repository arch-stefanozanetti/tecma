import type { ObjectId } from "mongodb";
import { mergeRoleAndOverrides, PERMISSIONS } from "../rbac/permissions.js";
import {
  getPermissionsForRole,
  resolveEffectivePermissions
} from "../rbac/roleDefinitions.service.js";
import { listWorkspaceMembershipsForUser } from "../workspaces/workspace-users.service.js";
import type { AccessTokenPayload } from "./token.service.js";

/** Ordine ruoli per "massimo" (admin > owner > collaborator > viewer) */
const ROLE_ORDER: Record<string, number> = {
  admin: 100,
  owner: 95,
  collaborator: 45,
  viewer: 10,
  user: 0
};

function maxRole(roles: string[]): string | null {
  let best: string | null = null;
  let bestOrder = -1;
  for (const r of roles) {
    const key = (r || "").toLowerCase().trim();
    const order = ROLE_ORDER[key] ?? 0;
    if (order > bestOrder) {
      bestOrder = order;
      best = key || null;
    }
  }
  return best;
}

/** Shape `user` nelle risposte login / SSO / set-password da invito */
export function toAuthSessionUser(payload: AccessTokenPayload) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    isAdmin: payload.isAdmin,
    permissions: payload.permissions,
    projectId: payload.projectId,
    system_role: payload.system_role ?? undefined,
    isTecmaAdmin: payload.isTecmaAdmin ?? false
  };
}

/** Shape minima per costruire il payload access token (tz_users o legacy). */
export type UserDocForAccessPayload = {
  _id: ObjectId;
  email?: string;
  role?: string;
  permissions_override?: string[];
  project_ids?: string[];
  system_role?: string | null;
};

export async function buildAccessPayloadFromUserDoc(
  user: UserDocForAccessPayload,
  emailFallback: string
): Promise<AccessTokenPayload> {
  const email = (user.email || emailFallback).trim().toLowerCase();
  const system_role = user.system_role === "tecma_admin" ? "tecma_admin" : null;
  const isTecmaAdmin = system_role === "tecma_admin";
  const projectId =
    Array.isArray(user.project_ids) && user.project_ids.length > 0 ? String(user.project_ids[0]) : null;

  if (isTecmaAdmin) {
    return {
      sub: user._id.toHexString(),
      email,
      role: "admin",
      isAdmin: true,
      permissions: ["*"],
      projectId,
      system_role,
      isTecmaAdmin
    };
  }

  const memberships = await listWorkspaceMembershipsForUser(email);
  let perms: string[];
  let role: string | null;

  if (memberships.length > 0) {
    const allPerms = new Set<string>();
    const roles: string[] = [];
    for (const m of memberships) {
      const rolePerms = await getPermissionsForRole(m.role);
      if (rolePerms === PERMISSIONS.ALL || (Array.isArray(rolePerms) && rolePerms.includes(PERMISSIONS.ALL))) {
        allPerms.add(PERMISSIONS.ALL);
      } else if (Array.isArray(rolePerms)) {
        for (const p of rolePerms) allPerms.add(p);
      }
      roles.push(m.role);
    }
    if (allPerms.has(PERMISSIONS.ALL)) {
      perms = [PERMISSIONS.ALL];
    } else {
      perms = mergeRoleAndOverrides([...allPerms], user.permissions_override);
    }
    role = maxRole(roles);
  } else {
    const legacyRole = (user.role || "").toLowerCase() || null;
    perms = await resolveEffectivePermissions(legacyRole, user.permissions_override);
    role = legacyRole;
  }

  const isAdmin = perms.includes(PERMISSIONS.ALL);
  return {
    sub: user._id.toHexString(),
    email,
    role,
    isAdmin,
    permissions: perms,
    projectId,
    system_role,
    isTecmaAdmin
  };
}

export const USER_COLLECTION_CANDIDATES = [
  "tz_users",
  "users",
  "Users",
  "user",
  "User",
  "backoffice_users"
] as const;

export function escapeEmailForRegex(email: string): string {
  return email.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
