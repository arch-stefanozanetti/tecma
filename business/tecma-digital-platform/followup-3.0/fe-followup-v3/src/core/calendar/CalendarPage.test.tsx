import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CalendarPage } from "./CalendarPage";

beforeEach(() => {
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryCalendar: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    selectedProjectIds: ["proj-1"],
    projects: [],
    hasPermission: () => true,
  }),
}));

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
