import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "../../test-utils";
import { ApartmentsPage } from "./ApartmentsPage";

const mocks = vi.hoisted(() => ({
  queryApartmentsMock: vi.fn(),
  updateApartmentMock: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../api/domains/apartmentsApi", () => ({
  apartmentsApi: {
    queryApartments: mocks.queryApartmentsMock,
    updateApartment: mocks.updateApartmentMock,
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
    mocks.queryApartmentsMock.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, perPage: 10, totalPages: 1 },
    });
    mocks.updateApartmentMock.mockResolvedValue({ apartment: { _id: "a1" } });
  });

  it("rende la pagina con titolo Appartamenti", async () => {
    render(<ApartmentsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Appartamenti" })).toBeInTheDocument();
    await vi.waitFor(() => expect(mocks.queryApartmentsMock).toHaveBeenCalled());
  });

  it("mostra campo ricerca e pulsante Cerca", async () => {
    render(<ApartmentsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Appartamenti" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cerca per codice o nome/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cerca/i })).toBeInTheDocument();
  });

  it("renderizza lista e naviga su click appartamento", async () => {
    mocks.queryApartmentsMock.mockResolvedValue({
      data: [
        {
          _id: "a1",
          workspaceId: "ws-1",
          projectId: "proj-1",
          code: "A-1",
          name: "Apartment 1",
          status: "AVAILABLE",
          mode: "SELL",
          surfaceMq: 70,
          normalizedPrice: { display: "€ 100.000" },
          updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { total: 1, page: 1, perPage: 10, totalPages: 1 },
    });

    render(<ApartmentsPage />);
    const aptCode = await screen.findByText("A-1");
    fireEvent.click(aptCode);
    expect(navigateMock).toHaveBeenCalledWith("/apartments/a1");
  });

  it("esegue ricerca e reset filtri", async () => {
    render(<ApartmentsPage />);
    fireEvent.change(screen.getByPlaceholderText(/cerca per codice o nome/i), { target: { value: "A-42" } });
    fireEvent.click(screen.getByRole("button", { name: /^cerca$/i }));

    await vi.waitFor(() =>
      expect(mocks.queryApartmentsMock).toHaveBeenCalledWith(expect.objectContaining({ searchText: "A-42" }))
    );

    fireEvent.click(screen.getByRole("button", { name: /azzera/i }));
    await vi.waitFor(() =>
      expect(mocks.queryApartmentsMock).toHaveBeenLastCalledWith(expect.objectContaining({ searchText: "" }))
    );
  });

  it("apre menu Altro con azioni operative", async () => {
    render(<ApartmentsPage />);
    fireEvent.click(screen.getByRole("button", { name: /altro/i }));
    expect(await screen.findByText(/importa excel/i)).toBeInTheDocument();
    expect(screen.getByText(/esporta excel/i)).toBeInTheDocument();
  });
});
