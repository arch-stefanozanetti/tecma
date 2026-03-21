import { describe, it, expect } from "vitest";
import { workspaceFeatureEntitled, commercialActivationFootnote } from "./workspaceEntitlementUi";

describe("workspaceFeatureEntitled", () => {
  it("undefined ⇒ trattato come abilitato (caricamento / fallback)", () => {
    expect(workspaceFeatureEntitled(undefined, "publicApi")).toBe(true);
  });

  it("riga con entitled false ⇒ false", () => {
    expect(
      workspaceFeatureEntitled(
        [
          { feature: "publicApi", entitled: false, recordedStatus: "suspended", implicit: false },
          { feature: "twilio", entitled: true, recordedStatus: null, implicit: true },
          { feature: "mailchimp", entitled: true, recordedStatus: null, implicit: true },
          { feature: "activecampaign", entitled: true, recordedStatus: null, implicit: true },
        ],
        "publicApi"
      )
    ).toBe(false);
  });

  it("commercialActivationFootnote: connettore Twilio senza entitlement ⇒ testo CTA Tecma", () => {
    const foot = commercialActivationFootnote(
      [
        { feature: "publicApi", entitled: true, recordedStatus: null, implicit: true },
        { feature: "twilio", entitled: false, recordedStatus: "suspended", implicit: false },
        { feature: "mailchimp", entitled: true, recordedStatus: null, implicit: true },
        { feature: "activecampaign", entitled: true, recordedStatus: null, implicit: true },
      ],
      "connector_twilio",
    );
    expect(foot).toContain("Tecma");
  });
});
