import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { ApartmentsPage } from "./ApartmentsPage";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    updateApartment: vi.fn().mockResolvedValue({ apartment: {} }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [],
  }),
}));

describe("ApartmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina con titolo Appartamenti", () => {
    render(<ApartmentsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Appartamenti" })).toBeInTheDocument();
  });

  it("mostra campo ricerca e pulsante Cerca", async () => {
    render(<ApartmentsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Appartamenti" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cerca per codice o nome/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cerca/i })).toBeInTheDocument();
  });
});
