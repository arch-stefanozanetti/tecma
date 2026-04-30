import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CreateApartmentHCPage } from "./CreateApartmentHCPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryHCMaster: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryHCApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    getTemplateConfiguration: vi.fn().mockResolvedValue({ template: { sections: [] } }),
  },
}));

describe("CreateApartmentHCPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina Crea Appartamento HC", async () => {
    render(<CreateApartmentHCPage workspaceId="w1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /crea appartamento hc/i })).toBeInTheDocument();
  });
});
