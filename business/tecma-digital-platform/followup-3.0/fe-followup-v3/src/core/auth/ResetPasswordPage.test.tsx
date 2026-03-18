import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, userEvent } from "../../test-utils";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResetPasswordPage } from "./ResetPasswordPage";

const resetPassword = vi.fn();
vi.mock("../../api/followupApi", () => ({
  followupApi: {
    resetPassword: (t: string, p: string) => resetPassword(t, p),
  },
}));

async function fillResetPasswords(p1: string, p2: string) {
  const inputs = document.querySelectorAll<HTMLInputElement>('form input[type="password"]');
  expect(inputs.length).toBe(2);
  await userEvent.type(inputs[0], p1);
  await userEvent.type(inputs[1], p2);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validazione lunghezza e conferma", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=tok"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
    );
    await fillResetPasswords("a", "a");
    await userEvent.click(screen.getByRole("button", { name: /salva password/i }));
    expect(await screen.findByText(/almeno 8 caratteri/i)).toBeInTheDocument();
  });

  it("successo: chiama resetPassword e mostra link al login", async () => {
    resetPassword.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/reset-password?token=reset-tok-1"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
    );
    await fillResetPasswords("NewSecure99", "NewSecure99");
    await userEvent.click(screen.getByRole("button", { name: /salva password/i }));
    await vi.waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith("reset-tok-1", "NewSecure99");
    });
    expect(await screen.findByText(/password aggiornata/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vai al login/i })).toHaveAttribute("href", "/login");
  });

  it("errore API", async () => {
    resetPassword.mockRejectedValue(new Error("Token non valido"));
    render(
      <MemoryRouter initialEntries={["/reset-password?token=bad"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
    );
    await fillResetPasswords("NewSecure99", "NewSecure99");
    await userEvent.click(screen.getByRole("button", { name: /salva password/i }));
    expect(await screen.findByText("Token non valido")).toBeInTheDocument();
  });
});
