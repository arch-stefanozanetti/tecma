/** Registry permessi — i check nel codice usano queste stringhe, non ruoli. */
export const PERMISSIONS = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_INVITE: "users.invite",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  APARTMENTS_READ: "apartments.read",
  APARTMENTS_UPDATE: "apartments.update",
  DEALS_CREATE: "deals.create",
  DEALS_CLOSE: "deals.close",
  /** Wildcard: tutti i permessi */
  ALL: "*"
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Fallback se `tz_roleDefinitions` non ha il ruolo */
export const BUILTIN_ROLE_PERMISSIONS: Record<string, string[] | typeof PERMISSIONS.ALL> = {
  admin: PERMISSIONS.ALL,
  vendor: [PERMISSIONS.APARTMENTS_READ, PERMISSIONS.DEALS_CLOSE],
  agent: [PERMISSIONS.APARTMENTS_READ],
  /** Utente senza ruolo noto: solo lettura base */
  user: [PERMISSIONS.APARTMENTS_READ]
};

/**
 * granted: lista permessi JWT; '*' in lista = admin
 */
export function hasPermission(granted: string[], required: PermissionId | string): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return granted.includes(required);
}

export function hasAnyPermission(granted: string[], required: string[]): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return required.some((p) => granted.includes(p));
}

export function hasAllPermissions(granted: string[], required: string[]): boolean {
  if (granted.includes(PERMISSIONS.ALL)) return true;
  return required.every((p) => granted.includes(p));
}

/**
 * Risolve permessi effettivi da ruolo + override utente (aggiunte).
 */
export function mergeRoleAndOverrides(
  rolePerms: string[] | typeof PERMISSIONS.ALL,
  overrides: string[] | undefined
): string[] {
  if (rolePerms === PERMISSIONS.ALL) return [PERMISSIONS.ALL];
  const set = new Set(rolePerms);
  for (const p of overrides ?? []) {
    if (p && typeof p === "string") set.add(p);
  }
  return [...set];
}
