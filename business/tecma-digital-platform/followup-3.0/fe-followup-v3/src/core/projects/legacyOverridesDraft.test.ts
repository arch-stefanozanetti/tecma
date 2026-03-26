import { describe, expect, it } from "vitest";

describe("buildPutPayloadFromDraft", () => {
  it("serializza JSON e identity", async () => {
    const { buildPutPayloadFromDraft, emptyLegacyOverridesDraft } = await import("./legacyOverridesDraft");
    const d = emptyLegacyOverridesDraft();
    d.identityFields.displayName = "Test";
    d.manifestJson = JSON.stringify({ name: "PWA" }, null, 2);
    const r = buildPutPayloadFromDraft(d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.identityFields).toMatchObject({ displayName: "Test" });
      expect(r.payload.manifestConfig).toEqual({ name: "PWA" });
    }
  });

  it("rifiuta JSON invalido", async () => {
    const { buildPutPayloadFromDraft, emptyLegacyOverridesDraft } = await import("./legacyOverridesDraft");
    const d = emptyLegacyOverridesDraft();
    d.neurosalesJson = "{not json";
    const r = buildPutPayloadFromDraft(d);
    expect(r.ok).toBe(false);
  });
});

describe("buildLegacyOverridesDraftFromSources", () => {
  it("prende rawProject quando overrides assenti", async () => {
    const { buildLegacyOverridesDraftFromSources } = await import("./legacyOverridesDraft");
    const draft = buildLegacyOverridesDraftFromSources(null, {
      displayName: "From Raw",
      pageTitles: { tuning: "T" },
      enabledTools: [{ name: "FollowUp", enabled: true, version: "2", url: "", baseUrl: "/" }],
    });
    expect(draft.identityFields.displayName).toBe("From Raw");
    expect(draft.pageTitleRows).toEqual([{ key: "tuning", value: "T" }]);
    expect(draft.legacyEnabledTools[0]?.name).toBe("FollowUp");
  });
});
