/**
 * Catalogo permessi RBAC per Followup 3.0.
 *
 * I permessi seguono la convenzione `<modulo>.<azione>` (kebab dot lowercase).
 * Il valore `*` e una wildcard riservata ai platform admin Tecma.
 */

export const PERMISSIONS = {
  // Users
  USERS_READ: 'users.read',
  USERS_WRITE: 'users.write',
  USERS_INVITE: 'users.invite',
  USERS_MANAGE: 'users.manage',

  // Workspaces
  WORKSPACES_READ: 'workspaces.read',
  WORKSPACES_WRITE: 'workspaces.write',
  WORKSPACES_ADMIN: 'workspaces.admin',
  WORKSPACES_MANAGE: 'workspaces.manage',

  // Projects
  PROJECTS_READ: 'projects.read',
  PROJECTS_WRITE: 'projects.write',
  PROJECTS_ADMIN: 'projects.admin',
  PROJECTS_MANAGE: 'projects.manage',

  // Clients (lead/customer)
  CLIENTS_READ: 'clients.read',
  CLIENTS_WRITE: 'clients.write',
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_UPDATE: 'clients.update',
  CLIENTS_EXPORT: 'clients.export',
  CLIENTS_DELETE: 'clients.delete',

  // Apartments / inventory
  APARTMENTS_READ: 'apartments.read',
  APARTMENTS_WRITE: 'apartments.write',
  APARTMENTS_CREATE: 'apartments.create',
  APARTMENTS_UPDATE: 'apartments.update',
  APARTMENTS_EXPORT: 'apartments.export',
  APARTMENTS_DELETE: 'apartments.delete',

  // Requests / deals (CRM trattative)
  REQUESTS_READ: 'requests.read',
  REQUESTS_WRITE: 'requests.write',
  REQUESTS_CREATE: 'requests.create',
  REQUESTS_UPDATE: 'requests.update',
  REQUESTS_EXPORT: 'requests.export',
  REQUESTS_DELETE: 'requests.delete',

  // Quotes / offers
  QUOTES_READ: 'quotes.read',
  QUOTES_WRITE: 'quotes.write',
  QUOTES_MANAGE: 'quotes.manage',

  // Calendar / appointments
  CALENDAR_READ: 'calendar.read',
  CALENDAR_WRITE: 'calendar.write',
  CALENDAR_MANAGE: 'calendar.manage',

  // Marketing / analytics
  MARKETING_READ: 'marketing.read',
  MARKETING_WRITE: 'marketing.write',
  MARKETING_CONFIGURE: 'marketing.configure',

  // Settings (project / workspace)
  SETTINGS_READ: 'settings.read',
  SETTINGS_WRITE: 'settings.write',

  // Integrations / connectors
  INTEGRATIONS_READ: 'integrations.read',
  INTEGRATIONS_WRITE: 'integrations.write',
  INTEGRATIONS_CONFIGURE: 'integrations.configure',

  // Automation / workflow
  AUTOMATION_READ: 'automation.read',
  AUTOMATION_CONFIGURE: 'automation.configure',

  // Audit log
  AUDIT_READ: 'audit.read',

  // Session lifecycle
  SESSION_WRITE: 'session.write',

  // Tecma platform wildcard helper (alias di '*')
  ALL: '*',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type WorkspaceRole = 'owner' | 'admin' | 'collaborator' | 'viewer';

const LEGACY_WORKSPACE_ROLE_ALIASES: Record<string, WorkspaceRole> = {
  owner: 'owner',
  admin: 'admin',
  collaborator: 'collaborator',
  viewer: 'viewer',
  vendor_manager: 'admin',
  vendor: 'collaborator',
  agent: 'collaborator',
};

/** Wildcard riservata ai platform admin Tecma. */
export const PERMISSION_WILDCARD = '*' as const;

/** Lista non mutabile di tutti gli id permesso esposti dal catalogo (esclusa la wildcard). */
export const ALL_PERMISSION_IDS: readonly string[] = Object.values(PERMISSIONS).filter(
  (id): id is Exclude<Permission, '*'> => id !== PERMISSION_WILDCARD,
);

/** Etichette i18n-ready dei moduli per UI matrix. */
export const MODULE_LABELS: Record<string, string> = {
  users: 'Utenti',
  workspaces: 'Workspace',
  projects: 'Progetti',
  clients: 'Clienti',
  apartments: 'Immobili',
  requests: 'Trattative',
  quotes: 'Preventivi',
  calendar: 'Agenda',
  marketing: 'Marketing',
  settings: 'Configurazioni',
  integrations: 'Integrazioni',
  automation: 'Automazioni',
  audit: 'Audit log',
  session: 'Sessione',
  tecma: 'Piattaforma Tecma',
};

/** Etichette i18n-ready delle azioni per UI matrix. */
export const ACTION_LABELS: Record<string, string> = {
  read: 'Lettura',
  write: 'Scrittura',
  invite: 'Invito',
  manage: 'Gestione',
  admin: 'Amministrazione',
  configure: 'Configurazione',
  delete: 'Cancellazione',
  export: 'Export',
  create: 'Creazione',
  update: 'Aggiornamento',
};

/** `*.write` legacy implica le azioni granulari POC-equivalenti. */
export const PERMISSION_WRITE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'clients.write': ['clients.create', 'clients.update'],
  'apartments.write': ['apartments.create', 'apartments.update'],
  'requests.write': ['requests.create', 'requests.update'],
  'calendar.write': ['calendar.write'],
  'users.write': ['users.write'],
  'projects.write': ['projects.write'],
  'workspaces.write': ['workspaces.write'],
};

