import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginBss, meBss, refreshBss } from "./bssAuthAdapter";
import * as http from "./http";

vi.mock("./http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./http")>();
  return {
    ...actual,
    getAccessToken: vi.fn()
  };
});

describe("bssAuthAdapter", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    vi.mocked(http.getAccessToken).mockReturnValue(null);
  });

  describe("loginBss", () => {
    it("POST /login con email, password, project_id e mappa risposta", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: { accessToken: "at", refreshToken: "rt", expiresIn: "15m" },
            user: { id: "1", email: "u@t.com", role: "user" }
          }),
          { status: 200 }
        )
      );

      const result = await loginBss("u@t.com", "pass", "proj-1");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/login$/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "u@t.com",
            password: "pass",
            project_id: "proj-1"
          })
        })
      );
      expect(result).toEqual({
        accessToken: "at",
        refreshToken: "rt",
        expiresIn: "15m",
        user: { id: "1", email: "u@t.com", role: "user", isAdmin: false }
      });
    });

    it("lancia se risposta non ok", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      await expect(loginBss("a", "b", "p")).rejects.toThrow(/401|Unauthorized|fallito/i);
    });

    it("lancia se manca accessToken nella risposta", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ token: {}, user: { id: "1", email: "x", role: null } }),
          { status: 200 }
        )
      );

      await expect(loginBss("a", "b", "p")).rejects.toThrow("senza accessToken");
    });
  });

  describe("meBss", () => {
    it("richiede token e POST getUserByJWT", async () => {
      vi.mocked(http.getAccessToken).mockReturnValue("tk");
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "1", email: "me@t.com", role: "user" }),
          { status: 200 }
        )
      );

      const result = await meBss();

      expect(http.getAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/getUserByJWT/),
        expect.objectContaining({ method: "POST" })
      );
      expect(result.email).toBe("me@t.com");
    });

    it("lancia se non c è token", async () => {
      vi.mocked(http.getAccessToken).mockReturnValue(null);

      await expect(meBss()).rejects.toThrow("Nessun token");
    });
  });

  describe("refreshBss", () => {
    it("POST refresh-token e ritorna accessToken", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "new-at",
            refreshToken: "new-rt",
            expiresIn: "15m"
          }),
          { status: 200 }
        )
      );

      const result = await refreshBss("old-rt");

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/refresh-token/),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ refreshToken: "old-rt" })
        })
      );
      expect(result.accessToken).toBe("new-at");
      expect(result.refreshToken).toBe("new-rt");
    });

    it("lancia se risposta senza accessToken", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await expect(refreshBss("r")).rejects.toThrow("senza accessToken");
    });
  });
});
