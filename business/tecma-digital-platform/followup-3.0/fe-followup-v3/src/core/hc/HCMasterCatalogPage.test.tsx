import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { HCMasterCatalogPage } from "./HCMasterCatalogPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryHCMaster: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    createHCMaster: vi.fn().mockResolvedValue({}),
    updateHCMaster: vi.fn().mockResolvedValue({}),
    deleteHCMaster: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("HCMasterCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina Catalogo HC", async () => {
    render(<HCMasterCatalogPage workspaceId="w1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /catalogo hc/i })).toBeInTheDocument();
  });
});
