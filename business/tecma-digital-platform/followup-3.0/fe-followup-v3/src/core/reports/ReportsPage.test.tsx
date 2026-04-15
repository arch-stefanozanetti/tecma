import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { waitFor } from "@testing-library/react";
import { render, screen, mockUseWorkspace } from "../../test-utils";
import { ReportsPage } from "./ReportsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    runReport: vi.fn().mockResolvedValue({ data: [] }),
    getRealtimeKpiSummary: vi.fn().mockResolvedValue({ data: [], source: "test" }),
    getRealtimeFunnel: vi.fn().mockResolvedValue({ data: [], source: "test" }),
    getRealtimeConversions: vi.fn().mockResolvedValue({ data: [], source: "test" }),
    subscribeRealtimeEvents: vi.fn(() => () => undefined),
    listSharedAiReportQueries: vi.fn().mockResolvedValue({ data: [] }),
    listReportDefinitions: vi.fn().mockResolvedValue({ data: [] }),
    queryCalendar: vi.fn().mockResolvedValue({ pagination: { total: 0 } }),
    queryRequests: vi.fn().mockResolvedValue({ pagination: { total: 0 } }),
    clients: { queryClients: vi.fn().mockResolvedValue({ pagination: { total: 0 } }) },
    runAiReportQuery: vi.fn(),
    shareAiReportQuery: vi.fn(),
    shareReportDefinitionSnapshot: vi.fn().mockResolvedValue({ data: { token: "t", url: "/x", expiresAt: "", snapshotId: "s" } }),
    revokeSharedAiReportQuery: vi.fn(),
    createReportDefinition: vi.fn().mockResolvedValue({ data: {} }),
    deleteReportDefinition: vi.fn().mockResolvedValue({ data: { deleted: true } }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () =>
    mockUseWorkspace({
      workspaceId: "ws-1",
      selectedProjectIds: ["p1"],
      projects: [{ id: "p1", name: "P1", displayName: "P1" }],
      permissions: ["reports.read", "reports.export"],
    }),
  updateSelectedProjectIds: vi.fn(),
}));

import { followupApi } from "../../api/followupApi";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.runReport).mockResolvedValue({ data: [] });
    vi.mocked(followupApi.getRealtimeKpiSummary).mockResolvedValue({ data: [], source: "test" });
    vi.mocked(followupApi.getRealtimeFunnel).mockResolvedValue({ data: [], source: "test" });
    vi.mocked(followupApi.getRealtimeConversions).mockResolvedValue({ data: [], source: "test" });
  });

  it("rende la pagina con titolo Report", async () => {
    render(<ReportsPage />);
    expect(await screen.findByRole("heading", { name: /report/i })).toBeInTheDocument();
  });

  it("mostra selettore tipo report e pulsante Aggiorna", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: /report/i });
    expect(screen.getByLabelText(/tipo report/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aggiorna/i })).toBeInTheDocument();
  });

  it("chiama getRealtimeKpiSummary al mount (persona owner → KPI)", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.getRealtimeKpiSummary).toHaveBeenCalledWith("ws-1", ["p1"]);
    });
  });

  it("mostra pulsante Export CSV (disabilitato senza dati)", () => {
    render(<ReportsPage />);
    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).toBeDisabled();
  });

  it("pulsante Aggiorna richiama di nuovo il caricamento report", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.getRealtimeKpiSummary).toHaveBeenCalled();
    }, { timeout: 2000 });
    const n = vi.mocked(followupApi.getRealtimeKpiSummary).mock.calls.length;
    screen.getByRole("button", { name: /aggiorna/i }).click();
    await waitFor(() => {
      expect(vi.mocked(followupApi.getRealtimeKpiSummary).mock.calls.length).toBeGreaterThan(n);
    }, { timeout: 2000 });
  });

  it("cambio tipo report a Clienti per stato usa realtime conversions senza date", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.getRealtimeKpiSummary).toHaveBeenCalled();
    }, { timeout: 2000 });
    await userEvent.click(screen.getByLabelText(/tipo report/i));
    await userEvent.click(await screen.findByRole("option", { name: /Clienti per stato/i }));
    await waitFor(() => {
      expect(followupApi.getRealtimeConversions).toHaveBeenCalledWith("ws-1", ["p1"]);
    }, { timeout: 2000 });
  });

  it("supporta i nuovi tipi activity_per_period, conversions_per_project, avg_times", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.getRealtimeKpiSummary).toHaveBeenCalled();
    }, { timeout: 2000 });
    const reportCombo = () => screen.getByLabelText(/tipo report/i);
    await userEvent.click(reportCombo());
    await userEvent.click(await screen.findByRole("option", { name: /Attività per periodo/i }));
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "activity_per_period")).toBe(true);
    }, { timeout: 2000 });
    await userEvent.click(reportCombo());
    await userEvent.click(await screen.findByRole("option", { name: /Conversioni per progetto/i }));
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "conversions_per_project")).toBe(true);
    }, { timeout: 2000 });
    await userEvent.click(reportCombo());
    await userEvent.click(await screen.findByRole("option", { name: /Tempi medi/i }));
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "avg_times")).toBe(true);
    }, { timeout: 2000 });
  });
});