export interface PermissionCatalogEntry {
  id: string;
  module: string;
  action: string;
  label: string;
  actionLabel: string;
}

export interface PermissionCatalogGroup {
  module: string;
  label: string;
  permissions: PermissionCatalogEntry[];
}

export interface PermissionCatalog {
  groups: PermissionCatalogGroup[];
}

/**
 * Costruisce un catalogo strutturato (modulo + azione + label) a partire da `ALL_PERMISSION_IDS`.
 * Le entry sono raggruppate per modulo, ordinate alfabeticamente.
 */
export const buildPermissionCatalog = (
  permissionIds: readonly string[] = ALL_PERMISSION_IDS,
): PermissionCatalog => {
  const byModule = new Map<string, PermissionCatalogEntry[]>();
  for (const id of permissionIds) {
    const dot = id.indexOf('.');
    const module = dot === -1 ? 'other' : id.slice(0, dot);
    const action = dot === -1 ? id : id.slice(dot + 1);
    const moduleLabel = MODULE_LABELS[module] ?? module;
    const actionLabel = ACTION_LABELS[action] ?? action;
    const entry: PermissionCatalogEntry = {
      id,
      module,
      action,
      label: `${moduleLabel} — ${actionLabel}`,
      actionLabel,
    };
    const list = byModule.get(module) ?? [];
    list.push(entry);
    byModule.set(module, list);
  }
  const modules = [...byModule.keys()].sort((a, b) => a.localeCompare(b));
  const groups: PermissionCatalogGroup[] = modules.map((module) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    permissions: (byModule.get(module) ?? []).sort((a, b) => a.id.localeCompare(b.id)),
  }));
  return { groups };
};

/**
 * Mappa permessi ruolo workspace builtin (legacy compatible).
 * `owner` mantiene tutti i permessi non wildcard del catalogo.
 */
export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: Object.values(PERMISSIONS).filter((p) => p !== PERMISSION_WILDCARD) as Permission[],
  admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.WORKSPACES_READ,
    PERMISSIONS.WORKSPACES_WRITE,
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_WRITE,
    PERMISSIONS.PROJECTS_MANAGE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.APARTMENTS_WRITE,
    PERMISSIONS.APARTMENTS_CREATE,
    PERMISSIONS.APARTMENTS_UPDATE,
    PERMISSIONS.APARTMENTS_EXPORT,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.REQUESTS_UPDATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_WRITE,
    PERMISSIONS.QUOTES_MANAGE,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_WRITE,
    PERMISSIONS.MARKETING_READ,
    PERMISSIONS.MARKETING_WRITE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.INTEGRATIONS_READ,
    PERMISSIONS.INTEGRATIONS_WRITE,
    PERMISSIONS.AUTOMATION_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SESSION_WRITE,
  ],
  collaborator: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_WRITE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_WRITE,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.APARTMENTS_CREATE,
    PERMISSIONS.APARTMENTS_UPDATE,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.REQUESTS_UPDATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_WRITE,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_WRITE,
    PERMISSIONS.SESSION_WRITE,
  ],
  viewer: [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.WORKSPACES_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.CALENDAR_READ,
  ],
};

