import { describe, expect, it } from "vitest";
import { permissionOverrideDraftDirty } from "./PermissionOverrideMatrix";

describe("permissionOverrideDraftDirty", () => {
  it("is false when draft matches saved (order ignored)", () => {
    expect(permissionOverrideDraftDirty(["b", "a"], ["a", "b"])).toBe(false);
  });

  it("is true when lengths differ", () => {
    expect(permissionOverrideDraftDirty(["a"], [])).toBe(true);
  });

  it("treats undefined saved as empty", () => {
    expect(permissionOverrideDraftDirty([], undefined)).toBe(false);
    expect(permissionOverrideDraftDirty(["x"], undefined)).toBe(true);
  });
});
