import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { EmailFlowsPage } from "./EmailFlowsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listEmailFlows: vi.fn().mockResolvedValue([]),
    getEmailFlowSuggested: vi.fn().mockResolvedValue({ subject: "", bodyHtml: "" }),
    updateEmailFlow: vi.fn().mockResolvedValue(undefined),
    previewEmailFlow: vi.fn().mockResolvedValue({ html: "", subject: "" }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "w1",
    isAdmin: true,
    selectedProjectIds: ["p1"],
    projects: [],
  })),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ toastError: vi.fn(), toast: vi.fn() }),
}));

describe("EmailFlowsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(<EmailFlowsPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
