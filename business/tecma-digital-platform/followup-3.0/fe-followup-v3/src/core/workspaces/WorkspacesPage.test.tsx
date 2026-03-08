import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { MemoryRouter } from "react-router-dom";
import { WorkspacesPage } from "./WorkspacesPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWorkspaces: vi.fn().mockResolvedValue([]),
    getProjectsByEmail: vi.fn().mockResolvedValue({ found: true, projects: [] }),
    listWorkspaceProjects: vi.fn().mockResolvedValue({ data: [] }),
    createWorkspace: vi.fn().mockResolvedValue({}),
    updateWorkspace: vi.fn().mockResolvedValue({}),
    deleteWorkspace: vi.fn().mockResolvedValue({}),
    associateProjectToWorkspace: vi.fn().mockResolvedValue({}),
    dissociateProjectFromWorkspace: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({ email: "admin@test.com" }),
}));

describe("WorkspacesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = () =>
    render(
      <MemoryRouter>
        <WorkspacesPage />
      </MemoryRouter>
    );

  it("rende la pagina con titolo Workspaces", async () => {
    renderWithRouter();
    expect(await screen.findByRole("heading", { name: /workspaces/i })).toBeInTheDocument();
  });

  it("con listWorkspaces che ritorna dati mostra lista", async () => {
    const { followupApi } = await import("../../api/followupApi");
    vi.mocked(followupApi.listWorkspaces).mockResolvedValue([
      { _id: "ws1", name: "Workspace 1" },
      { _id: "ws2", name: "Workspace 2" },
    ]);
    renderWithRouter();
    expect(await screen.findByRole("heading", { name: /workspaces/i })).toBeInTheDocument();
    const items = await screen.findAllByText(/workspace 1|workspace 2/i);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
