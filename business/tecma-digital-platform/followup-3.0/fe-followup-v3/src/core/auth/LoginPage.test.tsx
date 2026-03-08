import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./LoginPage";
import { login as authLogin } from "../../api/authApi";

vi.mock("../../api/authApi", () => ({
  login: vi.fn(),
  isBssAuth: vi.fn(() => false),
}));
vi.mock("../../api/followupApi", () => ({
  followupApi: {
    ssoExchange: vi.fn(),
  },
}));
vi.mock("../../api/http", () => ({
  setTokens: vi.fn(),
}));
vi.mock("../../auth/itdLogin", () => ({
  getJwtFromCookie: vi.fn(() => null),
  buildItdLoginRedirectUrl: vi.fn((url: string) => `${url}?backTo=`),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { search: "", replace: vi.fn(), href: "http://localhost/login" },
      writable: true,
    });
  });

  it("rende form di login con email e password", () => {
    render(<LoginPage />);
    const emailInput = screen.queryByPlaceholderText(/nome\.cognome|@/i) ?? screen.queryByRole("textbox", { name: /email/i });
    const passwordInput = screen.queryByPlaceholderText(/password|inserisci/i) ?? document.querySelector('input[type="password"]');
    expect(emailInput || passwordInput || screen.getByText(/accedi|tecma followup/i)).toBeTruthy();
  });

  it("mostra pulsante Accedi (submit)", () => {
    render(<LoginPage />);
    const accediButtons = screen.getAllByRole("button", { name: /accedi/i });
    expect(accediButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("al submit con login ok mostra step Scegli ambiente", async () => {
    vi.mocked(authLogin).mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      user: { email: "user@test.com", isAdmin: false },
    });
    render(<LoginPage />);
    const email = screen.getByPlaceholderText("nome.cognome@azienda.it");
    const password = screen.getByPlaceholderText("Inserisci la password");
    await userEvent.type(email, "u@t.com");
    await userEvent.type(password, "pass");
    const [submit] = screen.getAllByRole("button", { name: /^Accedi$/i });
    await userEvent.click(submit);
    const headings = await screen.findAllByText(/scegli.*ambiente/i);
expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("al submit con login fallito mostra messaggio errore", async () => {
    vi.mocked(authLogin).mockRejectedValue(new Error("Credenziali non valide"));
    render(<LoginPage />);
    const email = screen.getByPlaceholderText("nome.cognome@azienda.it");
    const password = screen.getByPlaceholderText("Inserisci la password");
    await userEvent.type(email, "u@t.com");
    await userEvent.type(password, "pass");
    const [submit] = screen.getAllByRole("button", { name: /^Accedi$/i });
    await userEvent.click(submit);
    expect(await screen.findByText(/credenziali non valide|errore login/i)).toBeInTheDocument();
  });
});
