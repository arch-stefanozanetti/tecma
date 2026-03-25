import { describe, expect, it } from "vitest";
import { GA4_ACCOUNT_FALLBACK_LABEL, groupGa4PropertiesByAccount } from "./groupGa4PropertiesByAccount";
import type { Ga4PropertyRow } from "./mergeDiscoveryWithSaved";

describe("groupGa4PropertiesByAccount", () => {
  it("raggruppa per accountDisplayName e ordina", () => {
    const rows: Ga4PropertyRow[] = [
      { propertyId: "2", displayName: "B", accountDisplayName: "Zeta" },
      { propertyId: "1", displayName: "A", accountDisplayName: "Alpha" },
      { propertyId: "3", displayName: "C", accountDisplayName: "Zeta" },
    ];
    const g = groupGa4PropertiesByAccount(rows);
    expect(g.map((x) => x.accountLabel)).toEqual(["Alpha", "Zeta"]);
    expect(g[0]!.properties.map((p) => p.propertyId)).toEqual(["1"]);
    expect(g[1]!.properties.map((p) => p.propertyId)).toEqual(["2", "3"]);
  });

  it("usa fallback se accountDisplayName mancante", () => {
    const rows: Ga4PropertyRow[] = [{ propertyId: "9", displayName: "Solo" }];
    const g = groupGa4PropertiesByAccount(rows);
    expect(g).toHaveLength(1);
    expect(g[0]!.accountLabel).toBe(GA4_ACCOUNT_FALLBACK_LABEL);
    expect(g[0]!.properties[0]!.propertyId).toBe("9");
  });
});
