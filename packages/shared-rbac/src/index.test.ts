import { describe, expect, it } from 'vitest';

import {
  ACTION_LABELS,
  ALL_PERMISSION_IDS,
  buildPermissionCatalog,
  computeEffectivePermissions,
  getPermissionsForRole,
  hasAnyPermission,
  hasPermission,
  satisfiesPermission,
  isTecmaPlatformAdmin,
  isValidPermissionId,
  MODULE_LABELS,
  normalizeWorkspaceRole,
  normalizeSystemRole,
  PERMISSION_WILDCARD,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  TECMA_PLATFORM_ADMIN_ROLE,
} from './index';

describe('PERMISSIONS catalog', () => {
  it('expone i moduli RBAC POC-plus chiave', () => {
    expect(PERMISSIONS.USERS_READ).toBe('users.read');
    expect(PERMISSIONS.PROJECTS_MANAGE).toBe('projects.manage');
    expect(PERMISSIONS.MARKETING_CONFIGURE).toBe('marketing.configure');
    expect(PERMISSIONS.AUTOMATION_CONFIGURE).toBe('automation.configure');
    expect(PERMISSIONS.AUDIT_READ).toBe('audit.read');
    expect(PERMISSIONS.ALL).toBe('*');
  });

  it('ALL_PERMISSION_IDS esclude la wildcard', () => {
    expect(ALL_PERMISSION_IDS).not.toContain(PERMISSION_WILDCARD);
    expect(ALL_PERMISSION_IDS).toContain(PERMISSIONS.USERS_READ);
    expect(new Set(ALL_PERMISSION_IDS).size).toBe(ALL_PERMISSION_IDS.length);
  });

  it('isValidPermissionId accetta wildcard e id catalogo, rifiuta sconosciuti', () => {
    expect(isValidPermissionId(PERMISSION_WILDCARD)).toBe(true);
    expect(isValidPermissionId(PERMISSIONS.USERS_READ)).toBe(true);
    expect(isValidPermissionId('not.a.permission')).toBe(false);
    expect(isValidPermissionId('')).toBe(false);
  });
});

describe('buildPermissionCatalog', () => {
  const catalog = buildPermissionCatalog();

  it('raggruppa per modulo in ordine alfabetico', () => {
    const modules = catalog.groups.map((group) => group.module);
    const sorted = [...modules].sort((a, b) => a.localeCompare(b));
    expect(modules).toEqual(sorted);
  });

  it('produce label leggibili da MODULE_LABELS / ACTION_LABELS', () => {
    const usersGroup = catalog.groups.find((group) => group.module === 'users');
    expect(usersGroup?.label).toBe(MODULE_LABELS.users);
    const usersRead = usersGroup?.permissions.find((p) => p.id === PERMISSIONS.USERS_READ);
    expect(usersRead?.label).toBe(`${MODULE_LABELS.users} — ${ACTION_LABELS.read}`);
    expect(usersRead?.action).toBe('read');
    expect(usersRead?.module).toBe('users');
  });

  it('rimanda all id quando manca label di modulo/azione', () => {
    const ad = buildPermissionCatalog(['custom.exec']);
    const group = ad.groups.find((g) => g.module === 'custom');
    const entry = group?.permissions[0];
    expect(group?.label).toBe('custom');
    expect(entry?.actionLabel).toBe('exec');
    expect(entry?.label).toBe('custom — exec');
  });

  it('mette in modulo "other" id senza punto', () => {
    const cat = buildPermissionCatalog(['legacypermission']);
    const group = cat.groups.find((g) => g.module === 'other');
    expect(group?.permissions[0]?.id).toBe('legacypermission');
  });
});

describe('ROLE_PERMISSIONS builtin', () => {
  it('owner contiene tutti i permessi catalogo (no wildcard)', () => {
    expect(new Set(ROLE_PERMISSIONS.owner)).toEqual(new Set(ALL_PERMISSION_IDS));
    expect(ROLE_PERMISSIONS.owner).not.toContain(PERMISSION_WILDCARD);
  });

  it('admin ha invite ma non WORKSPACES_ADMIN', () => {
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.USERS_INVITE);
    expect(ROLE_PERMISSIONS.admin).not.toContain(PERMISSIONS.WORKSPACES_ADMIN);
  });

  it('collaborator copre CRM operativo con permessi granulari', () => {
    expect(ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.APARTMENTS_CREATE);
    expect(ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.REQUESTS_READ);
    expect(ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.QUOTES_WRITE);
    expect(ROLE_PERMISSIONS.collaborator).not.toContain(PERMISSIONS.QUOTES_MANAGE);
  });

  it('viewer copre solo permessi di lettura', () => {
    for (const perm of ROLE_PERMISSIONS.viewer) {
      expect(perm.endsWith('.read')).toBe(true);
    }
  });
});

describe('getPermissionsForRole', () => {
  it('ritorna i builtin per ruoli noti (case insensitive + trim)', () => {
    expect(getPermissionsForRole(' Owner ')).toEqual(ROLE_PERMISSIONS.owner);
    expect(getPermissionsForRole('VIEWER')).toEqual(ROLE_PERMISSIONS.viewer);
    expect(getPermissionsForRole('vendor_manager')).toEqual(ROLE_PERMISSIONS.admin);
    expect(getPermissionsForRole('agent')).toEqual(ROLE_PERMISSIONS.collaborator);
  });

  it('preferisce override DB rispetto ai builtin', () => {
    const custom = { admin: [PERMISSIONS.USERS_READ] };
    expect(getPermissionsForRole('admin', custom)).toEqual([PERMISSIONS.USERS_READ]);
  });

  it('ritorna [] per ruolo sconosciuto e per stringa vuota', () => {
    expect(getPermissionsForRole('superhero')).toEqual([]);
    expect(getPermissionsForRole('  ')).toEqual([]);
  });

  it('supporta override con wildcard', () => {
    const custom = { tecma: [PERMISSION_WILDCARD] };
    expect(getPermissionsForRole('tecma', custom)).toEqual([PERMISSION_WILDCARD]);
  });
});

