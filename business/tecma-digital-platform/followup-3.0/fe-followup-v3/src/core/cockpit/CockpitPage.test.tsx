import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, userEvent, waitFor, within } from "../../test-utils";
import { MemoryRouter } from "react-router-dom";
import { CockpitPage } from "./CockpitPage";
import { followupApi } from "../../api/followupApi";
import { ToastProvider } from "../../contexts/ToastContext";
import { HttpApiError } from "../../api/http";

const sampleSuggestion = {
  _id: "sugg-1",
  workspaceId: "w1",
  projectIds: ["p1"],
  title: "Cliente inattivo",
  reason: "Nessun aggiornamento da tempo",
  recommendedAction: "Contattare il cliente",
  risk: "high" as const,
  requiresApproval: true,
  status: "pending" as const,
  score: 80,
  createdAt: new Date().toISOString(),
};

vi.mock("../../api/followupApi", () => {
  const empty = { data: [], pagination: { total: 0 } };
  return {
    followupApi: {
      getAiSuggestions: vi.fn().mockResolvedValue({
        data: [],
        generatedAt: new Date().toISOString(),
        aiConfigured: true,
        llmUsed: false,
        fromCache: true,
      }),
      generateAiSuggestions: vi.fn().mockResolvedValue({
        data: [],
        generatedAt: new Date().toISOString(),
        aiConfigured: true,
        llmUsed: false,
        fromCache: false,
      }),
      executeAiSuggestion: vi.fn().mockResolvedValue({
        suggestionId: "sugg-1",
        summary: "Riepilogo breve dall'agente.",
        toolLog: [{ name: "search_clients", ok: true }],
        steps: 2,
      }),
      decideAiSuggestion: vi.fn().mockResolvedValue({}),
      queryCalendar: vi.fn().mockResolvedValue(empty),
      queryRequests: vi.fn().mockResolvedValue(empty),
      subscribeRealtimeEvents: vi.fn().mockReturnValue(() => {}),
      clients: { queryClients: vi.fn().mockResolvedValue(empty) },
      apartments: { queryApartments: vi.fn().mockResolvedValue(empty) },
    },
  };
});
vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    email: "user@test.com",
    projects: [],
    workspaceId: "w1",
    selectedProjectIds: ["p1"],
  })),
}));

function renderCockpit(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    ),
  });
}

describe("CockpitPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.getAiSuggestions).mockResolvedValue({
      data: [],
      generatedAt: new Date().toISOString(),
      aiConfigured: true,
      llmUsed: false,
      fromCache: true,
    });
    vi.mocked(followupApi.generateAiSuggestions).mockResolvedValue({
      data: [],
      generatedAt: new Date().toISOString(),
      aiConfigured: true,
      llmUsed: false,
      fromCache: false,
    });
    vi.mocked(followupApi.executeAiSuggestion).mockResolvedValue({
      suggestionId: "sugg-1",
      summary: "Riepilogo breve dall'agente.",
      toolLog: [{ name: "search_clients", ok: true }],
      steps: 2,
    });
  });

  it("rende la pagina cockpit", async () => {
    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);
    await waitFor(() => {
      expect(followupApi.getAiSuggestions).toHaveBeenCalled();
    });
    expect(document.body.textContent).toBeTruthy();
  });

  it("rende senza errore con workspaceId e projectIds", async () => {
    const { container } = renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);
    await waitFor(() => {
      expect(followupApi.getAiSuggestions).toHaveBeenCalled();
    });
    expect(container.firstChild).toBeInTheDocument();
  });

  it("mostra la lista priorità e apre il riepilogo dopo Esegui con AI", async () => {
    const user = userEvent.setup();
    vi.mocked(followupApi.getAiSuggestions).mockResolvedValue({
      data: [sampleSuggestion],
      generatedAt: new Date().toISOString(),
      aiConfigured: true,
      llmUsed: true,
      fromCache: true,
    });

    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);

    await waitFor(() => {
      expect(screen.getByTestId("priority-suggestions-list")).toBeInTheDocument();
    });
    expect(screen.getByText("Cliente inattivo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Esegui con AI/i }));

    await waitFor(() => {
      expect(screen.getByTestId("agent-execution-sheet")).toBeInTheDocument();
    });
    expect(screen.getByText("search_clients")).toBeInTheDocument();
    expect(screen.getByText(/Riepilogo breve dall'agente/i)).toBeInTheDocument();
    expect(screen.getByText(/Passi agente:\s*2/)).toBeInTheDocument();

    const snack = screen.getByTestId("snackbar");
    expect(within(snack).getByText("Esecuzione AI completata")).toBeInTheDocument();
    expect(snack.textContent).not.toMatch(/^AI:\s*.{80,}/);

    expect(followupApi.executeAiSuggestion).toHaveBeenCalledWith("sugg-1", {
      actorEmail: "user@test.com",
    });
  });

  it("Aggiorna suggerimenti chiama generateAiSuggestions", async () => {
    const user = userEvent.setup();
    vi.mocked(followupApi.getAiSuggestions).mockResolvedValue({
      data: [],
      generatedAt: new Date().toISOString(),
      aiConfigured: true,
      llmUsed: false,
      fromCache: true,
    });

    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Aggiorna suggerimenti/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Aggiorna suggerimenti/i }));

    await waitFor(() => {
      expect(followupApi.generateAiSuggestions).toHaveBeenCalledWith("w1", ["p1"], 8);
    });
  });

  it("mostra errore entitlement senza CTA configura AI", async () => {
    vi.mocked(followupApi.getAiSuggestions).mockRejectedValue(
      new HttpApiError("Funzionalità non abilitata per questo workspace", {
        status: 403,
        code: "FEATURE_NOT_ENTITLED",
      })
    );

    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} isAdmin />);

    await waitFor(() => {
      expect(
        screen.getByText(/Suggerimenti AI non disponibili: il modulo AI Approvals non è attivo su questo workspace/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Vai a Workspaces per configurare l'AI/i })).not.toBeInTheDocument();
  });

  it("mostra errore permessi 403 senza CTA configura AI", async () => {
    vi.mocked(followupApi.getAiSuggestions).mockRejectedValue(
      new HttpApiError("Accesso al workspace non consentito", {
        status: 403,
      })
    );

    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} isAdmin />);

    await waitFor(() => {
      expect(
        screen.getByText(/Non hai i permessi necessari per leggere i suggerimenti AI in questo workspace/i)
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Vai a Workspaces per configurare l'AI/i })).not.toBeInTheDocument();
  });

  it("mostra stato provider assente con CTA verso Workspaces", async () => {
    vi.mocked(followupApi.getAiSuggestions).mockResolvedValue({
      data: [],
      generatedAt: new Date().toISOString(),
      aiConfigured: false,
      llmUsed: null,
      fromCache: true,
    });

    renderCockpit(<CockpitPage workspaceId="w1" projectIds={["p1"]} isAdmin />);

    await waitFor(() => {
      expect(screen.getByText(/Nessun provider AI collegato/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Vai a Workspaces per collegare un provider AI/i })).toBeInTheDocument();
  });
});
