import type { OptionalId } from "mongodb";
import { getDb } from "../../config/db.js";
import {
  BUILTIN_ROLE_PERMISSIONS,
  mergeRoleAndOverrides,
  PERMISSIONS
} from "./permissions.js";

const COLLECTION = "tz_roleDefinitions";

export interface RoleDefinitionDoc {
  _id?: import("mongodb").ObjectId;
  roleKey: string;
  permissions: string[] | typeof PERMISSIONS.ALL;
  updatedAt?: Date;
}

const coll = () => getDb().collection<RoleDefinitionDoc>(COLLECTION);

/**
 * Permessi per chiave ruolo: DB prima, poi builtin.
 */
export async function getPermissionsForRole(roleKey: string): Promise<string[] | typeof PERMISSIONS.ALL> {
  const key = (roleKey || "").toLowerCase().trim();
  if (!key) {
    return BUILTIN_ROLE_PERMISSIONS.user as string[];
  }
  const doc = await coll().findOne({ roleKey: key });
  if (doc?.permissions) {
    if (doc.permissions === PERMISSIONS.ALL || (Array.isArray(doc.permissions) && doc.permissions.includes(PERMISSIONS.ALL))) {
      return PERMISSIONS.ALL;
    }
    return doc.permissions as string[];
  }
  const built = BUILTIN_ROLE_PERMISSIONS[key];
  if (built) return built;
  return BUILTIN_ROLE_PERMISSIONS.user as string[];
}

/**
 * Upsert definizione ruolo (admin tooling / seed).
 */
export async function upsertRoleDefinition(roleKey: string, permissions: string[] | typeof PERMISSIONS.ALL): Promise<void> {
  const key = roleKey.toLowerCase().trim();
  const doc: OptionalId<RoleDefinitionDoc> = {
    roleKey: key,
    permissions: permissions === PERMISSIONS.ALL ? [PERMISSIONS.ALL] : permissions,
    updatedAt: new Date()
  };
  await coll().updateOne({ roleKey: key }, { $set: doc }, { upsert: true });
}

export async function listRoleDefinitions(): Promise<RoleDefinitionDoc[]> {
  return coll().find({}).toArray();
}

/** Garantisce che admin esista in DB (idempotente) */
export async function ensureDefaultRoleDefinitions(): Promise<void> {
  const count = await coll().countDocuments();
  if (count > 0) return;
  for (const [roleKey, perms] of Object.entries(BUILTIN_ROLE_PERMISSIONS)) {
    await upsertRoleDefinition(
      roleKey,
      perms === PERMISSIONS.ALL ? PERMISSIONS.ALL : [...perms]
    );
  }
}

export async function resolveEffectivePermissions(
  role: string | null | undefined,
  overrides: string[] | undefined
): Promise<string[]> {
  const rolePerms = await getPermissionsForRole(role || "");
  return mergeRoleAndOverrides(rolePerms, overrides);
}
