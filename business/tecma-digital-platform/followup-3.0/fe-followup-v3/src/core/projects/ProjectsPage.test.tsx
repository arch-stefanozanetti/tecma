import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { ProjectsPage } from "./ProjectsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWorkspaceProjects: vi.fn().mockResolvedValue({ data: [] }),
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

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(<ProjectsPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
