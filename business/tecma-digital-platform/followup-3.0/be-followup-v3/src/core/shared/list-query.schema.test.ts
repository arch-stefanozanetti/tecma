import { describe, it, expect } from "vitest";
import { ListQuerySchema } from "./list-query.js";

describe("ListQuerySchema", () => {
  it("coerce page e perPage da stringa numerica", () => {
    const parsed = ListQuerySchema.parse({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: "2",
      perPage: "10",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.perPage).toBe(10);
  });

  it("coerce sort.direction da stringa", () => {
    const parsed = ListQuerySchema.parse({
      workspaceId: "ws1",
      projectIds: ["p1"],
      sort: { field: "name", direction: "-1" },
    });
    expect(parsed.sort?.direction).toBe(-1);
  });
});
