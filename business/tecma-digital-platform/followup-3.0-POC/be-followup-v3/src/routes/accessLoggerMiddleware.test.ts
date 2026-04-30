import { describe, expect, it } from "vitest";
import { shouldSkipAccessLogWrite } from "./accessLoggerMiddleware.js";

describe("shouldSkipAccessLogWrite", () => {
  it("salta GET/HEAD su /v1/health", () => {
    expect(shouldSkipAccessLogWrite("GET", "/v1/health")).toBe(true);
    expect(shouldSkipAccessLogWrite("HEAD", "/v1/health")).toBe(true);
    expect(shouldSkipAccessLogWrite("GET", "/v1/health/")).toBe(true);
  });

  it("non salta altre route", () => {
    expect(shouldSkipAccessLogWrite("GET", "/v1/projects")).toBe(false);
    expect(shouldSkipAccessLogWrite("POST", "/v1/health")).toBe(false);
  });
});