describe('normalizeWorkspaceRole', () => {
  it('normalizza alias legacy verso i ruoli canonici', () => {
    expect(normalizeWorkspaceRole('vendor_manager')).toBe('admin');
    expect(normalizeWorkspaceRole('vendor')).toBe('collaborator');
    expect(normalizeWorkspaceRole('agent')).toBe('collaborator');
  });

  it('ritorna null su valori non supportati', () => {
    expect(normalizeWorkspaceRole('superhero')).toBeNull();
    expect(normalizeWorkspaceRole('')).toBeNull();
    expect(normalizeWorkspaceRole(undefined)).toBeNull();
  });
});

describe('computeEffectivePermissions', () => {
  it('unisce ruolo e override, ordinando alfabeticamente e rimuovendo duplicati', () => {
    const result = computeEffectivePermissions(
      [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_WRITE],
      [PERMISSIONS.PROJECTS_WRITE, PERMISSIONS.USERS_READ],
    );
    expect(result).toEqual([
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.PROJECTS_WRITE,
      PERMISSIONS.USERS_READ,
    ]);
  });

  it('scarta override invalidi e accetta wildcard', () => {
    const result = computeEffectivePermissions(
      [PERMISSIONS.PROJECTS_READ],
      ['invalid.permission', PERMISSION_WILDCARD],
    );
    expect(result).toEqual([PERMISSION_WILDCARD]);
  });

  it('gestisce override null/undefined', () => {
    expect(computeEffectivePermissions([PERMISSIONS.USERS_READ], null)).toEqual([
      PERMISSIONS.USERS_READ,
    ]);
    expect(computeEffectivePermissions([PERMISSIONS.USERS_READ])).toEqual([PERMISSIONS.USERS_READ]);
  });
});

describe('permission helpers', () => {
  it('hasPermission gestisce wildcard e match esatto', () => {
    expect(hasPermission([PERMISSIONS.USERS_READ], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission([PERMISSION_WILDCARD], PERMISSIONS.WORKSPACES_ADMIN)).toBe(true);
    expect(hasPermission([PERMISSIONS.PROJECTS_READ], PERMISSIONS.USERS_READ)).toBe(false);
  });

  it('satisfiesPermission espande apartments.write verso create/update', () => {
    expect(satisfiesPermission([PERMISSIONS.APARTMENTS_WRITE], 'apartments.create')).toBe(true);
    expect(satisfiesPermission([PERMISSIONS.APARTMENTS_READ], 'apartments.create')).toBe(false);
  });

  it('hasAnyPermission soddisfa al primo match', () => {
    expect(
      hasAnyPermission(
        [PERMISSIONS.PROJECTS_WRITE],
        [PERMISSIONS.USERS_READ, PERMISSIONS.PROJECTS_WRITE],
      ),
    ).toBe(true);
    expect(hasAnyPermission([PERMISSIONS.PROJECTS_READ], [PERMISSIONS.USERS_WRITE])).toBe(false);
  });
});

describe('isTecmaPlatformAdmin', () => {
  it('accetta tecma_admin e alias', () => {
    expect(isTecmaPlatformAdmin('tecma_admin')).toBe(true);
    expect(isTecmaPlatformAdmin('tecma_superadmin')).toBe(true);
    expect(isTecmaPlatformAdmin('  Tecma_SuperAdmin  ')).toBe(true);
    expect(isTecmaPlatformAdmin({ systemRole: 'tecma_admin' })).toBe(true);
    expect(isTecmaPlatformAdmin({ system_role: 'tecma_super_admin' })).toBe(true);
  });

  it('rifiuta user, vuoti e null', () => {
    expect(isTecmaPlatformAdmin('user')).toBe(false);
    expect(isTecmaPlatformAdmin('')).toBe(false);
    expect(isTecmaPlatformAdmin(null)).toBe(false);
    expect(isTecmaPlatformAdmin(undefined)).toBe(false);
    expect(isTecmaPlatformAdmin({})).toBe(false);
  });
});

describe('normalizeSystemRole', () => {
  it('canonicalizza alias platform admin a tecma_admin', () => {
    expect(normalizeSystemRole('tecma_admin')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
    expect(normalizeSystemRole(' tecma_superadmin ')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
    expect(normalizeSystemRole('Tecma_Super_Admin')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
  });

  it('preferisce systemRole camelCase prima di system_role', () => {
    expect(normalizeSystemRole({ systemRole: 'tecma_admin', system_role: 'user' })).toBe(
      TECMA_PLATFORM_ADMIN_ROLE,
    );
    expect(normalizeSystemRole({ system_role: 'tecma_admin' })).toBe(TECMA_PLATFORM_ADMIN_ROLE);
  });

  it('mantiene ruoli non platform e normalizza vuoti a null', () => {
    expect(normalizeSystemRole(' User ')).toBe('user');
    expect(normalizeSystemRole('')).toBeNull();
    expect(normalizeSystemRole(null)).toBeNull();
    expect(normalizeSystemRole(undefined)).toBeNull();
  });
});
