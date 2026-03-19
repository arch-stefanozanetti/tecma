import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const usersFindOneMock = vi.fn();
const tzProjectsFindToArrayMock = vi.fn();

const tzProjectsFindMock = vi.fn(() => ({
  project: vi.fn(() => ({ toArray: tzProjectsFindToArrayMock })),
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_users") return { findOne: usersFindOneMock };
      if (name === "tz_projects") return { find: tzProjectsFindMock };
      return { findOne: vi.fn(), find: vi.fn() };
    },
  }),
}));

import { getProjectAccessByEmail } from "./projectAccess.service.js";

describe("projectAccess.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns found=false when user does not exist", async () => {
    usersFindOneMock.mockResolvedValueOnce(null);

    const result = await getProjectAccessByEmail({ email: "nope@test.com" });

    expect(result.found).toBe(false);
    expect(result.projects).toEqual([]);
  });

  it("returns merged and deduplicated projects for admin", async () => {
    usersFindOneMock.mockResolvedValueOnce({ email: "admin@test.com", role: "admin", project_ids: [] });
    tzProjectsFindToArrayMock.mockResolvedValueOnce([
      { _id: new ObjectId("64b64f3fd9024a2a53111111"), name: "Zeta" },
      { _id: new ObjectId("64b64f3fd9024a2a53222222"), displayName: "Alpha" },
    ]);
    tzProjectsFindToArrayMock.mockResolvedValueOnce([
      { _id: "64b64f3fd9024a2a53222222", displayName: "Alpha Duplicate" },
      { _id: "64b64f3fd9024a2a53333333", name: "Beta" },
    ]);

    const result = await getProjectAccessByEmail({ email: "admin@test.com" });

    expect(result.found).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.projects.map((p) => p.id)).toEqual([
      "64b64f3fd9024a2a53222222",
      "64b64f3fd9024a2a53333333",
      "64b64f3fd9024a2a53111111",
    ]);
  });

  it("returns only assigned projects for non-admin user", async () => {
    usersFindOneMock.mockResolvedValueOnce({
      email: "agent@test.com",
      role: "collaborator",
      project_ids: ["64b64f3fd9024a2a53111111"],
    });
    tzProjectsFindToArrayMock.mockResolvedValueOnce([{ _id: new ObjectId("64b64f3fd9024a2a53111111"), name: "Assigned" }]);
    tzProjectsFindToArrayMock.mockResolvedValueOnce([]);

    const result = await getProjectAccessByEmail({ email: "agent@test.com" });

    expect(result.found).toBe(true);
    expect(result.isAdmin).toBe(false);
    expect(result.projects).toEqual([
      { id: "64b64f3fd9024a2a53111111", name: "Assigned", displayName: "Assigned" },
    ]);
  });
});
