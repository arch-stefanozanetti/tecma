import { describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

vi.mock("../rbac/permissions.js", () => ({
  PERMISSIONS: {
    ALL: "*",
  },
}));

const {
  resolveEffectivePermissionsMock,
  listWorkspaceMembershipsForUserMock,
  getPermissionsForRoleMock,
} = vi.hoisted(() => ({
  resolveEffectivePermissionsMock: vi.fn(),
  listWorkspaceMembershipsForUserMock: vi.fn(),
  getPermissionsForRoleMock: vi.fn(),
}));
vi.mock("../rbac/roleDefinitions.service.js", () => ({
  resolveEffectivePermissions: resolveEffectivePermissionsMock,
  getPermissionsForRole: getPermissionsForRoleMock,
}));
vi.mock("../workspaces/workspace-users.service.js", () => ({
  listWorkspaceMembershipsForUser: listWorkspaceMembershipsForUserMock,
}));

import {
  buildAccessPayloadFromUserDoc,
  escapeEmailForRegex,
  toAuthSessionUser,
  USER_COLLECTION_CANDIDATES,
} from "./userAccessPayload.js";

describe("userAccessPayload", () => {
  it("maps auth session user", () => {
    const user = toAuthSessionUser({
      sub: "u1",
      email: "a@example.com",
      role: "agent",
      isAdmin: false,
      permissions: ["clients.read"],
      projectId: "p1",
    });

    expect(user).toEqual({
      id: "u1",
      email: "a@example.com",
      role: "agent",
      isAdmin: false,
      permissions: ["clients.read"],
      projectId: "p1",
      system_role: undefined,
      isTecmaAdmin: false,
    });
  });

  it("builds payload and computes admin/project/email normalization", async () => {
    listWorkspaceMembershipsForUserMock.mockResolvedValueOnce([]);
    resolveEffectivePermissionsMock.mockResolvedValueOnce(["*", "clients.read"]);

    const payload = await buildAccessPayloadFromUserDoc(
      {
        _id: new ObjectId("64b64f3fd9024a2a53111111"),
        email: "  TEST@Example.com ",
        role: "ADMIN",
        permissions_override: ["*"],
        project_ids: ["p1"],
      },
      "fallback@example.com"
    );

    expect(payload.sub).toBe("64b64f3fd9024a2a53111111");
    expect(payload.email).toBe("test@example.com");
    expect(payload.isAdmin).toBe(true);
    expect(payload.projectId).toBe("p1");
  });

  it("derives permissions from workspace memberships when present", async () => {
    listWorkspaceMembershipsForUserMock.mockResolvedValueOnce([
      { workspaceId: "w1", role: "collaborator" },
      { workspaceId: "w2", role: "admin" },
    ]);
    getPermissionsForRoleMock
      .mockResolvedValueOnce(["apartments.read", "deals.create", "deals.close"])
      .mockResolvedValueOnce("*");

    const payload = await buildAccessPayloadFromUserDoc(
      {
        _id: new ObjectId("64b64f3fd9024a2a53111111"),
        email: "user@example.com",
        project_ids: [],
      },
      "fallback@example.com"
    );

    expect(payload.sub).toBe("64b64f3fd9024a2a53111111");
    expect(payload.email).toBe("user@example.com");
    expect(payload.isAdmin).toBe(true);
    expect(payload.role).toBe("admin");
    expect(payload.permissions).toContain("*");
    expect(getPermissionsForRoleMock).toHaveBeenCalledWith("collaborator");
    expect(getPermissionsForRoleMock).toHaveBeenCalledWith("admin");
    expect(getPermissionsForRoleMock).toHaveBeenCalledTimes(2);
  });

  it("escapes regex-special chars in email and exports collection candidates", () => {
    expect(escapeEmailForRegex("A+B@test.com")).toBe("a\\+b@test\\.com");
    expect(USER_COLLECTION_CANDIDATES).toContain("tz_users");
  });
});
