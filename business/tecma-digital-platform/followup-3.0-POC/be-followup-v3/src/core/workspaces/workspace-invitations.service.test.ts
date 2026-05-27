import { describe, expect, it, vi, beforeEach } from "vitest";
import { HttpError } from "../../types/http.js";

vi.mock("../../config/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("../auth/inviteToken.service.js", () => ({
  deleteInviteTokensForUserId: vi.fn(),
}));

vi.mock("../users/users-mutations.service.js", () => ({
  inviteUser: vi.fn(),
  deleteUserById: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("./workspace-users.service.js", () => ({
  addWorkspaceUser: vi.fn(),
  removeWorkspaceUser: vi.fn(),
}));

vi.mock("./workspace-user-projects.service.js", () => ({
  addWorkspaceUserProject: vi.fn(),
}));

import { getDb } from "../../config/db.js";
import {
  inviteUser,
  deleteUserById,
  updateUserById,
} from "../users/users-mutations.service.js";
import { deleteInviteTokensForUserId } from "../auth/inviteToken.service.js";
import { addWorkspaceUser, removeWorkspaceUser } from "./workspace-users.service.js";
import { addWorkspaceUserProject } from "./workspace-user-projects.service.js";
import { createWorkspaceInvitation } from "./workspace-invitations.service.js";

describe("createWorkspaceInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue({
      collection: vi.fn((name: string) => ({
        findOne: vi.fn(async (query: { projectId?: string }) => {
          if (name === "tz_workspace_projects" && query.projectId === "proj-1") {
            return { workspaceId: "ws-1", projectId: "proj-1", displayName: "Demo" };
          }
          return null;
        }),
      })),
    } as never);
    vi.mocked(inviteUser).mockResolvedValue({ userId: "mongo-id-1" });
    vi.mocked(addWorkspaceUser).mockResolvedValue({
      workspaceUser: {
        _id: "m1",
        workspaceId: "ws-1",
        userId: "user@test.local",
        role: "collaborator",
        access_scope: "all",
        createdAt: "",
        updatedAt: "",
      },
    });
    vi.mocked(addWorkspaceUserProject).mockResolvedValue({
      row: { _id: "p1", workspaceId: "ws-1", userId: "user@test.local", projectId: "proj-1" },
    });
    vi.mocked(updateUserById).mockResolvedValue(null);
  });

  it("orchestrates invite, membership, projects and overrides", async () => {
    const result = await createWorkspaceInvitation({
      workspaceId: "ws-1",
      email: "user@test.local",
      role: "collaborator",
      projectIds: ["proj-1"],
      appPublicBaseUrl: "https://followup-3-fe.onrender.com",
      roleLabel: "Collaborator",
      permissionsOverride: ["clients.read"],
    });

    expect(result.userId).toBe("mongo-id-1");
    expect(inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@test.local",
        projectId: "proj-1",
        roleLabel: "Collaborator",
      })
    );
    expect(addWorkspaceUser).toHaveBeenCalledWith("ws-1", {
      userId: "user@test.local",
      role: "collaborator",
      access_scope: "assigned",
    });
    expect(addWorkspaceUserProject).toHaveBeenCalledWith("ws-1", "user@test.local", "proj-1");
    expect(updateUserById).toHaveBeenCalledWith("mongo-id-1", {
      permissions_override: ["clients.read"],
      project_ids: ["proj-1"],
    });
  });

  it("rolls back user and membership when project attach fails", async () => {
    vi.mocked(addWorkspaceUserProject).mockRejectedValue(new HttpError("project attach failed", 500));

    await expect(
      createWorkspaceInvitation({
        workspaceId: "ws-1",
        email: "user@test.local",
        role: "collaborator",
        projectIds: ["proj-1"],
        appPublicBaseUrl: "http://localhost:5177",
      })
    ).rejects.toThrow("project attach failed");

    expect(removeWorkspaceUser).toHaveBeenCalledWith("ws-1", "user@test.local");
    expect(deleteInviteTokensForUserId).toHaveBeenCalledWith("mongo-id-1");
    expect(deleteUserById).toHaveBeenCalledWith("mongo-id-1");
  });

  it("rejects when project is not in workspace", async () => {
    await expect(
      createWorkspaceInvitation({
        workspaceId: "ws-1",
        email: "user@test.local",
        role: "collaborator",
        projectIds: ["missing-proj"],
        appPublicBaseUrl: "http://localhost:5177",
      })
    ).rejects.toThrow(/non è associato a questo workspace/);
    expect(inviteUser).not.toHaveBeenCalled();
  });
});
