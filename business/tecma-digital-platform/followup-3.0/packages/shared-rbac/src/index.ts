export const PERMISSIONS = {
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  USERS_INVITE: 'users.invite',
  WORKSPACES_READ: 'workspaces.read',
  WORKSPACES_WRITE: 'workspaces.write',
  WORKSPACES_ADMIN: 'workspaces.admin',
  PROJECTS_READ: 'projects.read',
  PROJECTS_WRITE: 'projects.write',
  PROJECTS_ADMIN: 'projects.admin',
  SESSION_WRITE: 'session.write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type WorkspaceRole = 'owner' | 'admin' | 'collaborator' | 'viewer';

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.WORKSPACES_READ,
    PERMISSIONS.WORKSPACES_WRITE,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_WRITE,
    PERMISSIONS.SESSION_WRITE,
  ],
  collaborator: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_WRITE, PERMISSIONS.SESSION_WRITE],
  viewer: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.WORKSPACES_READ],
};

export const hasPermission = (permissions: readonly string[], required: Permission): boolean =>
  permissions.includes(required) || permissions.includes('*');

export const hasAnyPermission = (
  permissions: readonly string[],
  required: readonly Permission[],
): boolean => required.some((permission) => hasPermission(permissions, permission));

export const TECMA_PLATFORM_ADMIN_ROLE = 'tecma_admin' as const;

/** Ruoli salvati in `tz_users.systemRole` / JWT che equivalgono a “platform admin” Tecma. */
const PLATFORM_ADMIN_ROLES = new Set([
  TECMA_PLATFORM_ADMIN_ROLE,
  'tecma_superadmin',
  'tecma_super_admin',
]);

export type SystemRoleCarrier = {
  systemRole?: string | null;
  system_role?: string | null;
};

export const normalizeSystemRole = (input?: string | null | SystemRoleCarrier): string | null => {
  const raw =
    input != null && typeof input === 'object' ? (input.systemRole ?? input.system_role) : input;
  if (typeof raw !== 'string') return null;
  const role = raw.trim().toLowerCase();
  if (role === '') return null;
  if (PLATFORM_ADMIN_ROLES.has(role)) return TECMA_PLATFORM_ADMIN_ROLE;
  return role;
};

/**
 * True se l’utente è amministratore di piattaforma Tecma (lista workspace completa, bypass membership, ecc.).
 * Accetta alias oltre a `tecma_admin` perché in DB legacy / BSS compaiono valori come `tecma_superadmin`.
 */
export const isTecmaPlatformAdmin = (systemRole?: string | null | SystemRoleCarrier): boolean =>
  normalizeSystemRole(systemRole) === TECMA_PLATFORM_ADMIN_ROLE;
