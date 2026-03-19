import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { PriceAvailabilityPage } from "./PriceAvailabilityPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getPriceAvailabilityMatrix: vi.fn().mockResolvedValue({ units: [], dates: [], cells: {} }),
    upsertApartmentPriceCalendar: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "w1",
    selectedProjectIds: ["p1"],
    projects: [],
  })),
}));

describe("PriceAvailabilityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(<PriceAvailabilityPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
