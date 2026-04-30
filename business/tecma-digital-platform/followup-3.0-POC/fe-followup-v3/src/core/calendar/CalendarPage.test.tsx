import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CalendarPage } from "./CalendarPage";
import { followupApi } from "../../api/followupApi";

beforeEach(() => {
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryCalendar: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    listWorkspaceUsers: vi.fn().mockResolvedValue({ data: [] }),
    queryClientsLite: vi.fn().mockResolvedValue({ data: [] }),
    apartments: {
      queryApartments: vi.fn().mockResolvedValue({ data: [] }),
    },
    getOutlookStatus: vi.fn().mockResolvedValue({ connected: true }),
    getOutlookCalendarEvents: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [],
    email: "user@test.com",
    hasPermission: () => true,
  }),
}));

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.getOutlookStatus).mockResolvedValue({ connected: true });
  });

  it("rende la pagina con titolo Calendario", async () => {
    render(<CalendarPage />);
    expect(await screen.findByRole("heading", { name: /calendario/i })).toBeInTheDocument();
  });

  it("mostra pulsante Oggi per navigazione", async () => {
    render(<CalendarPage />);
    await screen.findByRole("heading", { name: /calendario/i });
    expect(screen.getByRole("button", { name: /oggi/i })).toBeInTheDocument();
  });

  it("mostra avviso Outlook quando non collegato e integrations.read", async () => {
    vi.mocked(followupApi.getOutlookStatus).mockResolvedValueOnce({ connected: false });
    render(<CalendarPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/outlook non collegato/i);
    expect(screen.getByRole("link", { name: /apri integrazioni/i })).toHaveAttribute("href", "/integrations?tab=connettori");
  });
});
