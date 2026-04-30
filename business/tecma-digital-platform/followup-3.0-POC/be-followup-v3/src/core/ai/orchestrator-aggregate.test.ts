import { describe, it, expect } from "vitest";
import { buildRuleBasedRows, MAX_AGGREGATED_ITEMS_STORED } from "./orchestrator.service.js";

const BATCH_NOW = "2026-03-01T12:00:00.000Z";
/** updatedAt abbastanza vecchio rispetto a BATCH_NOW (>= 7g) */
const STALE_ASSOC = "2026-02-01T12:00:00.000Z";
/** updatedAt cliente inattivo (>= 20g) */
const INACTIVE_CLIENT = "2026-01-01T12:00:00.000Z";

describe("buildRuleBasedRows (aggregated Cockpit)", () => {
  it("unisce proposte ferme in un gruppo stale_proposal_7d con aggregatedItems", () => {
    const rows = buildRuleBasedRows(
      { workspaceId: "w1", projectIds: ["p1"], limit: 8 },
      [],
      [
        { _id: "apt1", name: "Attico", status: "RENTED" },
        { _id: "apt2", name: "Loft", status: "AVAILABLE" }
      ],
      [
        {
          _id: "a1",
          apartmentId: "apt1",
          clientId: "c1",
          status: "proposta",
          updatedAt: STALE_ASSOC
        },
        {
          _id: "a2",
          apartmentId: "apt2",
          clientId: "c2",
          status: "proposta",
          updatedAt: STALE_ASSOC
        }
      ],
      BATCH_NOW
    );

    const stale = rows.find((r) => r.aggregatedKind === "stale_proposal_7d");
    expect(stale).toBeDefined();
    expect(stale?.aggregatedItems).toHaveLength(2);
    expect(stale?.aggregatedItems?.map((i) => i.label).sort()).toEqual(["Attico", "Loft"]);
    expect(stale?.title).toContain("2");
  });

  it("rispetta limit sul numero di gruppi restituiti (ordinamento rischio poi score)", () => {
    const rows = buildRuleBasedRows(
      { workspaceId: "w1", projectIds: ["p1"], limit: 2 },
      [{ _id: "c1", fullName: "Mario", email: "m@x.it", updatedAt: INACTIVE_CLIENT }],
      [{ _id: "apt1", name: "U1", status: "AVAILABLE" }],
      [
        {
          _id: "as1",
          apartmentId: "apt1",
          clientId: "c1",
          status: "proposta",
          updatedAt: STALE_ASSOC
        }
      ],
      BATCH_NOW
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].aggregatedKind).toBe("stale_proposal_7d");
    expect(rows[1].aggregatedKind).toBe("inactive_client_20d");
  });

  it("usa no_critical_signal quando non ci sono segnali", () => {
    const rows = buildRuleBasedRows(
      { workspaceId: "w1", projectIds: ["p1"], limit: 8 },
      [{ _id: "c1", fullName: "Mario", email: "m@x.it", updatedAt: BATCH_NOW }],
      [{ _id: "apt1", name: "U1", status: "RENTED" }],
      [
        {
          _id: "as1",
          apartmentId: "apt1",
          clientId: "c1",
          status: "proposta",
          updatedAt: BATCH_NOW
        }
      ],
      BATCH_NOW
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].aggregatedKind).toBe("no_critical_signal");
  });

  it("taglia aggregatedItems al massimo configurato", () => {
    const many = Array.from({ length: MAX_AGGREGATED_ITEMS_STORED + 12 }, (_, i) => ({
      _id: `a${i}`,
      apartmentId: `apt${i}`,
      clientId: "c1",
      status: "proposta",
      updatedAt: STALE_ASSOC
    }));
    const apts = many.map((_, i) => ({ _id: `apt${i}`, name: `A${i}`, status: "AVAILABLE" as const }));

    const rows = buildRuleBasedRows(
      { workspaceId: "w1", projectIds: ["p1"], limit: 8 },
      [],
      apts,
      many,
      BATCH_NOW
    );

    const stale = rows.find((r) => r.aggregatedKind === "stale_proposal_7d");
    expect(stale?.aggregatedItems?.length).toBe(MAX_AGGREGATED_ITEMS_STORED);
  });
});
