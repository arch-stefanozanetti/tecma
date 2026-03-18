import { describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  resolveEffectivePermissionsMock: vi.fn(),
}));

vi.mock("../rbac/roleDefinitions.service.js", () => ({
  resolveEffectivePermissions: mocks.resolveEffectivePermissionsMock,
}));

import { PERMISSIONS } from "../rbac/permissions.js";
import { buildAccessPayloadFromUserDoc, escapeEmailForRegex, toAuthSessionUser } from "./userAccessPayload.js";

describe("userAccessPayload", () => {
  it("toAuthSessionUser maps token payload for frontend session shape", () => {
    const result = toAuthSessionUser({
      sub: "u1",
      email: "u@example.com",
      role: "agent",
      isAdmin: false,
      permissions: ["requests:read"],
      projectId: "p1",
    });

    expect(result).toEqual({
      id: "u1",
      email: "u@example.com",
      role: "agent",
      isAdmin: false,
      permissions: ["requests:read"],
      projectId: "p1",
    });
  });

  it("buildAccessPayloadFromUserDoc resolves permissions and derives admin/project/email", async () => {
    const _id = new ObjectId();
    mocks.resolveEffectivePermissionsMock.mockResolvedValueOnce([PERMISSIONS.ALL, "clients:write"]);

    const payload = await buildAccessPayloadFromUserDoc(
      {
        _id,
        email: " AGENT@EXAMPLE.COM ",
        role: "Agent",
        permissions_override: ["clients:write"],
        project_ids: ["proj-1", "proj-2"],
      },
      "fallback@example.com"
    );

    expect(payload.sub).toBe(_id.toHexString());
    expect(payload.email).toBe("agent@example.com");
    expect(payload.role).toBe("agent");
    expect(payload.isAdmin).toBe(true);
    expect(payload.projectId).toBe("proj-1");
    expect(payload.permissions).toEqual([PERMISSIONS.ALL, "clients:write"]);
  });

  it("uses fallback email and null project when missing", async () => {
    const _id = new ObjectId();
    mocks.resolveEffectivePermissionsMock.mockResolvedValueOnce(["requests:read"]);

    const payload = await buildAccessPayloadFromUserDoc(
      {
        _id,
      },
      "fallback@example.com"
    );

    expect(payload.email).toBe("fallback@example.com");
    expect(payload.projectId).toBeNull();
    expect(payload.isAdmin).toBe(false);
  });

  it("escapeEmailForRegex normalizes and escapes regex metacharacters", () => {
    expect(escapeEmailForRegex("  A+B(test)@Example.com ")).toBe("a\\+b\\(test\\)@example\\.com");
  });
});
