import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { IntegrationsPage } from "./IntegrationsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWebhookConfigs: vi.fn().mockResolvedValue({ data: [] }),
    getN8nConfig: vi.fn().mockResolvedValue(null),
    getOutlookStatus: vi.fn().mockResolvedValue({ connected: false }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "w1",
    isAdmin: false,
    selectedProjectIds: ["p1"],
    projects: [],
  })),
}));

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", () => {
    const { container } = render(<IntegrationsPage workspaceId="w1" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
