import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { ProjectAccessPage } from "./ProjectAccessPage";

vi.mock("../../api/authApi", () => ({
  me: vi.fn().mockResolvedValue({ email: "user@test.com" }),
}));

vi.mock("../../api/http", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getProjectsByEmail: vi.fn().mockResolvedValue({
      found: true,
      email: "user@test.com",
      projects: [
        { id: "p1", name: "Progetto 1", displayName: "P1" },
        { id: "p2-rent", name: "Progetto Rent", displayName: "Rent" },
      ],
      role: "user",
      isAdmin: false,
    }),
    getUserPreferences: vi.fn().mockResolvedValue({ found: true, workspaceId: "demo", selectedProjectIds: ["p1"] }),
    saveUserPreferences: vi.fn().mockResolvedValue(undefined),
    listWorkspaces: vi.fn().mockResolvedValue([]),
    listWorkspaceProjects: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  saveProjectScope: vi.fn(),
}));

describe("ProjectAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dopo il caricamento mostra titolo Seleziona i progetti", async () => {
    render(<ProjectAccessPage onCompleted={vi.fn()} />);
    const heading = await screen.findByRole("heading", { name: /seleziona i progetti/i });
    expect(heading).toBeInTheDocument();
  });

  it("mostra sezione Scegli i progetti con cui lavorare", async () => {
    render(<ProjectAccessPage onCompleted={vi.fn()} />);
    expect(await screen.findByText(/scegli i progetti/i)).toBeInTheDocument();
  });

  it("clic su Conferma chiama onCompleted", async () => {
    const onCompleted = vi.fn();
    render(<ProjectAccessPage onCompleted={onCompleted} />);
    await screen.findByRole("heading", { name: /seleziona i progetti/i });
    const confirmBtn = await screen.findByRole("button", { name: /entra in followup/i });
    await userEvent.click(confirmBtn);
    expect(onCompleted).toHaveBeenCalled();
  });

  it("con auth fail mostra Vai al login", async () => {
    const { me } = await import("../../api/authApi");
    vi.mocked(me).mockRejectedValueOnce(new Error("Unauthorized"));
    render(<ProjectAccessPage onCompleted={vi.fn()} />);
    const loginBtn = await screen.findByRole("button", { name: /vai al login/i });
    expect(loginBtn).toBeInTheDocument();
  });
});
