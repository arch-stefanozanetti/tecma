import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CockpitPage } from "./CockpitPage";

vi.mock("../../api/followupApi", () => {
  const mockRes = { data: [], pagination: { total: 0 } };
  return {
    followupApi: {
      generateAiSuggestions: vi.fn().mockResolvedValue({ data: [], generatedAt: new Date().toISOString() }),
      queryCalendar: vi.fn().mockResolvedValue(mockRes),
      queryApartments: vi.fn().mockResolvedValue(mockRes),
      queryClients: vi.fn().mockResolvedValue(mockRes),
      queryRequests: vi.fn().mockResolvedValue(mockRes),
    },
  };
});
vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    email: "user@test.com",
    projects: [],
    workspaceId: "w1",
    selectedProjectIds: ["p1"]
  }))
}));

describe("CockpitPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina cockpit", () => {
    render(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);
    expect(document.body.textContent).toBeTruthy();
  });

  it("rende senza errore con workspaceId e projectIds", () => {
    const { container } = render(<CockpitPage workspaceId="w1" projectIds={["p1"]} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});