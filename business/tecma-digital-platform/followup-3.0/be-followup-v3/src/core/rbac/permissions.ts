/** Registry permessi — i check nel codice usano queste stringhe, non ruoli. */
export const PERMISSIONS = {
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_INVITE: "users.invite",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_EXPORT: "users.export",
  USERS_ASSIGN: "users.assign",
  USERS_APPROVE: "users.approve",
  USERS_MANAGE_USERS: "users.manageUsers",

  CLIENTS_READ: "clients.read",
  CLIENTS_CREATE: "clients.create",
  CLIENTS_UPDATE: "clients.update",
  CLIENTS_DELETE: "clients.delete",
  CLIENTS_EXPORT: "clients.export",
  CLIENTS_ASSIGN: "clients.assign",
  CLIENTS_APPROVE: "clients.approve",

  APARTMENTS_READ: "apartments.read",
  APARTMENTS_CREATE: "apartments.create",
  APARTMENTS_UPDATE: "apartments.update",
  APARTMENTS_DELETE: "apartments.delete",
  APARTMENTS_EXPORT: "apartments.export",
  APARTMENTS_ASSIGN: "apartments.assign",
  APARTMENTS_APPROVE: "apartments.approve",

  /** Trattative / requests (CRM) */
  REQUESTS_READ: "requests.read",
  REQUESTS_CREATE: "requests.create",
  REQUESTS_UPDATE: "requests.update",
  REQUESTS_DELETE: "requests.delete",
  REQUESTS_EXPORT: "requests.export",
  REQUESTS_ASSIGN: "requests.assign",
  REQUESTS_APPROVE: "requests.approve",

  CALENDAR_READ: "calendar.read",
  CALENDAR_CREATE: "calendar.create",
  CALENDAR_UPDATE: "calendar.update",
  CALENDAR_DELETE: "calendar.delete",
  CALENDAR_EXPORT: "calendar.export",
  CALENDAR_ASSIGN: "calendar.assign",
  CALENDAR_APPROVE: "calendar.approve",

  REPORTS_READ: "reports.read",
  REPORTS_CREATE: "reports.create",
  REPORTS_UPDATE: "reports.update",
  REPORTS_DELETE: "reports.delete",
  REPORTS_EXPORT: "reports.export",
  REPORTS_ASSIGN: "reports.assign",
  REPORTS_APPROVE: "reports.approve",

  INTEGRATIONS_READ: "integrations.read",
  INTEGRATIONS_CREATE: "integrations.create",
  INTEGRATIONS_UPDATE: "integrations.update",
  INTEGRATIONS_DELETE: "integrations.delete",
  INTEGRATIONS_EXPORT: "integrations.export",
  INTEGRATIONS_ASSIGN: "integrations.assign",
  INTEGRATIONS_APPROVE: "integrations.approve",
  INTEGRATIONS_MANAGE: "integrations.manage",

  SETTINGS_READ: "settings.read",
  SETTINGS_CREATE: "settings.create",
  SETTINGS_UPDATE: "settings.update",
  SETTINGS_DELETE: "settings.delete",
  SETTINGS_EXPORT: "settings.export",
  SETTINGS_ASSIGN: "settings.assign",
  SETTINGS_APPROVE: "settings.approve",
  SETTINGS_MANAGE: "settings.manage",

  /** Legacy naming — preferire REQUESTS_* nelle nuove definizioni ruolo */
  DEALS_CREATE: "deals.create",
  DEALS_CLOSE: "deals.close",
  /** Template email transazionali (admin) */
  EMAIL_FLOWS_MANAGE: "email_flows.manage",
  /** Lettura audit di sicurezza (tz_security_audit) */
  COMPLIANCE_AUDIT_READ: "compliance.audit.read",
  /** Wildcard: tutti i permessi */
  ALL: "*"
} as const;

export type PermissionId = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Tutti i permessi validi per override utente (escluso ALL, riservato ad admin). */
export const ALL_PERMISSION_IDS: string[] = Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.ALL);

/**
 * Fallback se `tz_roleDefinitions` non ha il ruolo, e piano minimo quando si uniscono permessi da DB.
 * Collaborator = operatività CRM tipica (allineata alle route prima dell’enforcement granulare).
 */
export const BUILTIN_ROLE_PERMISSIONS: Record<string, string[] | typeof PERMISSIONS.ALL> = {
  admin: PERMISSIONS.ALL,
  owner: PERMISSIONS.ALL,
  collaborator: [
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.APARTMENTS_CREATE,
    PERMISSIONS.APARTMENTS_UPDATE,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.REQUESTS_CREATE,
    PERMISSIONS.REQUESTS_UPDATE,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.CALENDAR_CREATE,
    PERMISSIONS.CALENDAR_UPDATE,
    PERMISSIONS.CALENDAR_DELETE,
    PERMISSIONS.DEALS_CREATE,
    PERMISSIONS.DEALS_CLOSE,
    PERMISSIONS.INTEGRATIONS_READ,
    PERMISSIONS.INTEGRATIONS_CREATE,
    PERMISSIONS.INTEGRATIONS_UPDATE,
    PERMISSIONS.INTEGRATIONS_DELETE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE
  ],
  viewer: [
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.REQUESTS_READ,
    PERMISSIONS.CALENDAR_READ,
    PERMISSIONS.INTEGRATIONS_READ,
    PERMISSIONS.REPORTS_READ
  ],
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

const MODULE_LABELS: Record<string, string> = {
  users: "Utenti",
  clients: "Clienti",
  apartments: "Appartamenti",
  requests: "Trattative",
  deals: "Trattative (legacy)",
  calendar: "Calendario",
  reports: "Report",
  integrations: "Integrazioni",
  settings: "Impostazioni",
  email_flows: "Email transazionali",
  compliance: "Compliance"
};

const ACTION_LABELS: Record<string, string> = {
  read: "Lettura",
  create: "Creazione",
  update: "Modifica",
  delete: "Eliminazione",
  export: "Export",
  assign: "Assegnazione",
  approve: "Approvazione",
  manage: "Gestione",
  manageUsers: "Gestione utenti",
  close: "Chiusura"
};

export type PermissionCatalogGroup = {
  module: string;
  label: string;
  permissions: Array<{ id: string; label: string; action: string }>;
};

export type PermissionCatalog = { groups: PermissionCatalogGroup[] };

/**
 * Struttura per UI admin (override permessi): gruppi per modulo, ordinati.
 */
export function buildPermissionCatalog(): PermissionCatalog {
  const byModule = new Map<string, string[]>();
  for (const id of ALL_PERMISSION_IDS) {
    const dot = id.indexOf(".");
    const mod = dot === -1 ? "other" : id.slice(0, dot);
    const list = byModule.get(mod) ?? [];
    list.push(id);
    byModule.set(mod, list);
  }
  const modules = [...byModule.keys()].sort((a, b) => a.localeCompare(b));
  const groups: PermissionCatalogGroup[] = [];
  for (const module of modules) {
    const ids = (byModule.get(module) ?? []).sort((a, b) => a.localeCompare(b));
    const label = MODULE_LABELS[module] ?? module;
    const permissions = ids.map((id) => {
      const dot = id.indexOf(".");
      const action = dot === -1 ? id : id.slice(dot + 1);
      const actionLabel = ACTION_LABELS[action] ?? action;
      return { id, label: `${label} — ${actionLabel}`, action };
    });
    groups.push({ module, label, permissions });
  }
  return { groups };
}
