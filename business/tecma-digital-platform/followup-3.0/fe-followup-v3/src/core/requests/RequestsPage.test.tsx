import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../test-utils";
import { RequestsPage } from "./RequestsPage";

const mocks = vi.hoisted(() => ({
  queryRequestsMock: vi.fn(),
  queryClientsLiteMock: vi.fn(),
  queryApartmentsMock: vi.fn(),
  getRequestTransitionsMock: vi.fn(),
  getRequestActionsMock: vi.fn(),
  createRequestMock: vi.fn(),
  updateRequestStatusMock: vi.fn(),
  getRequestByIdMock: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: "/requests", state: null }),
  };
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    requests: {
      queryRequests: mocks.queryRequestsMock,
      queryClientsLite: mocks.queryClientsLiteMock,
      queryApartments: mocks.queryApartmentsMock,
      getRequestTransitions: mocks.getRequestTransitionsMock,
      getRequestActions: mocks.getRequestActionsMock,
      createRequest: mocks.createRequestMock,
      updateRequestStatus: mocks.updateRequestStatusMock,
      getRequestById: mocks.getRequestByIdMock,
      createRequestAction: vi.fn(),
      updateRequestAction: vi.fn(),
      deleteRequestAction: vi.fn(),
      revertRequestStatus: vi.fn(),
    },
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [{ id: "proj-1", name: "Project 1", displayName: "Project 1" }],
  }),
}));

describe("RequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRequestsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, perPage: 25, totalPages: 1 },
    });
    mocks.queryClientsLiteMock.mockResolvedValue({
      data: [{ _id: "c1", fullName: "Mario Rossi", email: "mario@example.com", projectId: "proj-1" }],
    });
    mocks.queryApartmentsMock.mockResolvedValue({
      data: [{ _id: "a1", code: "A-1", name: "Apartment 1" }],
      pagination: { total: 1, page: 1, perPage: 500, totalPages: 1 },
    });
    mocks.getRequestTransitionsMock.mockResolvedValue({ transitions: [] });
    mocks.getRequestActionsMock.mockResolvedValue({ actions: [] });
    mocks.createRequestMock.mockResolvedValue({ request: { _id: "r-created" } });
    mocks.updateRequestStatusMock.mockResolvedValue({ request: { _id: "r1", status: "contacted" } });
    mocks.getRequestByIdMock.mockResolvedValue({
      request: {
        _id: "r1",
        workspaceId: "ws-1",
        projectId: "proj-1",
        clientId: "c1",
        clientName: "Mario Rossi",
        apartmentId: "a1",
        apartmentCode: "A-1",
        status: "new",
        type: "sell",
        updatedAt: new Date().toISOString(),
      },
    });
  });

  it("rende la pagina con titolo Trattative", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(mocks.queryRequestsMock).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: /trattative/i })).toBeInTheDocument();
  });

  it("mostra pulsante Nuova trattativa e campo Cerca", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(mocks.queryRequestsMock).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /nuova trattativa/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cerca per id cliente/i)).toBeInTheDocument();
  });

  it("esegue ricerca e reset filtri", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(mocks.queryRequestsMock).toHaveBeenCalled());
    const searchInput = screen.getByPlaceholderText(/cerca per id cliente/i);

    fireEvent.change(searchInput, { target: { value: "c-42" } });
    fireEvent.click(screen.getByRole("button", { name: /^cerca$/i }));

    await waitFor(() => {
      expect(mocks.queryRequestsMock).toHaveBeenCalledWith(
        expect.objectContaining({ searchText: "c-42" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /azzera/i }));
    await waitFor(() => {
      expect(mocks.queryRequestsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchText: "" })
      );
    });
  });

  it("apre drawer nuova trattativa e carica clienti/appartamenti", async () => {
    render(<RequestsPage />);
    await waitFor(() => expect(mocks.queryRequestsMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /nuova trattativa/i }));

    await waitFor(() => expect(mocks.queryClientsLiteMock).toHaveBeenCalledWith("ws-1", ["proj-1"]));
    await waitFor(() =>
      expect(mocks.queryApartmentsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          projectIds: ["proj-1"],
          perPage: 500,
        })
      )
    );
  });
});
