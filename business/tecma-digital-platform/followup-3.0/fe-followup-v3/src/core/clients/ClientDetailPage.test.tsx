import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ClientDetailPage } from "./ClientDetailPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getClientById: vi.fn().mockResolvedValue({
      client: {
        _id: "c1",
        fullName: "Mario Rossi",
        email: "mario@test.com",
        status: "lead",
        projectId: "p1",
        updatedAt: new Date().toISOString(),
      },
    }),
    getClientRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    listAdditionalInfos: vi.fn().mockResolvedValue({ data: [] }),
    getAuditForEntity: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, perPage: 25, total: 0, totalPages: 0 } }),
    listEntityAssignments: vi.fn().mockResolvedValue({ data: [] }),
    listWorkspaceUsers: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["p1"],
    projects: [],
    isAdmin: false,
  }),
}));

describe("ClientDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con clientId carica e mostra il cliente", async () => {
    render(
      <MemoryRouter initialEntries={["/clients/c1"]}>
        <Routes>
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Mario Rossi")).toBeInTheDocument();
  });

  it("mostra email e sezione dettagli cliente", async () => {
    render(
      <MemoryRouter initialEntries={["/clients/c1"]}>
        <Routes>
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("mario@test.com")).toBeInTheDocument();
  });
});
