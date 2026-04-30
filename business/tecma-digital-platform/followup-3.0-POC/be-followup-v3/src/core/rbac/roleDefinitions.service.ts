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
  /** Label per UI (es. "Owner", "Admin"). Opzionale. */
  label?: string;
  updatedAt?: Date;
}

const coll = () => getDb().collection<RoleDefinitionDoc>(COLLECTION);

/** Mappa ruoli legacy a ruoli spec per risoluzione permessi (documenti non ancora migrati). */
function roleKeyToSpec(key: string): string {
  if (key === "vendor" || key === "agent") return "collaborator";
  if (key === "vendor_manager") return "admin";
  return key;
}

/** Piano minimo permessi per ruolo spec (o user). */
function builtinFloorForSpecKey(specKey: string): string[] | typeof PERMISSIONS.ALL {
  const built = BUILTIN_ROLE_PERMISSIONS[specKey];
  if (built === PERMISSIONS.ALL) return PERMISSIONS.ALL;
  if (Array.isArray(built)) return [...built];
  return [...(BUILTIN_ROLE_PERMISSIONS.user as string[])];
}

/**
 * Unisce permessi da DB con il builtin del ruolo: mai sotto il piano minimo (evita 403 dopo enforcement
 * se `tz_roleDefinitions` ha elenchi vecchi o parziali). Permessi extra nel DB restano validi.
 */
function mergeDbPermissionsWithFloor(specKey: string, dbList: string[]): string[] | typeof PERMISSIONS.ALL {
  if (dbList.includes(PERMISSIONS.ALL)) return PERMISSIONS.ALL;
  const floor = builtinFloorForSpecKey(specKey);
  if (floor === PERMISSIONS.ALL) return PERMISSIONS.ALL;
  const set = new Set<string>(floor);
  for (const p of dbList) {
    if (p === PERMISSIONS.ALL) return PERMISSIONS.ALL;
    set.add(p);
  }
  return [...set];
}

/**
 * Permessi per chiave ruolo: DB prima, poi builtin. Ruoli legacy (vendor, vendor_manager, agent) mappati a spec.
 */
export async function getPermissionsForRole(roleKey: string): Promise<string[] | typeof PERMISSIONS.ALL> {
  const raw = (roleKey || "").toLowerCase().trim();
  if (!raw) {
    return BUILTIN_ROLE_PERMISSIONS.user as string[];
  }
  const key = roleKeyToSpec(raw);
  const doc = await coll().findOne({ roleKey: key });
  if (doc?.permissions) {
    if (doc.permissions === PERMISSIONS.ALL || (Array.isArray(doc.permissions) && doc.permissions.includes(PERMISSIONS.ALL))) {
      return PERMISSIONS.ALL;
    }
    return mergeDbPermissionsWithFloor(key, doc.permissions as string[]);
  }
  const built = BUILTIN_ROLE_PERMISSIONS[key];
  if (built) return built;
  return BUILTIN_ROLE_PERMISSIONS.user as string[];
}

/**
 * Upsert definizione ruolo (admin tooling / seed). label opzionale per UI.
 */
export async function upsertRoleDefinition(
  roleKey: string,
  permissions: string[] | typeof PERMISSIONS.ALL,
  label?: string
): Promise<void> {
  const key = roleKey.toLowerCase().trim();
  const doc: OptionalId<RoleDefinitionDoc> = {
    roleKey: key,
    permissions: permissions === PERMISSIONS.ALL ? [PERMISSIONS.ALL] : permissions,
    updatedAt: new Date()
  };
  if (label != null && label.trim() !== "") doc.label = label.trim();
  await coll().updateOne({ roleKey: key }, { $set: doc }, { upsert: true });
}

export async function listRoleDefinitions(): Promise<RoleDefinitionDoc[]> {
  return coll().find({}).toArray();
}

/** Ruoli usabili per membership workspace (ordinati). */
const WORKSPACE_MEMBERSHIP_ORDER: string[] = ["owner", "admin", "collaborator", "viewer"];

function defaultLabel(roleKey: string): string {
  if (!roleKey) return "";
  return roleKey.charAt(0).toUpperCase() + roleKey.slice(1).toLowerCase();
}

/**
 * Lista ruoli per membership workspace (solo owner, admin, collaborator, viewer) con label per UI.
 * Fonte: DB; se un ruolo manca in DB viene restituito con label di fallback (capitalize).
 */
export async function listWorkspaceMembershipRoles(): Promise<{ roleKey: string; label: string }[]> {
  const docs = await coll()
    .find({ roleKey: { $in: WORKSPACE_MEMBERSHIP_ORDER } })
    .toArray();
  const byKey = new Map<string, RoleDefinitionDoc>();
  for (const d of docs) byKey.set(d.roleKey, d);
  return WORKSPACE_MEMBERSHIP_ORDER.map((key) => ({
    roleKey: key,
    label: byKey.get(key)?.label?.trim() || defaultLabel(key)
  }));
}

/** Label di default per ruoli membership (UI). */
const DEFAULT_MEMBERSHIP_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  collaborator: "Collaborator",
  viewer: "Viewer"
};

/** Garantisce che admin esista in DB (idempotente). Seed con label per ruoli membership. */
export async function ensureDefaultRoleDefinitions(): Promise<void> {
  const count = await coll().countDocuments();
  if (count > 0) return;
  for (const [roleKey, perms] of Object.entries(BUILTIN_ROLE_PERMISSIONS)) {
    const label = DEFAULT_MEMBERSHIP_LABELS[roleKey];
    await upsertRoleDefinition(
      roleKey,
      perms === PERMISSIONS.ALL ? PERMISSIONS.ALL : [...perms],
      label
    );
  }
}

/**
 * Allinea i ruoli workspace in `tz_roleDefinitions` al piano minimo builtin (unione con quanto già in DB).
 * Eseguire dopo deploy che estende `BUILTIN_ROLE_PERMISSIONS` o prima di enforcement granulare in produzione.
 */
export async function reconcileWorkspaceRoleDefinitionsWithBuiltin(): Promise<void> {
  for (const key of WORKSPACE_MEMBERSHIP_ORDER) {
    const doc = await coll().findOne({ roleKey: key });
    const label =
      doc?.label?.trim() || DEFAULT_MEMBERSHIP_LABELS[key] || defaultLabel(key);

    if (!doc?.permissions) {
      const floor = builtinFloorForSpecKey(key);
      await upsertRoleDefinition(key, floor === PERMISSIONS.ALL ? PERMISSIONS.ALL : floor, label);
      continue;
    }

    if (doc.permissions === PERMISSIONS.ALL || (Array.isArray(doc.permissions) && doc.permissions.includes(PERMISSIONS.ALL))) {
      await upsertRoleDefinition(key, PERMISSIONS.ALL, label);
      continue;
    }

    const merged = mergeDbPermissionsWithFloor(key, doc.permissions as string[]);
    await upsertRoleDefinition(key, merged === PERMISSIONS.ALL ? PERMISSIONS.ALL : merged, label);
  }
}

export async function resolveEffectivePermissions(
  role: string | null | undefined,
  overrides: string[] | undefined
): Promise<string[]> {
  const rolePerms = await getPermissionsForRole(role || "");
  return mergeRoleAndOverrides(rolePerms, overrides);
}
