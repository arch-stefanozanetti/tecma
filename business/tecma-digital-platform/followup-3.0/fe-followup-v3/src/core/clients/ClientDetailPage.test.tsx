import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ClientDetailPage } from "./ClientDetailPage";

const mocks = vi.hoisted(() => {
  const navigateMock = vi.fn();
  const useClientDetailDataMock = vi.fn();
  const api = {
    getClientCandidates: vi.fn(),
    listAdditionalInfos: vi.fn(),
    listEntityAssignments: vi.fn(),
    listWorkspaceUsers: vi.fn(),
    createClientAction: vi.fn(),
    getAuditForEntity: vi.fn(),
    getRequestActions: vi.fn(),
    getRequestTransitions: vi.fn(),
    assignEntity: vi.fn(),
    unassignEntity: vi.fn(),
    updateClient: vi.fn(),
    updateRequestStatus: vi.fn(),
    createRequestAction: vi.fn(),
    updateRequestAction: vi.fn(),
    deleteRequestAction: vi.fn(),
    queryCalendar: vi.fn(),
  };
  return { navigateMock, useClientDetailDataMock, api };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigateMock };
});

vi.mock("./useClientDetailData", () => ({
  useClientDetailData: mocks.useClientDetailDataMock,
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: mocks.api,
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

vi.mock("../../components/RequestStatusRoadmap", () => ({
  RequestStatusRoadmap: () => <div data-testid="request-roadmap" />,
}));

vi.mock("../calendar/CalendarEventFormDrawer", () => ({
  CalendarEventFormDrawer: () => null,
}));

const baseState = () => ({
  client: {
    _id: "c1",
    firstName: "Mario",
    lastName: "Rossi",
    fullName: "Mario Rossi",
    email: "mario@test.com",
    status: "lead",
    projectId: "p1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  setClient: vi.fn(),
  loading: false,
  error: null,
  requests: [],
  setRequests: vi.fn(),
  requestsLoading: false,
  reloadRequests: vi.fn(),
});

describe("ClientDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.getClientCandidates.mockResolvedValue({ data: [] });
    mocks.api.listAdditionalInfos.mockResolvedValue({ data: [] });
    mocks.api.listEntityAssignments.mockResolvedValue({ data: [] });
    mocks.api.listWorkspaceUsers.mockResolvedValue({ data: [] });
    mocks.api.createClientAction.mockResolvedValue({ ok: true });
    mocks.api.getAuditForEntity.mockResolvedValue({ data: [] });
    mocks.api.getRequestActions.mockResolvedValue({ actions: [] });
    mocks.api.getRequestTransitions.mockResolvedValue({ transitions: [] });
    mocks.api.assignEntity.mockResolvedValue({ ok: true });
    mocks.api.unassignEntity.mockResolvedValue({ ok: true });
    mocks.api.updateClient.mockResolvedValue({ client: baseState().client });
    mocks.api.updateRequestStatus.mockResolvedValue({ request: { _id: "r1", status: "new" } });
    mocks.api.createRequestAction.mockResolvedValue({ action: { _id: "a1" } });
    mocks.api.updateRequestAction.mockResolvedValue({ action: { _id: "a1" } });
    mocks.api.deleteRequestAction.mockResolvedValue({ ok: true });
    mocks.api.queryCalendar.mockResolvedValue({ data: [] });
  });

  const NoExtraRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/clients/c1"]}>
        <Routes>
          <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: NoExtraRouter }
    );

  it("mostra stato loading", async () => {
    mocks.useClientDetailDataMock.mockReturnValue({ ...baseState(), loading: true, client: null });
    renderPage();
    expect(await screen.findByText(/caricamento/i)).toBeInTheDocument();
  });

  it("mostra errore quando il client non è disponibile", async () => {
    mocks.useClientDetailDataMock.mockReturnValue({ ...baseState(), client: null, error: "Cliente non trovato" });
    renderPage();
    expect(await screen.findByText("Cliente non trovato")).toBeInTheDocument();
  });

  it("renderizza anagrafica cliente", async () => {
    mocks.useClientDetailDataMock.mockReturnValue(baseState());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Mario Rossi" })).toBeInTheDocument();
    expect(screen.getByText("mario@test.com")).toBeInTheDocument();
  });

  it("apre drawer modifica cliente", async () => {
    mocks.useClientDetailDataMock.mockReturnValue(baseState());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /modifica/i }));
    expect(await screen.findByText("Modifica cliente")).toBeInTheDocument();
  });
});
