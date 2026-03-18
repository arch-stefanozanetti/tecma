import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, userEvent } from "../../test-utils";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SetPasswordFromInvitePage } from "./SetPasswordFromInvitePage";

const setPasswordFromInvite = vi.fn();
vi.mock("../../api/followupApi", () => ({
  followupApi: {
    setPasswordFromInvite: (...a: unknown[]) => setPasswordFromInvite(...a),
  },
}));
const setTokens = vi.fn();
vi.mock("../../api/http", () => ({
  setTokens: (...a: unknown[]) => setTokens(...a),
}));

function renderWithToken(token: string) {
  const out = render(
    <MemoryRouter initialEntries={[`/set-password?token=${encodeURIComponent(token)}`]}>
      <Routes>
        <Route path="/set-password" element={<SetPasswordFromInvitePage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
  );
  return { ...out, fillPasswords: async (p1: string, p2: string) => {
    const inputs = document.querySelectorAll<HTMLInputElement>('form input[type="password"]');
    expect(inputs.length).toBe(2);
    await userEvent.type(inputs[0], p1);
    await userEvent.type(inputs[1], p2);
  } };
}

describe("SetPasswordFromInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("sessionStorage", { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() });
    Object.defineProperty(window, "location", {
      value: { replace: vi.fn(), href: "http://localhost/set-password?token=x" },
      writable: true,
      configurable: true,
    });
  });

  it("mostra errore se password troppo corta", async () => {
    const { fillPasswords } = renderWithToken("tok1");
    await fillPasswords("short", "short");
    await userEvent.click(screen.getByRole("button", { name: /attiva account/i }));
    expect(await screen.findByText(/almeno 8 caratteri/i)).toBeInTheDocument();
    expect(setPasswordFromInvite).not.toHaveBeenCalled();
  });

  it("mostra errore se le password non coincidono", async () => {
    const { fillPasswords } = renderWithToken("tok1");
    await fillPasswords("password123", "password456");
    await userEvent.click(screen.getByRole("button", { name: /attiva account/i }));
    expect(await screen.findByText(/non coincidono/i)).toBeInTheDocument();
  });

  it("in caso di successo chiama API, setTokens e redirect", async () => {
    setPasswordFromInvite.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      user: { email: "invited@test.local" },
    });
    const { fillPasswords } = renderWithToken("hex-token-abc");
    await fillPasswords("ValidPass99", "ValidPass99");
    await userEvent.click(screen.getByRole("button", { name: /attiva account/i }));
    await vi.waitFor(() => {
      expect(setPasswordFromInvite).toHaveBeenCalledWith({
        token: "hex-token-abc",
        password: "ValidPass99",
      });
    });
    expect(setTokens).toHaveBeenCalledWith("at", "rt");
    expect(window.location.replace).toHaveBeenCalledWith("/");
  });

  it("mostra errore API", async () => {
    setPasswordFromInvite.mockRejectedValue(new Error("Token scaduto"));
    const { fillPasswords } = renderWithToken("bad");
    await fillPasswords("ValidPass99", "ValidPass99");
    await userEvent.click(screen.getByRole("button", { name: /attiva account/i }));
    expect(await screen.findByText("Token scaduto")).toBeInTheDocument();
  });
});
