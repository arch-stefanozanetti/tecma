import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { waitFor } from "@testing-library/react";
import { render, screen } from "../../test-utils";
import { ReportsPage } from "./ReportsPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    runReport: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", selectedProjectIds: ["p1"] }),
}));

import { followupApi } from "../../api/followupApi";

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.runReport).mockResolvedValue({ data: [] });
  });

  it("rende la pagina con titolo Report", async () => {
    render(<ReportsPage />);
    expect(await screen.findByRole("heading", { name: /report/i })).toBeInTheDocument();
  });

  it("mostra selettore tipo report e pulsante Aggiorna", async () => {
    render(<ReportsPage />);
    await screen.findByRole("heading", { name: /report/i });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aggiorna/i })).toBeInTheDocument();
  });

  it("chiama runReport al mount con workspace e progetti", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.runReport).toHaveBeenCalledWith(
        "pipeline",
        expect.objectContaining({ workspaceId: "ws-1", projectIds: ["p1"] })
      );
    });
  });

  it("mostra pulsante Export CSV (disabilitato senza dati)", () => {
    render(<ReportsPage />);
    const exportBtn = screen.getByRole("button", { name: /export csv/i });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).toBeDisabled();
  });

  it("pulsante Aggiorna richiama runReport", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.runReport).toHaveBeenCalled();
    }, { timeout: 2000 });
    const n = vi.mocked(followupApi.runReport).mock.calls.length;
    screen.getByRole("button", { name: /aggiorna/i }).click();
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.length).toBeGreaterThan(n);
    }, { timeout: 2000 });
  });

  it("cambio tipo report richiama runReport con nuovo tipo", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.runReport).toHaveBeenCalled();
    }, { timeout: 2000 });
    const combobox = screen.getByRole("combobox");
    await userEvent.selectOptions(combobox, "clients_by_status");
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "clients_by_status")).toBe(true);
    }, { timeout: 2000 });
  });

  it("supporta i nuovi tipi activity_per_period, conversions_per_project, avg_times", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(followupApi.runReport).toHaveBeenCalled();
    }, { timeout: 2000 });
    const combobox = screen.getByRole("combobox");
    await userEvent.selectOptions(combobox, "activity_per_period");
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "activity_per_period")).toBe(true);
    }, { timeout: 2000 });
    await userEvent.selectOptions(combobox, "conversions_per_project");
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "conversions_per_project")).toBe(true);
    }, { timeout: 2000 });
    await userEvent.selectOptions(combobox, "avg_times");
    await waitFor(() => {
      expect(vi.mocked(followupApi.runReport).mock.calls.some((c) => c[0] === "avg_times")).toBe(true);
    }, { timeout: 2000 });
  });
});
