import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApartmentDetailPage } from "./ApartmentDetailPage";

const mocks = vi.hoisted(() => {
  const navigateMock = vi.fn();
  const useApartmentDetailDataMock = vi.fn();
  const api = {
    getApartmentPrices: vi.fn(),
    getApartmentInventory: vi.fn(),
    getAuditForEntity: vi.fn(),
    listEntityAssignments: vi.fn(),
    listWorkspaceUsers: vi.fn(),
    getApartmentCandidates: vi.fn(),
    assignEntity: vi.fn(),
    unassignEntity: vi.fn(),
    updateApartment: vi.fn(),
    createApartmentSalePrice: vi.fn(),
    createApartmentMonthlyRent: vi.fn(),
    updateApartmentSalePrice: vi.fn(),
    updateApartmentMonthlyRent: vi.fn(),
    upsertApartmentPriceCalendar: vi.fn(),
    getPriceAvailabilityMatrix: vi.fn(),
    getApartmentPriceCalendar: vi.fn(),
  };
  return { navigateMock, useApartmentDetailDataMock, api };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigateMock };
});

vi.mock("./useApartmentDetailData", () => ({
  useApartmentDetailData: mocks.useApartmentDetailDataMock,
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    apartments: mocks.api,
    getAuditForEntity: mocks.api.getAuditForEntity,
    listEntityAssignments: mocks.api.listEntityAssignments,
    listWorkspaceUsers: mocks.api.listWorkspaceUsers,
    getApartmentCandidates: mocks.api.getApartmentCandidates,
    assignEntity: mocks.api.assignEntity,
    unassignEntity: mocks.api.unassignEntity,
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["p1"],
    projects: [{ id: "p1", name: "Project 1", displayName: "Project 1" }],
    isAdmin: false,
  }),
}));

vi.mock("../../hooks/useWorkflowConfig", () => ({
  useWorkflowConfig: () => ({ statusLabelByCode: {}, statuses: [] }),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ toastError: vi.fn() }),
}));

vi.mock("../../components/MatchingCandidatesList", () => ({
  MatchingCandidatesList: () => <div data-testid="matching-candidates" />,
}));

const baseState = () => ({
  apartment: {
    _id: "a1",
    name: "Appartamento 1",
    code: "APT-001",
    status: "AVAILABLE",
    mode: "SELL",
    projectId: "p1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  setApartment: vi.fn(),
  loading: false,
  error: null,
  requests: [],
  setRequests: vi.fn(),
  requestsLoading: false,
  reloadRequests: vi.fn(),
});

describe("ApartmentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.getApartmentPrices.mockResolvedValue({ current: null, salePrices: [], monthlyRents: [] });
    mocks.api.getApartmentInventory.mockResolvedValue({ effectiveStatus: "available", lock: null });
    mocks.api.getAuditForEntity.mockResolvedValue({ data: [] });
    mocks.api.listEntityAssignments.mockResolvedValue({ data: [] });
    mocks.api.listWorkspaceUsers.mockResolvedValue({ data: [] });
    mocks.api.getApartmentCandidates.mockResolvedValue({ data: [] });
    mocks.api.assignEntity.mockResolvedValue({ ok: true });
    mocks.api.unassignEntity.mockResolvedValue({ ok: true });
    mocks.api.updateApartment.mockResolvedValue({ apartment: baseState().apartment });
    mocks.api.createApartmentSalePrice.mockResolvedValue({ ok: true });
    mocks.api.createApartmentMonthlyRent.mockResolvedValue({ ok: true });
    mocks.api.updateApartmentSalePrice.mockResolvedValue({ ok: true });
    mocks.api.updateApartmentMonthlyRent.mockResolvedValue({ ok: true });
    mocks.api.upsertApartmentPriceCalendar.mockResolvedValue({ ok: true });
    mocks.api.getPriceAvailabilityMatrix.mockResolvedValue({ units: [], dates: [], cells: {} });
    mocks.api.getApartmentPriceCalendar.mockResolvedValue([]);
  });

  const NoExtraRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/apartments/a1"]}>
        <Routes>
          <Route path="/apartments/:apartmentId" element={<ApartmentDetailPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: NoExtraRouter }
    );

  it("mostra stato loading", () => {
    mocks.useApartmentDetailDataMock.mockReturnValue({ ...baseState(), loading: true, apartment: null });
    renderPage();
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it("mostra errore quando l'appartamento non è disponibile", () => {
    mocks.useApartmentDetailDataMock.mockReturnValue({ ...baseState(), apartment: null, error: "Appartamento non trovato" });
    renderPage();
    expect(screen.getByText("Appartamento non trovato")).toBeInTheDocument();
  });

  it("renderizza header e prezzo fallback", async () => {
    mocks.useApartmentDetailDataMock.mockReturnValue(baseState());
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Appartamento 1" })).toBeInTheDocument();
    expect(screen.getByText("APT-001")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("apre drawer di modifica appartamento", async () => {
    mocks.useApartmentDetailDataMock.mockReturnValue(baseState());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /^modifica$/i }));
    expect(await screen.findByText("Modifica appartamento")).toBeInTheDocument();
  });
});
