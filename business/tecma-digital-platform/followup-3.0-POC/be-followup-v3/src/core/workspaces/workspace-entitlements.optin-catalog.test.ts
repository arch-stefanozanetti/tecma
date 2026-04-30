/**
 * Regressione: chiavi con defaultEntitledWhenNoRow === false devono risultare non entitled senza riga DB.
 * Il catalogo reale oggi ha tutte le chiavi a true; qui si simula il futuro opt-in sovrascrivendo solo getDefaultEntitledWhenNoRow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne,
      find: () => ({ toArray: vi.fn() }),
      updateOne: vi.fn(),
    }),
  }),
}));

vi.mock("./workspace-feature-catalog.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./workspace-feature-catalog.js")>();
  return {
    ...orig,
    getDefaultEntitledWhenNoRow: (feature: import("./workspace-feature-catalog.js").WorkspaceEntitlementFeature) =>
      feature === "reports" ? false : orig.getDefaultEntitledWhenNoRow(feature),
  };
});

import { isWorkspaceEntitledToFeature } from "./workspace-entitlements.service.js";

describe("workspace entitlements — opt-in catalog (reports senza riga ⇒ false)", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it("assenza riga DB e default false ⇒ not entitled", async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(isWorkspaceEntitledToFeature("ws-paid", "reports")).resolves.toBe(false);
  });

  it("altre chiavi usano ancora il default del catalogo reale (es. publicApi ⇒ true)", async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(isWorkspaceEntitledToFeature("ws1", "publicApi")).resolves.toBe(true);
  });
});
