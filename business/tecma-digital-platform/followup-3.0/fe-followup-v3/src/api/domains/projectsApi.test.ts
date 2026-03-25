import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  putJson: vi.fn(),
  deleteJson: vi.fn(),
}));

vi.mock("../http", () => ({
  getJson: mocks.getJson,
  postJson: mocks.postJson,
  patchJson: mocks.patchJson,
  putJson: mocks.putJson,
  deleteJson: mocks.deleteJson,
}));

import { projectsApi } from "./projectsApi";

describe("projectsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createProject e getProjectDetail usano path /projects corretti", () => {
    projectsApi.createProject({ name: "x", displayName: "X" });
    projectsApi.getProjectDetail("p1", "ws 1");

    expect(mocks.postJson).toHaveBeenCalledWith("/projects", { name: "x", displayName: "X" });
    expect(mocks.getJson).toHaveBeenCalledWith("/projects/p1?workspaceId=ws%201");
  });

  it("listProjectAccess codifica projectId nel path", () => {
    projectsApi.listProjectAccess("p/x", "ws1");
    expect(mocks.getJson).toHaveBeenCalledWith("/projects/p%2Fx/access?workspaceId=ws1");
  });
});
