import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { KeycloakCallbackPage } from "./KeycloakCallbackPage";

const setTokensMock = vi.fn();
const ssoExchangeMock = vi.fn();
const isConfiguredMock = vi.fn();
const exchangeCodeMock = vi.fn();
const consumeBackToMock = vi.fn();

vi.mock("../../api/http", () => ({
  setTokens: (...args: unknown[]) => setTokensMock(...args),
}));

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    ssoExchange: (...args: unknown[]) => ssoExchangeMock(...args),
  },
}));

vi.mock("../../auth/keycloakOidc", () => ({
  isKeycloakOidcConfigured: () => isConfiguredMock(),
  exchangeKeycloakAuthorizationCode: (...args: unknown[]) => exchangeCodeMock(...args),
  consumeStoredOidcBackTo: () => consumeBackToMock(),
}));

function renderCallback(search = "") {
  return rtlRender(
    <MemoryRouter initialEntries={[`/login/keycloak-callback${search}`]}>
      <Routes>
        <Route path="/login/keycloak-callback" element={<KeycloakCallbackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("KeycloakCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConfiguredMock.mockReturnValue(false);
    exchangeCodeMock.mockResolvedValue({ ok: false, error: "unused" });
    consumeBackToMock.mockReturnValue("/");
  });

  it("senza Keycloak configurato mostra messaggio env", async () => {
    renderCallback();
    expect(await screen.findByText(/keycloak non è configurato/i)).toBeInTheDocument();
    expect(ssoExchangeMock).not.toHaveBeenCalled();
  });

  it("con exchange fallito mostra errore", async () => {
    isConfiguredMock.mockReturnValue(true);
    exchangeCodeMock.mockResolvedValue({ ok: false, error: "access_denied" });
    renderCallback("?code=x&state=y");
    expect(await screen.findByText(/access_denied/i)).toBeInTheDocument();
  });

  it("con exchange ok chiama sso-exchange e setTokens", async () => {
    isConfiguredMock.mockReturnValue(true);
    exchangeCodeMock.mockResolvedValue({ ok: true, idToken: "id.jwt" });
    ssoExchangeMock.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      user: { email: "u@test.com", isAdmin: false },
    });
    consumeBackToMock.mockReturnValue("/cockpit");
    const replace = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, replace, origin: "http://localhost:5177" },
      writable: true,
      configurable: true,
    });
    renderCallback("?code=c1&state=s1");

    await waitFor(() => {
      expect(ssoExchangeMock).toHaveBeenCalledWith("id.jwt");
    });
    await waitFor(() => {
      expect(setTokensMock).toHaveBeenCalledWith("at", "rt");
    });
    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
  });
});
