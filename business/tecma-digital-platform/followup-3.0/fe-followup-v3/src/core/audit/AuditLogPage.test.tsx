import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { AuditLogPage } from "./AuditLogPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryAuditLog: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 25, total: 0, totalPages: 0 },
    }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", projects: [{ id: "p1", displayName: "Progetto 1", name: "Progetto 1" }] }),
}));

import { followupApi } from "../../api/followupApi";

describe("AuditLogPage", () => {
  const defaultAuditResponse = {
    data: [] as Array<{ _id: string; at: string; action: string; entityType: string; entityId: string; actor: { type: string; email?: string } }>,
    pagination: { page: 1, perPage: 25, total: 0, totalPages: 0 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.queryAuditLog).mockResolvedValue(defaultAuditResponse);
  });

  it("rende la pagina con titolo Audit log", async () => {
    render(<AuditLogPage />);
    expect(await screen.findByRole("heading", { name: /audit log/i })).toBeInTheDocument();
  });

  it("mostra filtri e pulsante Export CSV", async () => {
    render(<AuditLogPage />);
    await screen.findByRole("heading", { name: /audit log/i });
    expect(screen.getByRole("button", { name: /applica/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("con dati mostra tabella", async () => {
    vi.mocked(followupApi.queryAuditLog).mockResolvedValue({
      data: [
        {
          _id: "a1",
          at: new Date().toISOString(),
          action: "client.created",
          entityType: "client",
          entityId: "c1",
          actor: { type: "user", email: "admin@test.com" },
        },
      ],
      pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
    });
    render(<AuditLogPage />);
    expect(await screen.findByText("client.created")).toBeInTheDocument();
  });

  it("mostra Caricamento… mentre carica", async () => {
    const { followupApi } = await import("../../api/followupApi");
    let resolve: (v: unknown) => void;
    vi.mocked(followupApi.queryAuditLog).mockImplementation(
      () => new Promise((r) => { resolve = r; })
    );
    render(<AuditLogPage />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
    resolve!({ data: [], pagination: { page: 1, perPage: 25, total: 0, totalPages: 0 } });
    await screen.findByText(/nessun evento/i);
  });

  it("mostra Nessun evento quando data vuoto", async () => {
    render(<AuditLogPage />);
    expect(await screen.findByText(/nessun evento/i, { timeout: 3000 })).toBeInTheDocument();
  });

  it("Export CSV disabilitato quando non ci sono dati", async () => {
    render(<AuditLogPage />);
    await screen.findByText(/nessun evento/i, { timeout: 3000 });
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });

  it("Export CSV chiama createObjectURL quando ci sono dati", async () => {
    vi.mocked(followupApi.queryAuditLog).mockResolvedValue({
      data: [
        { _id: "a1", at: "2025-01-15T10:00:00Z", action: "client.created", entityType: "client", entityId: "c1", actor: { email: "a@b.c" } },
      ],
      pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
    });
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    render(<AuditLogPage />);
    await screen.findByText("client.created");
    screen.getByRole("button", { name: /export csv/i }).click();
    expect(createObjectURL).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("Applica è presente e queryAuditLog chiamato al mount", async () => {
    render(<AuditLogPage />);
    await screen.findByText(/nessun evento/i, { timeout: 3000 });
    expect(screen.getByRole("button", { name: /applica/i })).toBeInTheDocument();
    expect(followupApi.queryAuditLog).toHaveBeenCalled();
  });

  it("con pagination totale > 1 mostra Precedente e Successiva", async () => {
    vi.mocked(followupApi.queryAuditLog).mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 25, total: 50, totalPages: 2 },
    });
    render(<AuditLogPage />);
    expect(await screen.findByRole("button", { name: /precedente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /successiva/i })).toBeInTheDocument();
  });

  it("in caso di errore API mostra lista vuota", async () => {
    vi.mocked(followupApi.queryAuditLog).mockRejectedValue(new Error("Network error"));
    render(<AuditLogPage />);
    expect(await screen.findByText(/nessun evento/i, { timeout: 3000 })).toBeInTheDocument();
  });
});
