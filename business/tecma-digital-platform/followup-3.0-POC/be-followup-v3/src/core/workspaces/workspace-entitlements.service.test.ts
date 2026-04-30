import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isWorkspaceEntitledToFeature,
  listEffectiveWorkspaceEntitlements,
  parseWorkspaceEntitlementFeature,
  upsertWorkspaceEntitlement,
} from "./workspace-entitlements.service.js";

const findOne = vi.fn();
const findToArray = vi.fn();
const updateOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne,
      find: () => ({ toArray: findToArray }),
      updateOne,
    }),
  }),
}));

describe("workspace-entitlements.service", () => {
  beforeEach(() => {
    findOne.mockReset();
    findToArray.mockReset();
    updateOne.mockReset();
  });

  it("parseWorkspaceEntitlementFeature accetta solo feature note", () => {
    expect(parseWorkspaceEntitlementFeature("publicApi")).toBe("publicApi");
    expect(parseWorkspaceEntitlementFeature("twilio")).toBe("twilio");
    expect(parseWorkspaceEntitlementFeature("reports")).toBe("reports");
    expect(parseWorkspaceEntitlementFeature("integrations")).toBe("integrations");
    expect(parseWorkspaceEntitlementFeature("unknown")).toBe(null);
  });

  it("isWorkspaceEntitledToFeature: assenza riga ⇒ true", async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(isWorkspaceEntitledToFeature("ws1", "publicApi")).resolves.toBe(true);
  });

  it("isWorkspaceEntitledToFeature: status active ⇒ true", async () => {
    findOne.mockResolvedValueOnce({ workspaceId: "ws1", feature: "twilio", status: "active" });
    await expect(isWorkspaceEntitledToFeature("ws1", "twilio")).resolves.toBe(true);
  });

  it("isWorkspaceEntitledToFeature: status suspended ⇒ false", async () => {
    findOne.mockResolvedValueOnce({ workspaceId: "ws1", feature: "twilio", status: "suspended" });
    await expect(isWorkspaceEntitledToFeature("ws1", "twilio")).resolves.toBe(false);
  });

  it("listEffectiveWorkspaceEntitlements unisce impliciti e righe", async () => {
    findToArray.mockResolvedValueOnce([
      { _id: "x", workspaceId: "ws1", feature: "twilio", status: "suspended", notes: "note commercio", createdAt: "a", updatedAt: "b" },
    ]);
    const list = await listEffectiveWorkspaceEntitlements("ws1");
    const twilio = list.find((e) => e.feature === "twilio");
    const pub = list.find((e) => e.feature === "publicApi");
    expect(twilio?.entitled).toBe(false);
    expect(twilio?.implicit).toBe(false);
    expect(twilio?.recordedNotes).toBe("note commercio");
    expect(pub?.implicit).toBe(true);
    expect(pub?.recordedNotes).toBeNull();
    expect(pub?.entitled).toBe(true);
  });

  it("upsertWorkspaceEntitlement chiama updateOne", async () => {
    updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    findOne.mockResolvedValueOnce({
      _id: { toHexString: () => "abc" },
      workspaceId: "ws1",
      feature: "publicApi",
      status: "inactive",
      notes: "",
      createdAt: "c",
      updatedAt: "u",
    });
    const row = await upsertWorkspaceEntitlement("ws1", "publicApi", { status: "inactive" });
    expect(updateOne).toHaveBeenCalled();
    expect(row.feature).toBe("publicApi");
    expect(row.status).toBe("inactive");
  });
});
