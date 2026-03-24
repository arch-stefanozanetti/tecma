import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("keycloakOidc (config)", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
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
});
