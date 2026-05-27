import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Mirror of inviteUserBodySchema in users-admin.routes.ts for unit-level contract tests. */
const inviteUserBodySchema = z.object({
  email: z.string().email(),
  role: z.string().min(1).optional(),
  roleLabel: z.string().min(1).optional(),
  projectId: z.string().min(1),
  projectName: z.string().min(1).optional(),
  appPublicUrl: z.string().url().optional(),
  workspaceId: z.string().optional(),
});

function resolveInviteRoleLabel(body: z.infer<typeof inviteUserBodySchema>): string {
  return body.roleLabel?.trim() || body.role?.trim() || "Membro";
}

describe("inviteUserBodySchema", () => {
  it("accepts FE payload with roleLabel only", () => {
    const body = inviteUserBodySchema.parse({
      email: "user@example.com",
      projectId: "proj-1",
      roleLabel: "Collaborator",
      appPublicUrl: "https://followup-3-fe.onrender.com",
    });
    expect(resolveInviteRoleLabel(body)).toBe("Collaborator");
  });

  it("accepts legacy payload with role only", () => {
    const body = inviteUserBodySchema.parse({
      email: "user@example.com",
      projectId: "proj-1",
      role: "collaborator",
    });
    expect(resolveInviteRoleLabel(body)).toBe("collaborator");
  });

  it("prefers roleLabel over role when both present", () => {
    const body = inviteUserBodySchema.parse({
      email: "user@example.com",
      projectId: "proj-1",
      role: "viewer",
      roleLabel: "Collaborator",
    });
    expect(resolveInviteRoleLabel(body)).toBe("Collaborator");
  });

  it("defaults to Membro when neither role nor roleLabel", () => {
    const body = inviteUserBodySchema.parse({
      email: "user@example.com",
      projectId: "proj-1",
    });
    expect(resolveInviteRoleLabel(body)).toBe("Membro");
  });
});
