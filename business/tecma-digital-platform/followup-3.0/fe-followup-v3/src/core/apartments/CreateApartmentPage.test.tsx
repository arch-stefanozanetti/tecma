import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CreateApartmentPage } from "./CreateApartmentPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    createApartment: vi.fn().mockResolvedValue({ apartmentId: "apt-1", apartment: {} }),
  },
}));

describe("CreateApartmentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende il wizard step 1", () => {
    render(<CreateApartmentPage workspaceId="w1" projectIds={["p1"]} />);
    expect(screen.getByRole("heading", { name: /crea appartamento/i })).toBeInTheDocument();
  });
});
