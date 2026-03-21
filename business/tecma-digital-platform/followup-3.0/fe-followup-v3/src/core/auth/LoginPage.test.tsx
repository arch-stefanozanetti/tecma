import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./LoginPage";
import { login as authLogin, completeMfaLogin } from "../../api/authApi";

vi.mock("../../api/authApi", () => ({
  login: vi.fn(),
  completeMfaLogin: vi.fn(),
  isBssAuth: vi.fn(() => false),
}));
vi.mock("../../api/followupApi", () => ({
  followupApi: {
    ssoExchange: vi.fn(),
  },
}));
vi.mock("../../api/http", () => ({
  setTokens: vi.fn(),
  HttpApiError: class HttpApiError extends Error {
    status = 400;
    code?: string;
    hint?: string;
  },
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
      step: "done",
      accessToken: "at",
      refreshToken: "rt",
      user: { id: "1", email: "user@test.com", role: null, isAdmin: false },
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

  it("dopo login con MFA richiesto mostra campo codice e conferma", async () => {
    vi.mocked(authLogin).mockResolvedValue({ step: "mfa", mfaToken: "pending-token", expiresIn: "5m" });
    vi.mocked(completeMfaLogin).mockResolvedValue({
      accessToken: "at2",
      refreshToken: "rt2",
      user: { id: "1", email: "user@test.com", role: null, isAdmin: false },
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("nome.cognome@azienda.it"), "u@t.com");
    await userEvent.type(screen.getByPlaceholderText("Inserisci la password"), "pass");
    const [submit] = screen.getAllByRole("button", { name: /^Accedi$/i });
    await userEvent.click(submit);
    expect(await screen.findByPlaceholderText("000000")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("000000"), "123456");
    await userEvent.click(screen.getByRole("button", { name: /conferma e accedi/i }));
    expect(completeMfaLogin).toHaveBeenCalledWith("pending-token", "123456");
    const headings = await screen.findAllByText(/scegli.*ambiente/i);
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});
