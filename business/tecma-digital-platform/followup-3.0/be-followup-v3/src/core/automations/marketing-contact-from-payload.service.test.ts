import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveMarketingContactFromPayload } from "./marketing-contact-from-payload.service.js";

vi.mock("../requests/requests.service.js", () => ({
  getRequestById: vi.fn(),
}));
vi.mock("../clients/clients.service.js", () => ({
  getClientById: vi.fn(),
}));

import { getRequestById } from "../requests/requests.service.js";
import { getClientById } from "../clients/clients.service.js";

describe("resolveMarketingContactFromPayload", () => {
  beforeEach(() => {
    vi.mocked(getRequestById).mockReset();
    vi.mocked(getClientById).mockReset();
  });

  it("usa clientEmail diretto", async () => {
    const c = await resolveMarketingContactFromPayload("ws1", {
      clientEmail: "a@b.it",
      clientFirstName: "A",
      clientLastName: "B",
    });
    expect(c).toEqual({ email: "a@b.it", firstName: "A", lastName: "B" });
  });

  it("risolve da request + client", async () => {
    vi.mocked(getRequestById).mockResolvedValueOnce({
      request: { workspaceId: "ws1", clientId: "cid1" } as never,
    });
    vi.mocked(getClientById).mockResolvedValueOnce({
      client: {
        email: "c@d.it",
        firstName: "C",
        lastName: "D",
      } as never,
    });
    const c = await resolveMarketingContactFromPayload("ws1", {
      entityType: "request",
      entityId: "req1",
    });
    expect(c).toEqual({ email: "c@d.it", firstName: "C", lastName: "D" });
  });

  it("null se workspace mismatch", async () => {
    vi.mocked(getRequestById).mockResolvedValueOnce({
      request: { workspaceId: "other", clientId: "cid1" } as never,
    });
    await expect(
      resolveMarketingContactFromPayload("ws1", { entityType: "request", entityId: "req1" })
    ).resolves.toBeNull();
  });
});
