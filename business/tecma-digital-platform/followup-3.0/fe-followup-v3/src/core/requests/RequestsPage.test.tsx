import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { RequestsPage } from "./RequestsPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: "/requests",
      state: null,
      search: "",
      hash: "",
      key: "test",
    }),
  };
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryClientsLite: vi.fn().mockResolvedValue({ data: [] }),
    getRequestActions: vi.fn().mockResolvedValue({ actions: [] }),
    createRequest: vi.fn().mockResolvedValue({ request: {} }),
    updateRequestStatus: vi.fn().mockResolvedValue({ request: {} }),
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
