import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const usersFindOneMock = vi.fn();
  const projectsFindMock = vi.fn();
  const projectsToArrayMock = vi.fn();

  const usersCollection = {
    findOne: usersFindOneMock,
  };

  const projectsCollection = {
    find: projectsFindMock,
  };

  projectsFindMock.mockImplementation(() => ({
    project: () => ({ toArray: projectsToArrayMock }),
  }));

  return {
    usersFindOneMock,
    projectsFindMock,
    projectsToArrayMock,
    usersCollection,
    projectsCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_users") return mocks.usersCollection;
      if (name === "tz_projects") return mocks.projectsCollection;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

import { getProjectAccessByEmail } from "./projectAccess.service.js";

describe("projectAccess.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
