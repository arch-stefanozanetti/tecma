import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../workspaces/workspace-entitlements.service.js", () => ({
  isWorkspaceEntitledToFeature: vi.fn(),
}));

import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";
import { createMarketingWorkflow } from "./marketing-automation.service.js";

describe("marketing-automation.service — entitlement mailchimp | activecampaign", () => {
  beforeEach(() => {
    vi.mocked(isWorkspaceEntitledToFeature).mockReset();
  });

  it("createMarketingWorkflow rifiuta se entrambi i moduli non abilitati", async () => {
    vi.mocked(isWorkspaceEntitledToFeature).mockResolvedValue(false);
    await expect(
      createMarketingWorkflow({
        workspaceId: "ws1",
        name: "wf",
        triggerEventType: "request.created",
        enabled: true,
        steps: [{ order: 1, delayMinutes: 0, channel: "email", templateBody: "ciao" }],
      }),
    ).rejects.toMatchObject({ name: "HttpError", statusCode: 403 });
    expect(isWorkspaceEntitledToFeature).toHaveBeenCalled();
  });
});
