import { describe, expect, it } from "vitest";
import { assertCatalogIntegrity } from "./catalog-integrity.js";
import { FEATURE_CATALOG } from "./feature-catalog.js";
import { ID_TEMA_EPIC_MAP } from "./id-tema-epic-map.js";
import { getCatalogForApi, getFeatureCatalog } from "./jira-prd.service.js";

describe("jira-prd catalog", () => {
  it("assertCatalogIntegrity passa sul catalogo pubblicato", () => {
    const r = assertCatalogIntegrity(FEATURE_CATALOG);
    expect(r.ok, r.errors.join("; ")).toBe(true);
  });

  it("ogni idTema del catalogo ha voce in ID_TEMA_EPIC_MAP", () => {
    for (const e of FEATURE_CATALOG) {
      expect(ID_TEMA_EPIC_MAP[e.idTema], e.idTema).toBeDefined();
    }
  });

  it("espone un catalogo non vuoto con discipline e PRD per ogni voce", () => {
    const list = getFeatureCatalog();
    expect(list.length).toBeGreaterThan(0);
    for (const e of list) {
      expect(e.idTema.length).toBeGreaterThan(0);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.summary.length).toBeGreaterThan(0);
      expect(e.kind).toMatch(/^(product|technical)$/);
      expect(e.prd.problemJob.length).toBeGreaterThan(0);
      expect(e.prd.expectedBehavior.length).toBeGreaterThan(0);
      expect(e.prd.nonGoals.length).toBeGreaterThan(0);
      expect(e.prd.dataMongo.length).toBeGreaterThan(0);
      expect(e.prd.permissionsEntitlement.length).toBeGreaterThan(0);
      expect(e.prd.failureModes.length).toBeGreaterThan(0);
      expect(e.prd.qaProofs.length).toBeGreaterThan(0);
      expect(e.disciplines.frontend.length).toBeGreaterThan(0);
      expect(e.disciplines.backend.length).toBeGreaterThan(0);
      expect(e.disciplines.database.length).toBeGreaterThan(0);
      expect(e.disciplines.uxUi.length).toBeGreaterThan(0);
      expect(e.disciplines.qa.length).toBeGreaterThan(0);
      expect(e.disciplines.test.length).toBeGreaterThan(0);
      expect(e.epicId).toMatch(/^E(1[0-4]|[1-9])$/);
      expect(e.epicTitle.length).toBeGreaterThan(0);
      expect(e.workItemKind).toMatch(/^(story|spike|task|technical)$/);
    }
  });

  it("getCatalogForApi restituisce lo stesso insieme di voci", () => {
    const a = getFeatureCatalog();
    const b = getCatalogForApi().data;
    expect(b).toEqual(a);
  });
});
