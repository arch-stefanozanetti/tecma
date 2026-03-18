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
  });
});
