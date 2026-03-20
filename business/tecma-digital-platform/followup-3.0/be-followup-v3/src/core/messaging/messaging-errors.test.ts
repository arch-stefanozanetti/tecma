import { describe, expect, it } from "vitest";
import { normalizeProviderError } from "./messaging-errors.js";

describe("normalizeProviderError", () => {
  it("maps 429 to RateLimited", () => {
    expect(normalizeProviderError({ status: 429, message: "too many requests" }).code).toBe("RateLimited");
  });

  it("maps twilio 63038 to RateLimited", () => {
    expect(normalizeProviderError({ code: 63038, message: "daily limit reached" }).code).toBe("RateLimited");
  });

  it("maps 5xx to ProviderUnavailable", () => {
    expect(normalizeProviderError({ status: 503, message: "upstream unavailable" }).code).toBe("ProviderUnavailable");
  });
});

