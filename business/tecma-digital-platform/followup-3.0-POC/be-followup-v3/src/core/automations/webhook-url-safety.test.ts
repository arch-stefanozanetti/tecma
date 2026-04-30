import { describe, it, expect } from "vitest";
import { assertSafeWebhookDeliveryUrl } from "./webhook-url-safety.js";
import { HttpError } from "../../types/http.js";

describe("assertSafeWebhookDeliveryUrl", () => {
  it("rifiuta IPv4 privati", async () => {
    await expect(assertSafeWebhookDeliveryUrl("https://10.0.0.1/hook")).rejects.toBeInstanceOf(HttpError);
  });

  it("rifiuta loopback", async () => {
    await expect(assertSafeWebhookDeliveryUrl("https://127.0.0.1/hook")).rejects.toBeInstanceOf(HttpError);
  });

  it("rifiuta URL non validi", async () => {
    await expect(assertSafeWebhookDeliveryUrl("not-a-url")).rejects.toBeInstanceOf(HttpError);
  });

  it("consente host pubblico HTTPS", async () => {
    await expect(assertSafeWebhookDeliveryUrl("https://example.com/path")).resolves.toBeUndefined();
  }, 15_000);
});
