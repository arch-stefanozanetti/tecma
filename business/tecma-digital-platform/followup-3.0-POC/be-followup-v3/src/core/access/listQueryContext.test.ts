import { describe, expect, it } from "vitest";
import { clampProjectIds, isNoAccessProjectIds, applyListQueryContext } from "./listQueryContext.js";

describe("clampProjectIds", () => {
  it("admin unrestricted keeps requested ids", () => {
    expect(clampProjectIds(["a", "b"], ["c"], true)).toEqual(["a", "b"]);
  });

  it("intersects requested with allowed", () => {
    expect(clampProjectIds(["a", "b"], ["a", "c"], false)).toEqual(["a"]);
  });

  it("returns empty when no overlap", () => {
    expect(clampProjectIds(["b"], ["a"], false)).toEqual([]);
  });

  it("uses all allowed when requested empty", () => {
    expect(clampProjectIds([], ["a", "b"], false)).toEqual(["a", "b"]);
  });
});

describe("applyListQueryContext", () => {
  it("marks no access when clamp empty", () => {
    const input = applyListQueryContext(
      { workspaceId: "ws", projectIds: ["x"], page: 1, perPage: 10 },
      {
        email: "u@test.com",
        workspaceId: "ws",
        isAdmin: false,
        isTecmaAdmin: false,
        accessScope: "assigned",
        membershipRole: "collaborator",
        allowedProjectIds: [],
      }
    );
    expect(isNoAccessProjectIds(input.projectIds)).toBe(true);
  });
});
