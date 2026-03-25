import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("keycloakOidc (config)", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    vi.unstubAllGlobals();
  });

  it("getKeycloakCallbackPath normalizza path senza slash iniziale", async () => {
    Object.assign(import.meta.env, {
      VITE_KEYCLOAK_URL: "",
      VITE_KEYCLOAK_REALM: "",
      VITE_KEYCLOAK_CLIENT_ID: "",
      VITE_KEYCLOAK_REDIRECT_PATH: "login/kc"
    });
    const { getKeycloakCallbackPath } = await import("./keycloakOidc");
    expect(getKeycloakCallbackPath()).toBe("/login/kc");
  });

  it("getKeycloakCallbackPath usa default /login/keycloak-callback se redirect assente", async () => {
    Object.assign(import.meta.env, {
      VITE_KEYCLOAK_URL: "",
      VITE_KEYCLOAK_REALM: "",
      VITE_KEYCLOAK_CLIENT_ID: "",
      VITE_KEYCLOAK_REDIRECT_PATH: ""
    });
    const { getKeycloakCallbackPath } = await import("./keycloakOidc");
    expect(getKeycloakCallbackPath()).toBe("/login/keycloak-callback");
  });

  it("isKeycloakOidcConfigured è false se manca una variabile", async () => {
    Object.assign(import.meta.env, {
      VITE_KEYCLOAK_URL: "https://kc.example",
      VITE_KEYCLOAK_REALM: "realm",
      VITE_KEYCLOAK_CLIENT_ID: ""
    });
    const { isKeycloakOidcConfigured } = await import("./keycloakOidc");
    expect(isKeycloakOidcConfigured()).toBe(false);
  });

  it("isKeycloakOidcConfigured è true con url, realm e client valorizzati", async () => {
    Object.assign(import.meta.env, {
      VITE_KEYCLOAK_URL: "https://kc.example",
      VITE_KEYCLOAK_REALM: "realm",
      VITE_KEYCLOAK_CLIENT_ID: "fe-client"
    });
    const { isKeycloakOidcConfigured } = await import("./keycloakOidc");
    expect(isKeycloakOidcConfigured()).toBe(true);
  });
});

describe("keycloakOidc (exchangeKeycloakAuthorizationCode)", () => {
  const originalEnv = { ...import.meta.env };
  const kcEnv = {
    VITE_KEYCLOAK_URL: "https://kc.example",
    VITE_KEYCLOAK_REALM: "realm",
    VITE_KEYCLOAK_CLIENT_ID: "fe-client",
    VITE_KEYCLOAK_REDIRECT_PATH: "/login/keycloak-callback"
  };

  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("restituisce errore se OIDC non configurato", async () => {
    Object.assign(import.meta.env, {
      VITE_KEYCLOAK_URL: "",
      VITE_KEYCLOAK_REALM: "",
      VITE_KEYCLOAK_CLIENT_ID: ""
    });
    const { exchangeKeycloakAuthorizationCode } = await import("./keycloakOidc");
    const r = await exchangeKeycloakAuthorizationCode(new URLSearchParams({ code: "x", state: "y" }));
    expect(r).toEqual({ ok: false, error: "Keycloak OIDC non configurato." });
  });

  it("restituisce errore OAuth da query ?error=", async () => {
    Object.assign(import.meta.env, kcEnv);
    const { exchangeKeycloakAuthorizationCode } = await import("./keycloakOidc");
    const r = await exchangeKeycloakAuthorizationCode(
      new URLSearchParams({ error: "access_denied", error_description: "User cancelled" })
    );
    expect(r).toEqual({ ok: false, error: "User cancelled" });
  });

  it("restituisce errore se mancano code o state", async () => {
    Object.assign(import.meta.env, kcEnv);
    const { exchangeKeycloakAuthorizationCode } = await import("./keycloakOidc");
    const r = await exchangeKeycloakAuthorizationCode(new URLSearchParams({ code: "only-code" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/code o state/i);
  });

  it("restituisce errore se state non coincide con sessionStorage", async () => {
    Object.assign(import.meta.env, kcEnv);
    sessionStorage.setItem("followup3.oidc_state", "expected");
    sessionStorage.setItem("followup3.oidc_code_verifier", "verifier");
    const { exchangeKeycloakAuthorizationCode } = await import("./keycloakOidc");
    const r = await exchangeKeycloakAuthorizationCode(new URLSearchParams({ code: "c", state: "wrong" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Sessione SSO/i);
  });

  it("scambia code con id_token quando il token endpoint risponde ok", async () => {
    Object.assign(import.meta.env, kcEnv);
    sessionStorage.setItem("followup3.oidc_state", "st1");
    sessionStorage.setItem("followup3.oidc_code_verifier", "pv");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: "mock.id.jwt" })
      })
    );

    const { exchangeKeycloakAuthorizationCode } = await import("./keycloakOidc");
    const r = await exchangeKeycloakAuthorizationCode(new URLSearchParams({ code: "auth-code", state: "st1" }));

    expect(r).toEqual({ ok: true, idToken: "mock.id.jwt" });
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/realms/realm/protocol/openid-connect/token");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("code_verifier=pv");
  });
});

describe("keycloakOidc (consumeStoredOidcBackTo)", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    sessionStorage.clear();
  });

  it("restituisce / se non c'è backTo salvato", async () => {
    Object.assign(import.meta.env, { VITE_KEYCLOAK_URL: "", VITE_KEYCLOAK_REALM: "", VITE_KEYCLOAK_CLIENT_ID: "" });
    const { consumeStoredOidcBackTo } = await import("./keycloakOidc");
    expect(consumeStoredOidcBackTo()).toBe("/");
  });

  it("consuma e restituisce il path salvato", async () => {
    Object.assign(import.meta.env, { VITE_KEYCLOAK_URL: "", VITE_KEYCLOAK_REALM: "", VITE_KEYCLOAK_CLIENT_ID: "" });
    sessionStorage.setItem("followup3.oidc_back_to", "/dashboard");
    const { consumeStoredOidcBackTo } = await import("./keycloakOidc");
    expect(consumeStoredOidcBackTo()).toBe("/dashboard");
    expect(sessionStorage.getItem("followup3.oidc_back_to")).toBeNull();
  });
});
