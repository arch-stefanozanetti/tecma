import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { AssociateAptClientPage } from "./AssociateAptClientPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryClientsLite: vi.fn().mockResolvedValue({ data: [] }),
    queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryAssociations: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    createAssociation: vi.fn().mockResolvedValue({}),
  },
}));

describe("AssociateAptClientPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina Associa", async () => {
    render(<AssociateAptClientPage workspaceId="w1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /associa apt\/cliente/i })).toBeInTheDocument();
  });
});
