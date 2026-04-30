import { describe, it, expect } from "vitest";
import { isPriceAvailabilityRelevant } from "./features";
import type { ProjectAccessProject } from "../types/domain";

describe("isPriceAvailabilityRelevant", () => {
  const rentProject: ProjectAccessProject = {
    id: "p-rent",
    name: "Pilot rent",
    displayName: "Pilot rent",
  };
  const sellProject: ProjectAccessProject = {
    id: "p-sell",
    name: "Residenze vendita",
    displayName: "Residenze vendita",
  };

  it("è true se almeno un progetto selezionato è in contesto affitto (nome)", () => {
    expect(isPriceAvailabilityRelevant([rentProject, sellProject], ["p-rent"])).toBe(true);
  });

  it("è false se tutti i progetti selezionati sono solo vendita", () => {
    expect(isPriceAvailabilityRelevant([rentProject, sellProject], ["p-sell"])).toBe(false);
  });

  it("è true senza selezione (retrocompat)", () => {
    expect(isPriceAvailabilityRelevant([sellProject], [])).toBe(true);
  });

  it("è true con mode rent esplicito sul progetto", () => {
    const explicit: ProjectAccessProject = {
      id: "p-milano",
      name: "Residenze Milano",
      displayName: "Residenze Milano",
      mode: "rent",
    };
    expect(isPriceAvailabilityRelevant([explicit, sellProject], ["p-milano"])).toBe(true);
  });
});
