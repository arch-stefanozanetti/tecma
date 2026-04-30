import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { workspaceFeatureEntitled, commercialActivationFootnote } from "./workspaceEntitlementUi";

const baseRows = [
  { feature: "publicApi" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "twilio" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "mailchimp" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "activecampaign" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "aiApprovals" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "reports" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
  { feature: "integrations" as const, entitled: true, recordedStatus: null, implicit: true, recordedNotes: null },
];

describe("workspaceFeatureEntitled", () => {
  it("undefined ⇒ trattato come abilitato (caricamento / fallback)", () => {
    expect(workspaceFeatureEntitled(undefined, "publicApi")).toBe(true);
  });

  it("riga con entitled false ⇒ false", () => {
    expect(
      workspaceFeatureEntitled(
        baseRows.map((r) =>
          r.feature === "publicApi" ? { ...r, entitled: false, recordedStatus: "suspended" as const, implicit: false } : r
        ),
        "publicApi"
      )
    ).toBe(false);
  });

  it("commercialActivationFootnote: connettore Twilio senza entitlement ⇒ testo CTA Tecma", () => {
    const foot = commercialActivationFootnote(
      baseRows.map((r) =>
        r.feature === "twilio" ? { ...r, entitled: false, recordedStatus: "suspended" as const, implicit: false } : r
      ),
      "connector_twilio",
    );
    render(<>{foot}</>);
    expect(screen.getByText(/Tecma/)).toBeTruthy();
  });
});
