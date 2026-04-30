import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  postJson,
  getJson,
  putJson,
  patchJson,
  deleteJson,
  API_BASE_URL,
  HttpApiError
} from "./http";

const STORAGE_ACCESS = "followup3.accessToken";
const STORAGE_REFRESH = "followup3.refreshToken";

describe("http", () => {
  let sessionStorage: Record<string, string>;

  beforeEach(() => {
    sessionStorage = {};
    vi.stubGlobal(
      "sessionStorage",
      {
        getItem: (key: string) => sessionStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          sessionStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete sessionStorage[key];
        },
        clear: () => {
          sessionStorage = {};
        },
        length: 0,
        key: () => null
      }
    );
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("token storage", () => {
    it("getAccessToken e getRefreshToken ritornano null se vuoti", () => {
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it("setTokens salva access e refresh in sessionStorage", () => {
      setTokens("access1", "refresh1");
      expect(sessionStorage[STORAGE_ACCESS]).toBe("access1");
      expect(sessionStorage[STORAGE_REFRESH]).toBe("refresh1");
    });

    it("setTokens senza refreshToken non sovrascrive refresh", () => {
      setTokens("a1", "r1");
      setTokens("a2");
      expect(sessionStorage[STORAGE_ACCESS]).toBe("a2");
      expect(sessionStorage[STORAGE_REFRESH]).toBe("r1");
    });

    it("clearTokens rimuove entrambi i token", () => {
      setTokens("a", "r");
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });

    it("getAccessToken e getRefreshToken leggono da sessionStorage", () => {
      setTokens("my-access", "my-refresh");
      expect(getAccessToken()).toBe("my-access");
      expect(getRefreshToken()).toBe("my-refresh");
    });
  });

  describe("postJson / getJson", () => {
    beforeEach(() => setTokens("test-token"));

    it("postJson invoca fetch con method POST e body JSON", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const result = await postJson<{ ok: boolean }>("/test", { foo: "bar" });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/test`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ foo: "bar" })
        })
      );
      expect(result).toEqual({ ok: true });
    });

    it("getJson invoca fetch con method GET", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "1" }), { status: 200 })
      );

      const result = await getJson<{ id: string }>("/resource");

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/resource`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ id: "1" });
    });

    it("risposta 204 ritorna undefined", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(new Response(undefined, { status: 204 }));

      const result = await getJson<void>("/empty");

      expect(result).toBeUndefined();
    });

    it("risposta non ok lancia con messaggio", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response("Not found", { status: 404 })
      );

      await expect(getJson("/missing")).rejects.toThrow(/404|Not found/);
    });

    it("risposta JSON errore lancia HttpApiError con code e hint", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Policy",
            code: "PASSWORD_POLICY",
            hint: "Aggiungi un numero."
          }),
          { status: 400 }
        )
      );

      try {
        await getJson("/x");
        expect.fail("expected HttpApiError");
      } catch (e) {
        expect(e).toBeInstanceOf(HttpApiError);
        const he = e as HttpApiError;
        expect(he.status).toBe(400);
        expect(he.code).toBe("PASSWORD_POLICY");
        expect(he.hint).toBe("Aggiungi un numero.");
      }
    });

    it("fetch in errore lancia con messaggio utile", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(getJson("/x")).rejects.toThrow(/Impossibile raggiungere|network error/i);
    });
  });

  describe("putJson e patchJson e deleteJson", () => {
    beforeEach(() => setTokens("test-token"));

    it("putJson usa method PUT", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ saved: true }), { status: 200 })
      );

      await putJson("/r", { data: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PUT" })
      );
    });

    it("patchJson usa method PATCH", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await patchJson("/r/1", { name: "x" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("deleteJson usa method DELETE", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ deleted: true }), { status: 200 })
      );

      await deleteJson<{ deleted: boolean }>("/r/1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Authorization e path pubblici", () => {
    it("path pubblico non invia Authorization", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await postJson("/auth/login", { email: "a@b.c", password: "p" });

      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });

    it("path non pubblico con token invia Authorization Bearer", async () => {
      setTokens("secret-token");
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

      await getJson("/clients/query");

      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer secret-token");
    });
  });

  describe("401 con refresh token", () => {
    it("su 401 ritenta dopo refresh e ritorna il risultato", async () => {
      setTokens("old-access", "refresh-token");
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ accessToken: "new-access", refreshToken: "new-refresh" }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "1" }), { status: 200 })
        );

      const result = await getJson<{ id: string }>("/clients/1");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sessionStorage[STORAGE_ACCESS]).toBe("new-access");
      expect(result).toEqual({ id: "1" });
    });

    it("su 401 se refresh fallisce reindirizza e lancia", async () => {
      setTokens("old-access", "refresh-token");
      const replace = vi.fn();
      Object.defineProperty(window, "location", { value: { replace }, writable: true });
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(new Response("Invalid refresh", { status: 401 }));

      await expect(getJson("/clients/1")).rejects.toThrow(/Sessione scaduta|accesso/i);
      expect(replace).toHaveBeenCalledWith(expect.stringMatching(/\/login/));
    });
  });
});
