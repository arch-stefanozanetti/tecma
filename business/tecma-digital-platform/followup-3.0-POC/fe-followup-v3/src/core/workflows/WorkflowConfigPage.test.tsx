import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { WorkflowConfigPage } from "./WorkflowConfigPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWorkspaces: vi.fn().mockResolvedValue([{ _id: "w1", name: "Workspace 1" }]),
    listWorkflowsByWorkspace: vi.fn().mockResolvedValue({ workflows: [] }),
    getWorkflowWithStatesAndTransitions: vi.fn().mockResolvedValue({ states: [], transitions: [] }),
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

describe("WorkflowConfigPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(<WorkflowConfigPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
