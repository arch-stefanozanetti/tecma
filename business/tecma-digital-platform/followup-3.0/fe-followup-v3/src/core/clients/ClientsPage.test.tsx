import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../../test-utils";
import { ClientsPage } from "./ClientsPage";

const mocks = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  updateClientMock: vi.fn(),
  listAdditionalInfosMock: vi.fn(),
  setPageMock: vi.fn(),
  setSearchTextMock: vi.fn(),
  refetchMock: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../shared/usePaginatedList", () => ({
  usePaginatedList: () => ({
    data: [
      {
        _id: "c1",
        workspaceId: "ws-1",
        projectId: "proj-1",
        firstName: "Mario",
        lastName: "Rossi",
        fullName: "Mario Rossi",
        email: "mario@example.com",
        phone: "123",
        status: "lead",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    setPage: mocks.setPageMock,
    searchText: "",
    setSearchText: mocks.setSearchTextMock,
    isLoading: false,
    error: null,
    refetch: mocks.refetchMock,
  }),
}));

vi.mock("../../api/domains/clientsApi", () => ({
  clientsApi: {
    createClient: mocks.createClientMock,
    updateClient: mocks.updateClientMock,
    listAdditionalInfos: mocks.listAdditionalInfosMock,
    queryClients: vi.fn(),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [{ id: "proj-1", name: "Project 1", displayName: "Project 1" }],
  }),
}));

describe("ClientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAdditionalInfosMock.mockResolvedValue({ data: [] });
    mocks.createClientMock.mockResolvedValue({
      client: { _id: "c-new", firstName: "Nuovo", lastName: "Cliente", fullName: "Nuovo Cliente", projectId: "proj-1", status: "lead", updatedAt: new Date().toISOString() },
    });
    mocks.updateClientMock.mockResolvedValue({
      client: { _id: "c1", firstName: "Mario", lastName: "Rossi", fullName: "Mario Rossi", projectId: "proj-1", status: "lead", updatedAt: new Date().toISOString() },
    });
  });

  it("renderizza heading e controlli principali", async () => {
    render(<ClientsPage />);
    expect(screen.getByRole("heading", { name: /clienti/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aggiungi cliente/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nome, telefono o email/i)).toBeInTheDocument();
    await vi.waitFor(() => expect(mocks.listAdditionalInfosMock).toHaveBeenCalledWith("ws-1"));
  });

  it("naviga al dettaglio cliccando il cliente", async () => {
    render(<ClientsPage />);
    const links = screen.getAllByText("Mario Rossi");
    fireEvent.click(links[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/clients/c1");
  });

  it("esegue ricerca e reset", async () => {
    render(<ClientsPage />);
    fireEvent.change(screen.getByPlaceholderText(/nome, telefono o email/i), { target: { value: "rossi" } });
    fireEvent.click(screen.getByRole("button", { name: /^cerca$/i }));
    expect(mocks.setSearchTextMock).toHaveBeenCalledWith("rossi");

    fireEvent.click(screen.getByRole("button", { name: /azzera/i }));
    expect(mocks.setSearchTextMock).toHaveBeenCalledWith("");
  });

});
