import { describe, expect, it } from "vitest";
import { isLegacyWorkspaceId, resolveMongoWorkspaceId } from "./workspaceSessionId";

describe("workspaceSessionId", () => {
  it("isLegacyWorkspaceId riconosce ambienti legacy", () => {
    expect(isLegacyWorkspaceId("demo")).toBe(true);
    expect(isLegacyWorkspaceId("69b4251c1638eb7ef78bc988")).toBe(false);
  });

  it("resolveMongoWorkspaceId ignora demo se c'è defaultWorkspaceId", () => {
    expect(
      resolveMongoWorkspaceId("demo", "69b4251c1638eb7ef78bc988", [])
    ).toBe("69b4251c1638eb7ef78bc988");
  });

  it("resolveMongoWorkspaceId preferisce id mongo esplicito", () => {
    expect(resolveMongoWorkspaceId("69abc", "69def", [{ _id: "69ghi" }])).toBe("69abc");
  });
});
