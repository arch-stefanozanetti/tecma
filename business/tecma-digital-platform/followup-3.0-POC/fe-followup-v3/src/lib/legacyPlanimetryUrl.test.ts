import { describe, expect, it } from "vitest";
import { buildLegacyPlanimetryUrl } from "./legacyPlanimetryUrl";

describe("buildLegacyPlanimetryUrl", () => {
  it("uses coll bucket for dev-1/demo", () => {
    const url = buildLegacyPlanimetryUrl({
      apiEnvironment: "dev-1",
      projectName: "Arborea Living",
      apartmentName: "G10",
      cacheKey: "123",
    });
    expect(url).toContain("/b/tecma-assets-coll/");
    expect(url).toContain("/initiatives/Arborea%20Living/");
    expect(url).toContain("/planimetrie/G10.png");
    expect(url).toContain("?cache=123");
  });

  it("uses prod bucket for prod", () => {
    const url = buildLegacyPlanimetryUrl({
      apiEnvironment: "prod",
      projectName: "Arborea Living",
      apartmentName: "G10",
    });
    expect(url).toContain("/b/tecma-assets-prod/");
  });

  it("encodes apartment names with spaces", () => {
    const url = buildLegacyPlanimetryUrl({
      apiEnvironment: "demo",
      projectName: "Le Dimore del Parco",
      apartmentName: "B 03",
    });
    expect(url).toContain("/B%2003.png");
  });
});

