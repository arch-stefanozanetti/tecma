import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "./test-utils";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

const PROJECT_SCOPE = {
  email: "user@test.com",
  role: "user" as string | null,
  isAdmin: false,
  workspaceId: "demo",
  selectedProjectIds: ["proj-1"],
  projects: [{ id: "proj-1", name: "Progetto 1", displayName: "P1" }],
};

vi.mock("./api/followupApi", () => ({
  followupApi: {
    listWorkspaceProjects: vi.fn().mockResolvedValue({ data: [] }),
    saveUserPreferences: vi.fn().mockResolvedValue(undefined),
    queryCalendar: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryRequests: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    generateAiSuggestions: vi.fn().mockResolvedValue({ generatedAt: "", data: [] }),
    getNotifications: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, perPage: 25, totalPages: 0 } }),
    clients: { queryClients: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }) },
    apartments: { queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }) },
  },
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      length: 0,
      key: () => null,
    });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      length: 0,
      key: () => null,
    });
    storage["followup3.accessToken"] = "test-token";
    storage["followup3.projectScope"] = JSON.stringify(PROJECT_SCOPE);
    Object.defineProperty(window, "location", {
      value: { replace: vi.fn(), href: "http://localhost/" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("con token e projectScope rende il layout principale", async () => {
    const NoExtraRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
      { wrapper: NoExtraRouter }
    );
    expect(await screen.findByRole("button", { name: /home/i })).toBeInTheDocument();
  });
});
