import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen, userEvent } from "../../test-utils";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UsersPage } from "./UsersPage";
import { followupApi } from "../../api/followupApi";

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    isAdmin: true,
    workspaceId: "w-admin",
    email: "admin@test.local",
    selectedProjectIds: [],
    projects: [],
  }),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }),
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listUsersWithVisibility: vi.fn(),
    listWorkspaces: vi.fn(),
    listWorkspaceProjects: vi.fn(),
    listWorkspaceUserProjects: vi.fn(),
    listEntityAssignmentsByUser: vi.fn(),
    addWorkspaceUserProject: vi.fn(),
    removeWorkspaceUserProject: vi.fn(),
    unassignEntity: vi.fn(),
    assignEntity: vi.fn(),
    inviteUser: vi.fn(),
    addWorkspaceUser: vi.fn(),
    updateWorkspaceUser: vi.fn(),
  },
}));

function renderUsers() {
  return render(
    <MemoryRouter initialEntries={["/users"]}>
      <Routes>
        <Route path="/users" element={<UsersPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
  );
}

describe("UsersPage — invito utente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.listUsersWithVisibility).mockResolvedValue({
      users: [
        {
          email: "already@registered.local",
          isAdmin: false,
          role: "collaborator",
          workspaces: [],
          projectIds: [],
        },
      ],
    });
    vi.mocked(followupApi.listWorkspaces).mockResolvedValue([
      { _id: "ws1", name: "Workspace Test" } as never,
    ]);
    vi.mocked(followupApi.listWorkspaceProjects).mockResolvedValue({
      data: [{ projectId: "proj-x", displayName: "Progetto X" }],
    });
    vi.mocked(followupApi.inviteUser).mockResolvedValue({ userId: "uid-new" });
    vi.mocked(followupApi.addWorkspaceUser).mockResolvedValue({ workspaceUser: {} } as never);
  });

  it("invita via email: chiama inviteUser e addWorkspaceUser", async () => {
    renderUsers();
    expect(await screen.findByText("already@registered.local")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /aggiungi utente/i }));
    expect(await screen.findByText(/aggiungi utente a workspace/i)).toBeInTheDocument();

    const combos = screen.getAllByRole("combobox");
    await userEvent.click(combos[0]);
    await userEvent.click(await screen.findByRole("option", { name: /workspace test/i }));

    await vi.waitFor(() => {
      expect(followupApi.listWorkspaceProjects).toHaveBeenCalledWith("ws1");
    });
    /* Un solo progetto: il select progetto è già valorizzato da useEffect */

    const emailInput = screen.getByPlaceholderText(/mario\.rossi/i);
    await userEvent.type(emailInput, "brandnew@invite.test");

    await userEvent.click(screen.getByRole("button", { name: /invita e aggiungi al workspace/i }));

    await vi.waitFor(() => {
      expect(followupApi.inviteUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "brandnew@invite.test",
          projectId: "proj-x",
          projectName: "Progetto X",
          roleLabel: "Collaborator",
        })
      );
    });
    expect(followupApi.addWorkspaceUser).toHaveBeenCalledWith("ws1", {
      userId: "brandnew@invite.test",
      role: "collaborator",
    });
  });

  it("mostra errore se inviteUser fallisce (es. 502)", async () => {
    vi.mocked(followupApi.inviteUser).mockRejectedValue(new Error("502 Bad Gateway"));
    renderUsers();
    await screen.findByText("already@registered.local");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi utente/i }));
    const combos = screen.getAllByRole("combobox");
    await userEvent.click(combos[0]);
    await userEvent.click(await screen.findByRole("option", { name: /workspace test/i }));
    await vi.waitFor(() => expect(followupApi.listWorkspaceProjects).toHaveBeenCalledWith("ws1"));
    await userEvent.type(screen.getByPlaceholderText(/mario\.rossi/i), "fail@invite.test");
    await userEvent.click(screen.getByRole("button", { name: /invita e aggiungi al workspace/i }));
    expect(await screen.findByText(/502 bad gateway/i)).toBeInTheDocument();
  });
});
