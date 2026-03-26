import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const tzFindOne = vi.fn();
  const legacyFindOne = vi.fn();
  return { tzFindOne, legacyFindOne };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_projects") return { findOne: mocks.tzFindOne };
      if (name === "projects") return { findOne: mocks.legacyFindOne };
      throw new Error(`Unexpected collection ${name}`);
    },
  }),
}));

vi.mock("./project-access.js", () => ({
  ensureProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
}));

import { getProjectDetail } from "./project-detail.service.js";

describe("project-detail.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyFindOne.mockResolvedValue(null);
  });

  it("returns expanded project fields from tz_projects", async () => {
    mocks.tzFindOne
      .mockResolvedValueOnce({
        _id: "p1",
        name: "arborea",
        displayName: "Arborea Living",
        mode: "rent",
        city: "Milano",
        payoff: "Payoff",
        contactEmail: "info@example.com",
        contactPhone: "+39",
        projectUrl: "https://example.com",
        customDomain: "app.example.com",
        defaultLang: "it",
        hostKey: "host-key",
        assetKey: "asset-key",
        feVendorKey: "vendor-key",
        automaticQuoteEnabled: true,
        accountManagerEnabled: true,
        hasDAS: true,
        broker: "broker-x",
        iban: "IT00X",
        migration: { runId: "r1" },
        legacyPayload: { foo: "bar" },
      });

    const detail = await getProjectDetail("p1", "w1", true);
    expect(detail.mode).toBe("rent");
    expect(detail.contactEmail).toBe("info@example.com");
    expect(detail.customDomain).toBe("app.example.com");
    expect(detail.automaticQuoteEnabled).toBe(true);
    expect(detail.migration).toEqual({ runId: "r1" });
    expect(detail.legacyPayload).toEqual({ foo: "bar" });
  });

  it("finds project by legacyProjectId when route uses legacy id", async () => {
    mocks.tzFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "new-object-id",
        legacyProjectId: "fake-rent-01",
        name: "appartamenti-nord",
        displayName: "Appartamenti Nord (Rent)",
        mode: "rent",
      });

    const detail = await getProjectDetail("fake-rent-01", "w1", true);
    expect(detail.id).toBe("new-object-id");
    expect(detail.displayName).toBe("Appartamenti Nord (Rent)");
    expect(mocks.legacyFindOne).not.toHaveBeenCalled();
  });
});

