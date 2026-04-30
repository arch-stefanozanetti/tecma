import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertMailchimpListMember } from "./marketing-external-lists.service.js";

vi.mock("../connectors/marketing-api-key-config.service.js", () => ({
  getMarketingConnectorSecrets: vi.fn(),
}));

import { getMarketingConnectorSecrets } from "../connectors/marketing-api-key-config.service.js";

describe("marketing-external-lists.service", () => {
  beforeEach(() => {
    vi.mocked(getMarketingConnectorSecrets).mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("upsertMailchimpListMember chiama Mailchimp con Basic auth", async () => {
    vi.mocked(getMarketingConnectorSecrets).mockResolvedValueOnce({ apiKey: "abc-us21" });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => "" } as Response);

    await upsertMailchimpListMember("ws1", "list1", { email: "U@Example.com", firstName: "U", lastName: "E" }, "subscribed");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("us21.api.mailchimp.com");
    expect(url).toContain("/lists/list1/members/");
    expect(init.method).toBe("PUT");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toMatch(/^Basic /);
  });
});
