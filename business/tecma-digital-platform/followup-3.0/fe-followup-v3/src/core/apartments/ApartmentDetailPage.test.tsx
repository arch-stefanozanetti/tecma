import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApartmentDetailPage } from "./ApartmentDetailPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getApartmentById: vi.fn().mockResolvedValue({
      apartment: {
        _id: "a1",
        name: "Appartamento 1",
        code: "APT-001",
        status: "AVAILABLE",
        mode: "SELL",
        projectId: "p1",
        updatedAt: new Date().toISOString(),
      },
    }),
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
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

describe("ApartmentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con apartmentId carica e mostra l'appartamento", async () => {
    render(
      <MemoryRouter initialEntries={["/apartments/a1"]}>
        <Routes>
          <Route path="/apartments/:apartmentId" element={<ApartmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Appartamento 1" })).toBeInTheDocument();
  });
});
