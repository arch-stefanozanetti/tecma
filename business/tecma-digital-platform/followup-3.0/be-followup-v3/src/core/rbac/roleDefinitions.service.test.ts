import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findOneMock,
  updateOneMock,
  findToArrayMock,
  countDocumentsMock,
  mergeRoleAndOverridesMock,
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  updateOneMock: vi.fn(),
  findToArrayMock: vi.fn(),
  countDocumentsMock: vi.fn(),
  mergeRoleAndOverridesMock: vi.fn(),
}));

vi.mock("./permissions.js", async () => {
  const actual = await vi.importActual<typeof import("./permissions.js")>("./permissions.js");
  return {
    ...actual,
    mergeRoleAndOverrides: mergeRoleAndOverridesMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne: findOneMock,
      updateOne: updateOneMock,
      find: vi.fn(() => ({ toArray: findToArrayMock })),
      countDocuments: countDocumentsMock,
    }),
  }),
}));

import {
  ensureDefaultRoleDefinitions,
  getPermissionsForRole,
  listRoleDefinitions,
  resolveEffectivePermissions,
  upsertRoleDefinition,
} from "./roleDefinitions.service.js";
import { BUILTIN_ROLE_PERMISSIONS, PERMISSIONS } from "./permissions.js";

describe("rbac/roleDefinitions.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns builtin user permissions for empty role", async () => {
    const perms = await getPermissionsForRole("");
    expect(perms).toEqual(BUILTIN_ROLE_PERMISSIONS.user);
  });

  it("returns wildcard when db role contains ALL", async () => {
    findOneMock.mockResolvedValueOnce({ roleKey: "admin", permissions: [PERMISSIONS.ALL] });
    const perms = await getPermissionsForRole("admin");
    expect(perms).toBe(PERMISSIONS.ALL);
  });

  it("falls back to builtin role when db role missing (legacy agent maps to collaborator)", async () => {
    findOneMock.mockResolvedValueOnce(null);
    const perms = await getPermissionsForRole("agent");
    expect(perms).toEqual(BUILTIN_ROLE_PERMISSIONS.collaborator);
  });

  it("upsertRoleDefinition stores normalized role and permissions", async () => {
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    await upsertRoleDefinition(" Admin ", PERMISSIONS.ALL);
    expect(updateOneMock).toHaveBeenCalledWith(
      { roleKey: "admin" },
      expect.objectContaining({ $set: expect.objectContaining({ roleKey: "admin", permissions: [PERMISSIONS.ALL] }) }),
      { upsert: true }
    );
  });

  it("listRoleDefinitions returns collection rows", async () => {
    findToArrayMock.mockResolvedValueOnce([{ roleKey: "agent", permissions: [PERMISSIONS.APARTMENTS_READ] }]);
    const rows = await listRoleDefinitions();
    expect(rows).toHaveLength(1);
  });

  it("ensureDefaultRoleDefinitions seeds defaults when collection is empty", async () => {
    countDocumentsMock.mockResolvedValueOnce(0);
    updateOneMock.mockResolvedValue({ acknowledged: true });

    await ensureDefaultRoleDefinitions();

    expect(updateOneMock).toHaveBeenCalled();
  });

  it("ensureDefaultRoleDefinitions is noop when records already exist", async () => {
    countDocumentsMock.mockResolvedValueOnce(3);
    await ensureDefaultRoleDefinitions();
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("resolveEffectivePermissions merges role and overrides", async () => {
    findOneMock.mockResolvedValueOnce({ roleKey: "agent", permissions: [PERMISSIONS.APARTMENTS_READ] });
    mergeRoleAndOverridesMock.mockReturnValueOnce([PERMISSIONS.APARTMENTS_READ, PERMISSIONS.USERS_READ]);

    const perms = await resolveEffectivePermissions("agent", [PERMISSIONS.USERS_READ]);

    expect(mergeRoleAndOverridesMock).toHaveBeenCalledWith([PERMISSIONS.APARTMENTS_READ], [PERMISSIONS.USERS_READ]);
    expect(perms).toEqual([PERMISSIONS.APARTMENTS_READ, PERMISSIONS.USERS_READ]);
  });
});
