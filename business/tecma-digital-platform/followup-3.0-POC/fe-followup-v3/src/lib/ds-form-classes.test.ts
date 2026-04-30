import { describe, it, expect } from "vitest";
import { INPUT_LIKE_CLASSES, TEXTAREA_LIKE_CLASSES } from "./ds-form-classes";

describe("ds-form-classes", () => {
  it("INPUT_LIKE_CLASSES contiene le classi DS per select/input nativi", () => {
    expect(INPUT_LIKE_CLASSES).toMatch(/rounded-md|border-input|font-body|focus:ring-ring/);
    expect(INPUT_LIKE_CLASSES).toMatch(/h-10/);
  });

  it("TEXTAREA_LIKE_CLASSES contiene min-height e stile coerente", () => {
    expect(TEXTAREA_LIKE_CLASSES).toMatch(/min-h-\[200px\]|rounded-md|border-input/);
  });
});
