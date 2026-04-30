import { describe, expect, it } from "vitest";
import { assertCatalogIntegrity } from "./catalog-integrity.js";
import type { FeatureCatalogEntry } from "./feature-catalog-types.js";
import { EPIC_TITLES } from "./epic-registry.js";

const base = (id: string, parent?: string): FeatureCatalogEntry => ({
  idTema: id,
  kind: parent ? "technical" : "product",
  parentIdTema: parent,
  epicId: "E1",
  epicTitle: EPIC_TITLES.E1,
  workItemKind: parent ? "technical" : "story",
  areaPrefix: "[Cross]",
  title: "T",
  summary: "S",
  prd: {
    problemJob: "p",
    expectedBehavior: "e",
    nonGoals: "n",
    dataMongo: "d",
    permissionsEntitlement: "pe",
    failureModes: "f",
    qaProofs: "q",
  },
  docLinks: [],
  disciplines: {
    frontend: "a",
    backend: "b",
    database: "c",
    uxUi: "u",
    qa: "qa",
    test: "t",
  },
});

describe("assertCatalogIntegrity", () => {
  it("passa con parent valido", () => {
    const catalog: FeatureCatalogEntry[] = [base("root"), base("child", "root")];
    const r = assertCatalogIntegrity(catalog);
    expect(r.ok).toBe(true);
  });

  it("fallisce se technical senza parent", () => {
    const catalog: FeatureCatalogEntry[] = [{ ...base("x"), kind: "technical", parentIdTema: undefined }];
    const r = assertCatalogIntegrity(catalog);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("technical"))).toBe(true);
  });

  it("fallisce se parentIdTema non esiste", () => {
    const catalog: FeatureCatalogEntry[] = [base("orphan", "missing")];
    const r = assertCatalogIntegrity(catalog);
    expect(r.ok).toBe(false);
  });
});
