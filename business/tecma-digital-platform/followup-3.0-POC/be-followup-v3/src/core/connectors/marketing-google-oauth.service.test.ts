import { describe, it, expect, vi } from "vitest";
import {
  signMarketingGoogleOAuthState,
  verifyMarketingGoogleOAuthState,
} from "./marketing-google-oauth.service.js";

vi.mock("../../config/env.js", () => ({
  ENV: {
    MARKETING_OAUTH_STATE_SECRET: "test-marketing-state-secret-min-32-chars!!",
    AUTH_JWT_SECRET: "fallback-jwt",
    GOOGLE_MARKETING_CLIENT_ID: "",
    GOOGLE_MARKETING_CLIENT_SECRET: "",
    GOOGLE_MARKETING_REDIRECT_URI: "",
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
  },
}));

describe("marketing-google-oauth state", () => {
  it("roundtrips valid state", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const state = signMarketingGoogleOAuthState({
      workspaceId: "ws1",
      userId: "u1",
      exp,
      rnd: "abc123",
    });
    const parsed = verifyMarketingGoogleOAuthState(state);
    expect(parsed).toEqual({ workspaceId: "ws1", userId: "u1", exp, rnd: "abc123" });
  });

  it("rejects tampered signature", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const state = signMarketingGoogleOAuthState({
      workspaceId: "ws1",
      userId: "u1",
      exp,
      rnd: "x",
    });
    const tampered = state.slice(0, -1) + (state.endsWith("a") ? "b" : "a");
    expect(() => verifyMarketingGoogleOAuthState(tampered)).toThrow("Firma state OAuth non valida");
  });

  it("rejects expired state", () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const state = signMarketingGoogleOAuthState({
      workspaceId: "ws1",
      userId: "u1",
      exp,
      rnd: "x",
    });
    expect(() => verifyMarketingGoogleOAuthState(state)).toThrow("scaduto");
  });
});
