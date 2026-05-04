import { describe, expect, it } from 'vitest';

import {
  hasAnyPermission,
  hasPermission,
  isTecmaPlatformAdmin,
  PERMISSIONS,
  ROLE_PERMISSIONS,
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
      hasAnyPermission([PERMISSIONS.PROJECTS_WRITE], [
        PERMISSIONS.USERS_READ,
        PERMISSIONS.PROJECTS_WRITE,
      ]),
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
