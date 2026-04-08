import { describe, expect, it } from "vitest";
import {
  budgetFitPoints,
  clientListsMentionApartment,
  parseClientBudget,
  scoreApartmentForClient,
  scoreClientForApartment,
  surfaceProximityPoints,
} from "./matching-score.util.js";

describe("parseClientBudget", () => {
  it("parses number and string", () => {
    expect(parseClientBudget(250000)).toBe(250000);
    expect(parseClientBudget("180 000,50")).toBe(180000.5);
  });
  it("returns null for invalid", () => {
    expect(parseClientBudget(null)).toBeNull();
    expect(parseClientBudget("")).toBeNull();
  });
});

describe("clientListsMentionApartment", () => {
  it("matches ObjectId string to apartment hex", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(
      clientListsMentionApartment(id, [{ appartment: id }], undefined)
    ).toBe(true);
    expect(clientListsMentionApartment(id, [], [{ _id: id }])).toBe(true);
  });
});

describe("budgetFitPoints", () => {
  it("gives higher score when price is within budget", () => {
    const a = budgetFitPoints(200000, { mode: "SELL", amount: 180000 });
    const b = budgetFitPoints(200000, { mode: "SELL", amount: 250000 });
    expect(a.pts).toBeGreaterThan(b.pts);
  });

  it("spiega quando mancano budget o prezzo", () => {
    const both = budgetFitPoints(null, undefined);
    expect(both.reason).toMatch(/Budget cliente e prezzo listino/);
    const noBudget = budgetFitPoints(null, { mode: "SELL", amount: 100 });
    expect(noBudget.reason).toMatch(/Budget cliente non indicato/);
    const noPrice = budgetFitPoints(100000, undefined);
    expect(noPrice.reason).toMatch(/Prezzo listino non disponibile/);
  });
});

describe("surfaceProximityPoints", () => {
  it("rewards closeness to median", () => {
    const close = surfaceProximityPoints(100, 100);
    const far = surfaceProximityPoints(40, 100);
    expect(close.pts).toBeGreaterThan(far.pts);
  });
});

describe("scoreApartmentForClient", () => {
  it("does not return a flat constant across different inputs", () => {
    const base = {
      apartmentHexId: "507f1f77bcf86cd799439011",
      medianSurfaceMq: 90,
      clientBudget: 200000,
      interestedAppartments: undefined,
      selectedAppartments: undefined,
    };
    const high = scoreApartmentForClient({
      ...base,
      surfaceMq: 90,
      status: "AVAILABLE",
      rawPrice: { mode: "SELL", amount: 190000 },
    });
    const low = scoreApartmentForClient({
      ...base,
      apartmentHexId: "507f1f77bcf86cd799439012",
      surfaceMq: 45,
      status: "SOLD",
      rawPrice: { mode: "SELL", amount: 400000 },
    });
    expect(high.score).not.toBe(low.score);
    expect(high.score).toBeGreaterThan(low.score);
  });
});

describe("scoreClientForApartment", () => {
  it("varies with client status and budget fit", () => {
    const a = scoreClientForApartment({
      apartmentHexId: "507f1f77bcf86cd799439011",
      apartmentRawPrice: { mode: "SELL", amount: 150000 },
      clientBudget: 400000,
      clientStatus: "negotiation",
      interestedAppartments: [{ appartment: "507f1f77bcf86cd799439011" }],
    });
    const b = scoreClientForApartment({
      apartmentHexId: "507f1f77bcf86cd799439011",
      apartmentRawPrice: { mode: "SELL", amount: 150000 },
      clientBudget: 100000,
      clientStatus: "lost",
      interestedAppartments: undefined,
    });
    expect(a.score).not.toBe(b.score);
    expect(a.score).toBeGreaterThan(b.score);
  });
});
