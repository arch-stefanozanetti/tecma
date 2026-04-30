import { describe, expect, it, vi, beforeEach } from "vitest";

const envMock = vi.hoisted(() => ({
  ENV: {
    AUTH_PASSWORD_MIN_LENGTH: 12,
    AUTH_PASSWORD_REQUIRE_UPPERCASE: true,
    AUTH_PASSWORD_REQUIRE_LOWERCASE: true,
    AUTH_PASSWORD_REQUIRE_DIGIT: true,
    AUTH_PASSWORD_REQUIRE_SPECIAL: false,
  },
}));

vi.mock("../../config/env.js", () => envMock);

describe("passwordPolicy", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    envMock.ENV.AUTH_PASSWORD_MIN_LENGTH = 12;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_UPPERCASE = true;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_LOWERCASE = true;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_DIGIT = true;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_SPECIAL = false;
    vi.resetModules();
  });

  it("accepts strong password", async () => {
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("GoodPassword1Xx")).not.toThrow();
  });

  it("rejects short password", async () => {
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("Short1A")).toThrowError(/almeno 12 caratteri/);
  });

  it("rejects missing digit", async () => {
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("OnlyLettersAbCdEf")).toThrowError(/cifra/);
  });

  it("rejects missing uppercase", async () => {
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("lowercase12345")).toThrowError(/maiuscola/);
  });

  it("rejects missing lowercase", async () => {
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("UPPERCASE12345")).toThrowError(/minuscola/);
  });

  it("requires special character when enabled", async () => {
    envMock.ENV.AUTH_PASSWORD_MIN_LENGTH = 8;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_UPPERCASE = false;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_LOWERCASE = false;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_DIGIT = false;
    envMock.ENV.AUTH_PASSWORD_REQUIRE_SPECIAL = true;
    vi.resetModules();
    const { assertPasswordMeetsPolicy } = await import("./passwordPolicy.js");
    expect(() => assertPasswordMeetsPolicy("abcdefgh")).toThrowError(/carattere speciale/);
    expect(() => assertPasswordMeetsPolicy("abcdefg!")).not.toThrow();
  });
});
