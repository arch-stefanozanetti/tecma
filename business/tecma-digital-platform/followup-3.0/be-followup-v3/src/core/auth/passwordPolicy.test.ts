import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertPasswordMeetsPolicy } from "./passwordPolicy.js";
import { HttpError } from "../../types/http.js";

vi.mock("../../config/env.js", () => ({
  ENV: {
    AUTH_PASSWORD_MIN_LENGTH: 12,
    AUTH_PASSWORD_REQUIRE_UPPERCASE: true,
    AUTH_PASSWORD_REQUIRE_LOWERCASE: true,
    AUTH_PASSWORD_REQUIRE_DIGIT: true,
    AUTH_PASSWORD_REQUIRE_SPECIAL: false
  }
}));

describe("passwordPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts strong password", () => {
    expect(() => assertPasswordMeetsPolicy("GoodPassword1Xx")).not.toThrow();
  });

  it("rejects short password", () => {
    expect(() => assertPasswordMeetsPolicy("Short1A")).toThrow(HttpError);
  });

  it("rejects missing digit", () => {
    expect(() => assertPasswordMeetsPolicy("OnlyLettersAbCdEf")).toThrow(HttpError);
  });
});
