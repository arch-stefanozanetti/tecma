import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "../../test-utils";
import { ProductDiscoveryPage } from "./ProductDiscoveryPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getCustomerNeeds: vi.fn().mockResolvedValue([]),
    getOpportunities: vi.fn().mockResolvedValue([]),
    getInitiatives: vi.fn().mockResolvedValue([]),
    getFeatures: vi.fn().mockResolvedValue([]),
    getSuggestedRoadmap: vi.fn().mockResolvedValue([]),
    getTopProblems: vi.fn().mockResolvedValue([]),
  },
}));

describe("ProductDiscoveryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", async () => {
    const { container } = render(<ProductDiscoveryPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
