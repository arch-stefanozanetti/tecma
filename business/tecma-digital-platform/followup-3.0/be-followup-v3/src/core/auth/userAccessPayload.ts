import type { ObjectId } from "mongodb";
import { PERMISSIONS } from "../rbac/permissions.js";
import { resolveEffectivePermissions } from "../rbac/roleDefinitions.service.js";
import type { AccessTokenPayload } from "./token.service.js";

/** Shape `user` nelle risposte login / SSO / set-password da invito */
export function toAuthSessionUser(payload: AccessTokenPayload) {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    isAdmin: payload.isAdmin,
    permissions: payload.permissions,
    projectId: payload.projectId
  };
}

/** Shape minima per costruire il payload access token (tz_users o legacy). */
export type UserDocForAccessPayload = {
  _id: ObjectId;
  email?: string;
  role?: string;
  permissions_override?: string[];
  project_ids?: string[];
};

export async function buildAccessPayloadFromUserDoc(
  user: UserDocForAccessPayload,
  emailFallback: string
): Promise<AccessTokenPayload> {
  const role = (user.role || "").toLowerCase() || null;
  const perms = await resolveEffectivePermissions(role, user.permissions_override);
  const isAdmin = perms.includes(PERMISSIONS.ALL);
  const projectId =
    Array.isArray(user.project_ids) && user.project_ids.length > 0 ? String(user.project_ids[0]) : null;
  const email = (user.email || emailFallback).trim().toLowerCase();
  return {
    sub: user._id.toHexString(),
    email,
    role,
    isAdmin,
    permissions: perms,
    projectId
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
