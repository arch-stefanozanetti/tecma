import { describe, expect, it } from "vitest";
import { applyAdvancedPathOverrides, deepMergeRawProject, setDeep } from "./legacy-raw-project-merge.js";

describe("deepMergeRawProject", () => {
  it("merge oggetti annidati senza perdere chiavi fratelli", () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const patch = { nested: { y: 99, z: 3 } };
    expect(deepMergeRawProject(base, patch)).toEqual({ a: 1, nested: { x: 1, y: 99, z: 3 } });
  });

  it("sostituisce array e primitive", () => {
    const base = { arr: [1, 2], n: 1 };
    const patch = { arr: [3], n: 2 };
    expect(deepMergeRawProject(base, patch)).toEqual({ arr: [3], n: 2 });
  });
});

describe("setDeep", () => {
  it("imposta valore profondo", () => {
    const o = { a: { b: { c: 1 } } };
    expect(setDeep(o, ["a", "b", "c"], 2)).toEqual({ a: { b: { c: 2 } } });
  });
});

describe("applyAdvancedPathOverrides", () => {
  it("applica path con punti", () => {
    const root = { myhomeConfig: { proposal: { x: 1 } } };
    const out = applyAdvancedPathOverrides(root, [
      { path: "myhomeConfig.proposal.x", valueType: "number", numberValue: 42 },
    ]);
    expect(out).toEqual({ myhomeConfig: { proposal: { x: 42 } } });
  });
});
