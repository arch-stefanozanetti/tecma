import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authApi from "./authApi";
import * as followupApi from "./followupApi";
import * as bssAuthAdapter from "./bssAuthAdapter";

vi.mock("./followupApi");
vi.mock("./bssAuthAdapter");

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followupApi.followupApi.login).mockResolvedValue({
      mfaRequired: false,
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: "15m",
      user: { id: "1", email: "u@test.com", role: "user", isAdmin: false }
    });
    vi.mocked(followupApi.followupApi.me).mockResolvedValue({
      id: "1",
      email: "u@test.com",
      role: "user",
      isAdmin: false
    });
    vi.mocked(followupApi.followupApi.refresh).mockResolvedValue({
      accessToken: "at2",
      refreshToken: "rt2",
      expiresIn: "15m"
    });
  });

  describe("con Followup (VITE_USE_BSS_AUTH non true)", () => {
    it("login chiama followupApi.login e ritorna LoginResult", async () => {
      const result = await authApi.login("u@test.com", "pass");

      expect(followupApi.followupApi.login).toHaveBeenCalledWith("u@test.com", "pass");
      expect(bssAuthAdapter.loginBss).not.toHaveBeenCalled();
      expect(result).toEqual({
        step: "done",
        accessToken: "at",
        refreshToken: "rt",
        expiresIn: "15m",
        user: { id: "1", email: "u@test.com", role: "user", isAdmin: false }
      });
    });

    it("login con MFA ritorna step mfa", async () => {
      vi.mocked(followupApi.followupApi.login).mockResolvedValueOnce({
        mfaRequired: true,
        mfaToken: "mt",
        expiresIn: "5m"
      });
      const result = await authApi.login("u@test.com", "pass");
      expect(result).toEqual({ step: "mfa", mfaToken: "mt", expiresIn: "5m" });
    });

    it("completeMfaLogin chiama verifyMfaLogin", async () => {
      vi.mocked(followupApi.followupApi.verifyMfaLogin).mockResolvedValueOnce({
        accessToken: "at3",
        refreshToken: "rt3",
        expiresIn: "15m",
        user: { id: "1", email: "u@test.com", role: "user", isAdmin: false }
      });
      const r = await authApi.completeMfaLogin("mt", "123456");
      expect(followupApi.followupApi.verifyMfaLogin).toHaveBeenCalledWith("mt", "123456");
      expect(r.accessToken).toBe("at3");
    });

    it("me chiama followupApi.me", async () => {
      const result = await authApi.me();

      expect(followupApi.followupApi.me).toHaveBeenCalled();
      expect(result.email).toBe("u@test.com");
    });

    it("refresh chiama followupApi.refresh", async () => {
      const result = await authApi.refresh("rt");

      expect(followupApi.followupApi.refresh).toHaveBeenCalledWith("rt");
      expect(result.accessToken).toBe("at2");
    });

    it("isBssAuth ritorna false quando BSS non attivo", () => {
      expect(authApi.isBssAuth()).toBe(false);
    });
  });
});