/** Override DB di permessi per ruolo: `tz_roleDefinitions` (chiave -> permessi). */
export type RoleDefinitionMap = Record<string, readonly string[]>;

/**
 * Restituisce i permessi effettivi per un ruolo workspace.
 * 1. Cerca prima nelle override DB (`customDefinitions`) consentendo wildcard `*`.
 * 2. Altrimenti torna ai builtin `ROLE_PERMISSIONS`.
 * 3. Per chiavi sconosciute restituisce `[]` (nessun permesso).
 *
 * La chiave e case-insensitive ed e trim-ed.
 */
export const getPermissionsForRole = (
  roleKey: string,
  customDefinitions?: RoleDefinitionMap,
): readonly string[] => {
  const key = roleKey.trim().toLowerCase();
  if (key === '') return [];
  if (customDefinitions) {
    const custom = customDefinitions[key];
    if (custom) return custom;
  }
  const normalized = LEGACY_WORKSPACE_ROLE_ALIASES[key];
  if (normalized != null) {
    return ROLE_PERMISSIONS[normalized];
  }
  return [];
};

export const normalizeWorkspaceRole = (roleKey?: string | null): WorkspaceRole | null => {
  if (typeof roleKey !== 'string') return null;
  const normalized = LEGACY_WORKSPACE_ROLE_ALIASES[roleKey.trim().toLowerCase()];
  return normalized ?? null;
};

/**
 * Verifica se l'id permesso e valido (catalogo o wildcard).
 */
export const isValidPermissionId = (id: string): boolean =>
  id === PERMISSION_WILDCARD || ALL_PERMISSION_IDS.includes(id);

const permissionSetIncludes = (permissions: readonly string[], required: string): boolean => {
  if (permissions.includes(PERMISSION_WILDCARD) || permissions.includes(required)) return true;
  for (const [writeId, implied] of Object.entries(PERMISSION_WRITE_ALIASES)) {
    if (!permissions.includes(writeId)) continue;
    if (implied.includes(required)) return true;
  }
  return false;
};

export const hasPermission = (permissions: readonly string[], required: Permission): boolean =>
  permissionSetIncludes(permissions, required);

export const hasAnyPermission = (
  permissions: readonly string[],
  required: readonly Permission[],
): boolean => required.some((permission) => hasPermission(permissions, permission));

/** Gate UI/nav: accetta permesso esatto, wildcard o alias `*.write`. */
export const satisfiesPermission = (permissions: readonly string[], required: string): boolean =>
  permissionSetIncludes(permissions, required);

/**
 * Calcola i permessi effettivi di un utente: unione dei permessi del ruolo con
 * gli `permissionsOverride` validati. Wildcard `*` precedente, se presente, rende
 * inutile l'unione.
 */
export const computeEffectivePermissions = (
  rolePermissions: readonly string[],
  permissionsOverride?: readonly string[] | null,
): string[] => {
  const set = new Set<string>(rolePermissions);
  if (permissionsOverride && permissionsOverride.length > 0) {
    for (const id of permissionsOverride) {
      if (isValidPermissionId(id)) set.add(id);
    }
  }
  if (set.has(PERMISSION_WILDCARD)) return [PERMISSION_WILDCARD];
  return [...set].sort((a, b) => a.localeCompare(b));
};

export const TECMA_PLATFORM_ADMIN_ROLE = 'tecma_admin' as const;

/** Ruoli salvati in `tz_users.systemRole` / JWT che equivalgono a "platform admin" Tecma. */
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
 * True se l'utente e amministratore di piattaforma Tecma (lista workspace completa,
 * bypass membership, ecc.). Accetta alias oltre a `tecma_admin` perche in DB
 * legacy / BSS compaiono valori come `tecma_superadmin`.
 */
export const isTecmaPlatformAdmin = (systemRole?: string | null | SystemRoleCarrier): boolean =>
  normalizeSystemRole(systemRole) === TECMA_PLATFORM_ADMIN_ROLE;
