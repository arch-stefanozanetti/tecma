import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveWhatsAppRoute } from "./whatsapp-route-resolver.js";

vi.mock("../connectors/meta-whatsapp-config.service.js", () => ({
  hasMetaWhatsAppConfig: vi.fn(),
}));

import { hasMetaWhatsAppConfig } from "../connectors/meta-whatsapp-config.service.js";

describe("resolveWhatsAppRoute", () => {
  beforeEach(() => {
    vi.mocked(hasMetaWhatsAppConfig).mockReset();
  });

  it("sceglie meta_whatsapp se la config Meta è presente", async () => {
    vi.mocked(hasMetaWhatsAppConfig).mockResolvedValue(true);
    await expect(resolveWhatsAppRoute("ws1")).resolves.toEqual({ primary: "meta_whatsapp" });
  });

  it("usa twilio se non c'è config Meta", async () => {
    vi.mocked(hasMetaWhatsAppConfig).mockResolvedValue(false);
    await expect(resolveWhatsAppRoute("ws1")).resolves.toEqual({ primary: "twilio" });
  });
});
