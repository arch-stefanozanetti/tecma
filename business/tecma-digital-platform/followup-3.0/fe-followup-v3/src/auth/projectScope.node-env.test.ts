/**
 * Branch `typeof window === "undefined"` in getStorage.
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { loadProjectScope } from "./projectScope";

describe("projectScope (node)", () => {
  it("loadProjectScope senza window ritorna null", () => {
    expect(loadProjectScope()).toBeNull();
  });
});
