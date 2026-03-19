import { describe, expect, it } from "vitest";

import {
  BUILTIN_ROLE_PERMISSIONS,
  PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  mergeRoleAndOverrides,
} from "./permissions.js";

describe("rbac/permissions", () => {
  it("hasPermission supports wildcard and exact matches", () => {
    expect(hasPermission([PERMISSIONS.ALL], PERMISSIONS.USERS_READ)).toBe(true);
    expect(hasPermission([PERMISSIONS.APARTMENTS_READ], PERMISSIONS.APARTMENTS_READ)).toBe(true);
    expect(hasPermission([PERMISSIONS.APARTMENTS_READ], PERMISSIONS.USERS_READ)).toBe(false);
  });

  it("hasAnyPermission / hasAllPermissions handle wildcard and sets", () => {
    const granted = [PERMISSIONS.APARTMENTS_READ, PERMISSIONS.DEALS_CLOSE];
    expect(hasAnyPermission([PERMISSIONS.ALL], [PERMISSIONS.USERS_READ])).toBe(true);
    expect(hasAnyPermission(granted, [PERMISSIONS.USERS_READ, PERMISSIONS.DEALS_CLOSE])).toBe(true);
    expect(hasAnyPermission(granted, [PERMISSIONS.USERS_READ])).toBe(false);
    expect(hasAllPermissions(granted, [PERMISSIONS.APARTMENTS_READ])).toBe(true);
    expect(hasAllPermissions(granted, [PERMISSIONS.APARTMENTS_READ, PERMISSIONS.USERS_READ])).toBe(false);
    expect(hasAllPermissions([PERMISSIONS.ALL], [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_CREATE])).toBe(true);
  });

  it("mergeRoleAndOverrides merges role permissions and override set", () => {
    expect(mergeRoleAndOverrides(PERMISSIONS.ALL, [PERMISSIONS.USERS_READ])).toEqual([PERMISSIONS.ALL]);
    expect(mergeRoleAndOverrides([PERMISSIONS.APARTMENTS_READ], undefined)).toEqual([PERMISSIONS.APARTMENTS_READ]);

    const merged = mergeRoleAndOverrides([PERMISSIONS.APARTMENTS_READ], [PERMISSIONS.USERS_READ, PERMISSIONS.APARTMENTS_READ]);
    expect(merged).toContain(PERMISSIONS.APARTMENTS_READ);
    expect(merged).toContain(PERMISSIONS.USERS_READ);
    expect(merged.length).toBe(2);
  });

  it("builtin role permissions expose expected defaults", () => {
    expect(BUILTIN_ROLE_PERMISSIONS.admin).toBe(PERMISSIONS.ALL);
    expect(BUILTIN_ROLE_PERMISSIONS.collaborator).toContain(PERMISSIONS.DEALS_CLOSE);
    expect(BUILTIN_ROLE_PERMISSIONS.user).toContain(PERMISSIONS.APARTMENTS_READ);
  });
});
