import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const usersFindOneMock = vi.fn();
  const projectsFindMock = vi.fn();
  const projectsToArrayMock = vi.fn();
  const workspaceProjectsFindMock = vi.fn();
  const workspaceProjectsToArrayMock = vi.fn();
  const workspaceUserProjectsFindMock = vi.fn();
  const workspaceUserProjectsToArrayMock = vi.fn();

  const usersCollection = {
    findOne: usersFindOneMock,
  };

  const projectsCollection = {
    find: projectsFindMock,
  };

  const workspaceProjectsCollection = {
    find: workspaceProjectsFindMock,
  };

  const workspaceUserProjectsCollection = {
    createIndex: vi.fn().mockResolvedValue("ok"),
    find: workspaceUserProjectsFindMock,
  };

  projectsFindMock.mockImplementation(() => ({
    project: () => ({ toArray: projectsToArrayMock }),
  }));

  workspaceProjectsFindMock.mockImplementation(() => ({
    project: () => ({ toArray: workspaceProjectsToArrayMock }),
  }));

  workspaceUserProjectsFindMock.mockImplementation(() => ({
    project: () => ({ toArray: workspaceUserProjectsToArrayMock }),
  }));

  return {
    usersFindOneMock,
    projectsFindMock,
    projectsToArrayMock,
    workspaceProjectsFindMock,
    workspaceProjectsToArrayMock,
    workspaceUserProjectsFindMock,
    workspaceUserProjectsToArrayMock,
    usersCollection,
    projectsCollection,
    workspaceProjectsCollection,
    workspaceUserProjectsCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_users") return mocks.usersCollection;
      if (name === "tz_projects") return mocks.projectsCollection;
      if (name === "tz_workspace_projects") return mocks.workspaceProjectsCollection;
      if (name === "tz_workspace_user_projects") return mocks.workspaceUserProjectsCollection;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

import { getProjectAccessByEmail } from "./projectAccess.service.js";

describe("projectAccess.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceProjectsToArrayMock.mockResolvedValue([]);
    mocks.workspaceUserProjectsToArrayMock.mockResolvedValue([]);
  });

  it("returns found=false when user is missing", async () => {
    mocks.usersFindOneMock.mockResolvedValueOnce(null);

    const result = await getProjectAccessByEmail({ email: "missing@example.com" });

    expect(result).toEqual({
      found: false,
      email: "missing@example.com",
      role: null,
      isAdmin: false,
      projects: [],
    });
  });

  it("returns admin access with merged deduplicated projects", async () => {
    const p1 = new ObjectId();
    const p2 = new ObjectId();

    mocks.usersFindOneMock.mockResolvedValueOnce({ email: "admin@example.com", role: "Admin" });
    mocks.projectsToArrayMock
      .mockResolvedValueOnce([
        { _id: p1, name: "Alpha" },
        { _id: p2, name: "Beta" },
      ])
      .mockResolvedValueOnce([
        { _id: p1, displayName: "Alpha Display" },
      ]);

    const result = await getProjectAccessByEmail({ email: "admin@example.com" });

    expect(result.found).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.role).toBe("admin");
    expect(result.projects).toHaveLength(2);
    expect(result.projects.map((p) => p.id)).toEqual(expect.arrayContaining([p1.toHexString(), p2.toHexString()]));
  });

  it("returns filtered non-admin projects and normalizes role", async () => {
    const p1 = new ObjectId();
    const p2 = new ObjectId();

    mocks.usersFindOneMock.mockResolvedValueOnce({
      email: "agent@example.com",
      role: "AgEnt",
      project_ids: [p1.toHexString(), p2.toHexString()],
    });

    mocks.projectsToArrayMock
      .mockResolvedValueOnce([{ _id: p1, displayName: "Project One" }])
      .mockResolvedValueOnce([{ _id: p2, name: "Project Two" }]);

    const result = await getProjectAccessByEmail({ email: "agent@example.com" });

    expect(result.found).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.role).toBe("agent");
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]?.displayName).toBeDefined();
  });

  it("validates input email", async () => {
    await expect(getProjectAccessByEmail({ email: "not-an-email" })).rejects.toMatchObject({ name: "ZodError" });
  });

  it("with workspaceId and no workspace rows does not filter projects", async () => {
    const p1 = new ObjectId();
    mocks.usersFindOneMock.mockResolvedValueOnce({
      email: "agent@example.com",
      role: "agent",
      project_ids: [p1.toHexString()],
    });
    mocks.projectsToArrayMock.mockResolvedValueOnce([{ _id: p1, name: "One" }]).mockResolvedValueOnce([]);
    mocks.workspaceProjectsToArrayMock.mockResolvedValueOnce([]);

    const result = await getProjectAccessByEmail({
      email: "agent@example.com",
      workspaceId: "507f1f77bcf86cd799439011",
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.id).toBe(p1.toHexString());
  });

  it("with workspaceId intersects to workspace-linked projects", async () => {
    const p1 = new ObjectId();
    const p2 = new ObjectId();
    mocks.usersFindOneMock.mockResolvedValueOnce({
      email: "agent@example.com",
      role: "agent",
      project_ids: [p1.toHexString(), p2.toHexString()],
    });
    mocks.projectsToArrayMock
      .mockResolvedValueOnce([{ _id: p1, name: "One" }, { _id: p2, name: "Two" }])
      .mockResolvedValueOnce([]);
    mocks.workspaceProjectsToArrayMock.mockResolvedValueOnce([{ projectId: p1.toHexString() }]);

    const result = await getProjectAccessByEmail({
      email: "agent@example.com",
      workspaceId: "507f1f77bcf86cd799439011",
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.id).toBe(p1.toHexString());
  });

  it("non-admin with tz_workspace_user_projects rows sees only allowed projects", async () => {
    const p1 = new ObjectId();
    const p2 = new ObjectId();
    mocks.usersFindOneMock.mockResolvedValueOnce({
      email: "agent@example.com",
      role: "agent",
      project_ids: [p1.toHexString(), p2.toHexString()],
    });
    mocks.projectsToArrayMock
      .mockResolvedValueOnce([{ _id: p1, name: "One" }, { _id: p2, name: "Two" }])
      .mockResolvedValueOnce([]);
    mocks.workspaceProjectsToArrayMock.mockResolvedValueOnce([
      { projectId: p1.toHexString() },
      { projectId: p2.toHexString() },
    ]);
    mocks.workspaceUserProjectsToArrayMock.mockResolvedValueOnce([{ projectId: p1.toHexString() }]);

    const result = await getProjectAccessByEmail({
      email: "agent@example.com",
      workspaceId: "507f1f77bcf86cd799439011",
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.id).toBe(p1.toHexString());
  });
});
