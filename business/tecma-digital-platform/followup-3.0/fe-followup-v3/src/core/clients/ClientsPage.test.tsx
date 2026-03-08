import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { ClientsPage } from "./ClientsPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryClients: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    createClient: vi.fn().mockResolvedValue(undefined),
    updateClient: vi.fn().mockResolvedValue({ client: {} }),
    listAdditionalInfos: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [],
  }),
}));

describe("ClientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza errore", () => {
    render(<ClientsPage />);
    expect(screen.getByRole("heading", { name: /clienti/i })).toBeInTheDocument();
  });

  it("mostra pulsante Aggiungi cliente e controlli", () => {
    render(<ClientsPage />);
    expect(screen.getByRole("button", { name: /aggiungi cliente/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nome, telefono o email/i)).toBeInTheDocument();
  });
});
