import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { PageTemplate } from "./PageTemplate";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    listWorkspaces: vi.fn().mockResolvedValue([{ _id: "ws1", name: "Workspace 1" }]),
  },
}));
vi.mock("../../api/http", () => ({
  clearTokens: vi.fn(),
  getRefreshToken: vi.fn()
}));
vi.mock("../../auth/projectScope", () => ({
  clearProjectScope: vi.fn(),
  WorkspaceOverrideProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("../../assets/itd-icons/logotipoTecma.svg", () => ({ default: "/mock-logotipo.svg" }));

const defaultProps = {
  section: "cockpit" as const,
  onSectionChange: vi.fn(),
  userEmail: "user@test.com",
  workspaceId: "w1",
  onChangeProjects: vi.fn(),
  projects: [{ id: "p1", name: "P1", displayName: "Progetto 1" }],
  selectedProjectIds: ["p1"],
  onSelectedProjectIdsChange: vi.fn(),
  children: <div data-testid="main-content">Contenuto</div>
};

describe("PageTemplate", () => {
  it("rende layout con sidebar e contenuto", () => {
    render(<PageTemplate {...defaultProps} />);
    expect(screen.getByTestId("main-content")).toHaveTextContent("Contenuto");
    expect(screen.getAllByRole("button", { name: /home/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /clienti/i })[0]).toBeInTheDocument();
  });

  it("mostra email utente in header", () => {
    render(<PageTemplate {...defaultProps} />);
    expect(screen.getByText(/user@test\.com|user/i)).toBeInTheDocument();
  });

  it("rende link/button per cambio sezione", () => {
    render(<PageTemplate {...defaultProps} />);
    const clienti = screen.getAllByRole("button", { name: /clienti/i })[0];
    expect(clienti).toBeInTheDocument();
  });

  it("con isAdmin mostra voce Workspaces in nav", async () => {
    render(<PageTemplate {...defaultProps} isAdmin={true} />);
    await userEvent.click(screen.getByRole("button", { name: /strumenti/i }));
    expect(screen.getByRole("button", { name: /workspaces/i })).toBeInTheDocument();
  });

  it("con progetti multipli mostra selettore progetti", () => {
    const props = {
      ...defaultProps,
      projects: [
        { id: "p1", name: "P1", displayName: "Progetto 1" },
        { id: "p2", name: "P2", displayName: "Progetto 2" },
      ],
      selectedProjectIds: ["p1"],
    };
    render(<PageTemplate {...props} />);
    expect(screen.getByTitle(/active projects/i)).toBeInTheDocument();
  });

  it("clic su Clienti chiama onSectionChange con clients", async () => {
    const onSectionChange = vi.fn();
    render(<PageTemplate {...defaultProps} onSectionChange={onSectionChange} />);
    await userEvent.click(screen.getAllByRole("button", { name: /clienti/i })[0]);
    expect(onSectionChange).toHaveBeenCalledWith("clients");
  });
});
