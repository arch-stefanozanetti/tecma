import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_IDS,
  BUILTIN_ROLE_PERMISSIONS,
  PERMISSIONS,
  buildPermissionCatalog,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  mergeRoleAndOverrides,
} from "./permissions.js";

describe("rbac/permissions", () => {
  it("hasPermission grants wildcard and explicit permissions", () => {
    expect(hasPermission([PERMISSIONS.ALL], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission([PERMISSIONS.USERS_READ], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission([PERMISSIONS.USERS_READ], PERMISSIONS.USERS_DELETE)).toBe(false);
  });

  it("hasAnyPermission / hasAllPermissions behave correctly", () => {
    const granted = [PERMISSIONS.USERS_READ, PERMISSIONS.APARTMENTS_READ];
    expect(hasAnyPermission(granted, [PERMISSIONS.USERS_DELETE, PERMISSIONS.APARTMENTS_READ])).toBe(true);
    expect(hasAnyPermission(granted, [PERMISSIONS.USERS_DELETE])).toBe(false);

    expect(hasAllPermissions(granted, [PERMISSIONS.USERS_READ])).toBe(true);
    expect(hasAllPermissions(granted, [PERMISSIONS.USERS_READ, PERMISSIONS.APARTMENTS_READ])).toBe(true);
    expect(hasAllPermissions(granted, [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_DELETE])).toBe(false);
  });

  it("mergeRoleAndOverrides merges uniquely and preserves wildcard", () => {
    expect(mergeRoleAndOverrides(PERMISSIONS.ALL, [PERMISSIONS.USERS_READ])).toEqual([PERMISSIONS.ALL]);

    const merged = mergeRoleAndOverrides([PERMISSIONS.USERS_READ], [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_DELETE]);
    expect(merged.sort()).toEqual([PERMISSIONS.USERS_DELETE, PERMISSIONS.USERS_READ]);
  });

  it("builtin role map keeps admin wildcard and user fallback", () => {
    expect(BUILTIN_ROLE_PERMISSIONS.admin).toBe(PERMISSIONS.ALL);
    expect(BUILTIN_ROLE_PERMISSIONS.user).toContain(PERMISSIONS.APARTMENTS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.CLIENTS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.INTEGRATIONS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.REPORTS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.viewer).toContain(PERMISSIONS.REQUESTS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.viewer).toContain(PERMISSIONS.INTEGRATIONS_READ);
    expect(BUILTIN_ROLE_PERMISSIONS.viewer).not.toContain(PERMISSIONS.CLIENTS_UPDATE);
  });

  it("ALL_PERMISSION_IDS include granular module.action (Fase 0.1 registry)", () => {
    expect(ALL_PERMISSION_IDS).toContain(PERMISSIONS.CLIENTS_READ);
    expect(ALL_PERMISSION_IDS).toContain(PERMISSIONS.REQUESTS_CREATE);
    expect(ALL_PERMISSION_IDS).toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ALL_PERMISSION_IDS).not.toContain(PERMISSIONS.ALL);
  });

  it("buildPermissionCatalog groups by module and lists every permission id once", () => {
    const { groups } = buildPermissionCatalog();
    const flat = groups.flatMap((g) => g.permissions.map((p) => p.id));
    expect(flat.length).toBe(ALL_PERMISSION_IDS.length);
    expect(new Set(flat).size).toBe(flat.length);
    const clients = groups.find((g) => g.module === "clients");
    expect(clients?.permissions.some((p) => p.id === PERMISSIONS.CLIENTS_READ)).toBe(true);
  });
});
