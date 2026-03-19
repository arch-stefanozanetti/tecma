import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CustomerPortalPage } from "./CustomerPortalPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    portalExchangeMagicLink: vi.fn().mockResolvedValue({ accessToken: "test-token" }),
    portalGetOverview: vi.fn().mockResolvedValue({
      client: { id: "c1", fullName: "Test", email: "test@test.com" },
      deals: [],
      documents: [],
      timeline: [],
    }),
    portalLogout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("CustomerPortalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina senza crash", () => {
    render(<CustomerPortalPage />);
    expect(document.body.textContent).toBeTruthy();
  });
});
