import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { RequestsPage } from "./RequestsPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryClientsLite: vi.fn().mockResolvedValue({ data: [] }),
    createRequest: vi.fn().mockResolvedValue({ request: {} }),
    updateRequestStatus: vi.fn().mockResolvedValue({ request: {} }),
    getRequestActions: vi.fn().mockResolvedValue({ actions: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [],
  }),
}));

describe("RequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina con titolo Trattative", () => {
    render(<RequestsPage />);
    expect(screen.getByRole("heading", { name: /trattative/i })).toBeInTheDocument();
  });

  it("mostra pulsante Nuova trattativa e campo Cerca", async () => {
    render(<RequestsPage />);
    expect(screen.getByRole("heading", { name: /trattative/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuova trattativa/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cerca per id cliente/i)).toBeInTheDocument();
  });
});
