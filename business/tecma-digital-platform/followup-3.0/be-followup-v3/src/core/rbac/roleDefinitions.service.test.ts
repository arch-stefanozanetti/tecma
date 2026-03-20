import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const findMock = vi.fn();
  const toArrayMock = vi.fn();
  const countDocumentsMock = vi.fn();

  findMock.mockReturnValue({ toArray: toArrayMock });

  const collectionMock = {
    findOne: findOneMock,
    updateOne: updateOneMock,
    find: findMock,
    countDocuments: countDocumentsMock,
  };

  return {
    findOneMock,
    updateOneMock,
    findMock,
    toArrayMock,
    countDocumentsMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

import { PERMISSIONS } from "./permissions.js";
import {
  ensureDefaultRoleDefinitions,
  getPermissionsForRole,
  listRoleDefinitions,
  reconcileWorkspaceRoleDefinitionsWithBuiltin,
  resolveEffectivePermissions,
  upsertRoleDefinition,
} from "./roleDefinitions.service.js";

describe("roleDefinitions.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPermissionsForRole merges DB with builtin floor for spec roles", async () => {
    mocks.findOneMock.mockResolvedValueOnce({ roleKey: "collaborator", permissions: ["users.read"] });
    const merged = await getPermissionsForRole("Agent");
    expect(merged).toContain("users.read");
    expect(merged).toContain(PERMISSIONS.APARTMENTS_READ);
    expect(merged).toContain(PERMISSIONS.CLIENTS_READ);

    mocks.findOneMock.mockResolvedValueOnce({ roleKey: "admin", permissions: [PERMISSIONS.ALL] });
    await expect(getPermissionsForRole("admin")).resolves.toBe(PERMISSIONS.ALL);
  });

  it("getPermissionsForRole falls back to builtin user for empty/unknown", async () => {
    await expect(getPermissionsForRole("")).resolves.toContain(PERMISSIONS.APARTMENTS_READ);

    mocks.findOneMock.mockResolvedValueOnce(null);
    await expect(getPermissionsForRole("unknown-role")).resolves.toContain(PERMISSIONS.APARTMENTS_READ);
  });

  it("upsert/list/resolve effective permissions", async () => {
    mocks.updateOneMock.mockResolvedValue({ acknowledged: true });
    await upsertRoleDefinition(" Agent ", ["users.read"]);
    expect(mocks.updateOneMock).toHaveBeenCalledWith(
      { roleKey: "agent" },
      expect.objectContaining({ $set: expect.objectContaining({ roleKey: "agent" }) }),
      { upsert: true }
    );

    mocks.toArrayMock.mockResolvedValueOnce([{ roleKey: "agent", permissions: ["users.read"] }]);
    await expect(listRoleDefinitions()).resolves.toEqual([{ roleKey: "agent", permissions: ["users.read"] }]);

    mocks.findOneMock.mockResolvedValueOnce({ roleKey: "agent", permissions: ["users.read"] });
    await expect(resolveEffectivePermissions("agent", ["users.invite"])).resolves.toEqual(
      expect.arrayContaining(["users.read", "users.invite"])
    );
  });

  it("reconcileWorkspaceRoleDefinitionsWithBuiltin upserts four membership roles", async () => {
    mocks.findOneMock.mockResolvedValue(null);
    await reconcileWorkspaceRoleDefinitionsWithBuiltin();
    expect(mocks.updateOneMock).toHaveBeenCalledTimes(4);
  });

  it("ensureDefaultRoleDefinitions seeds only when empty", async () => {
    mocks.countDocumentsMock.mockResolvedValueOnce(1);
    await ensureDefaultRoleDefinitions();
    expect(mocks.updateOneMock).not.toHaveBeenCalled();

    mocks.countDocumentsMock.mockResolvedValueOnce(0);
    await ensureDefaultRoleDefinitions();
    expect(mocks.updateOneMock).toHaveBeenCalled();
  });
});
