import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { ApprovalsPage } from "./ApprovalsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryAiActionDrafts: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    decideAiActionDraft: vi.fn().mockResolvedValue({}),
  },
}));

describe("ApprovalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la sezione AI Approval Queue", async () => {
    render(<ApprovalsPage workspaceId="ws-1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /AI Approval Queue/i })).toBeInTheDocument();
  });
});
