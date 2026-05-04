import { describe, expect, it } from 'vitest';

import {
  hasAnyPermission,
  hasPermission,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  TECMA_PLATFORM_ADMIN_ROLE,
} from './index';

describe('workspace role permissions', () => {
  it('maps owner to every known permission', () => {
    expect(ROLE_PERMISSIONS.owner).toEqual(Object.values(PERMISSIONS));
  });

  it('keeps role permissions scoped by capability', () => {
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.USERS_INVITE);
    expect(ROLE_PERMISSIONS.admin).not.toContain(PERMISSIONS.WORKSPACES_ADMIN);
    expect(ROLE_PERMISSIONS.collaborator).toEqual([
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.PROJECTS_WRITE,
      PERMISSIONS.SESSION_WRITE,
    ]);
    expect(ROLE_PERMISSIONS.viewer).toEqual([
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.WORKSPACES_READ,
    ]);
  });
});

describe('permission helpers', () => {
  it('checks exact and wildcard permissions', () => {
    expect(hasPermission([PERMISSIONS.USERS_READ], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission(['*'], PERMISSIONS.WORKSPACES_ADMIN)).toBe(true);
    expect(hasPermission([PERMISSIONS.PROJECTS_READ], PERMISSIONS.USERS_READ)).toBe(false);
  });

  it('checks any required permission', () => {
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
  it('accetta tecma_admin', () => {
    expect(isTecmaPlatformAdmin('tecma_admin')).toBe(true);
  });

  it('accetta tecma_superadmin (case insensitive)', () => {
    expect(isTecmaPlatformAdmin('tecma_superadmin')).toBe(true);
    expect(isTecmaPlatformAdmin('  Tecma_SuperAdmin  ')).toBe(true);
  });

  it('rifiuta user e stringhe vuote', () => {
    expect(isTecmaPlatformAdmin('user')).toBe(false);
    expect(isTecmaPlatformAdmin('')).toBe(false);
    expect(isTecmaPlatformAdmin(null)).toBe(false);
    expect(isTecmaPlatformAdmin(undefined)).toBe(false);
  });
});

describe('normalizeSystemRole', () => {
  it('normalizza alias platform admin al valore canonico tecma_admin', () => {
    expect(normalizeSystemRole('tecma_admin')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
    expect(normalizeSystemRole(' tecma_superadmin ')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
    expect(normalizeSystemRole('Tecma_Super_Admin')).toBe(TECMA_PLATFORM_ADMIN_ROLE);
  });

  it('legge systemRole camelCase prima di system_role legacy', () => {
    expect(normalizeSystemRole({ systemRole: 'tecma_admin', system_role: 'user' })).toBe(
      TECMA_PLATFORM_ADMIN_ROLE,
    );
    expect(normalizeSystemRole({ system_role: 'tecma_admin' })).toBe(TECMA_PLATFORM_ADMIN_ROLE);
  });

  it('mantiene ruoli non platform e normalizza vuoti a null', () => {
    expect(normalizeSystemRole(' User ')).toBe('user');
    expect(normalizeSystemRole('')).toBeNull();
    expect(normalizeSystemRole(null)).toBeNull();
  });
});
