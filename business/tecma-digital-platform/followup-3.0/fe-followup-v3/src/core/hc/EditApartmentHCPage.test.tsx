import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { EditApartmentHCPage } from "./EditApartmentHCPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryHCApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    getHCApartment: vi.fn().mockResolvedValue({ config: { selectedSectionCodes: [], formValues: {} } }),
    updateHCApartment: vi.fn().mockResolvedValue({}),
  },
}));

describe("EditApartmentHCPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina Modifica Appartamento HC", async () => {
    render(<EditApartmentHCPage workspaceId="w1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /modifica appartamento hc/i })).toBeInTheDocument();
  });
});
