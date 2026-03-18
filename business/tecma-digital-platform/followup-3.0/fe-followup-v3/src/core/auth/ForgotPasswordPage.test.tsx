import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen, userEvent } from "../../test-utils";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

const requestPasswordReset = vi.fn();
vi.mock("../../api/followupApi", () => ({
  followupApi: {
    requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
  },
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dopo invio mostra messaggio neutro (se registrato)", async () => {
    requestPasswordReset.mockResolvedValue({ ok: true });
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
    );
    await userEvent.type(screen.getByPlaceholderText(/email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /invia link/i }));
    expect(requestPasswordReset).toHaveBeenCalledWith("user@example.com");
    expect(
      await screen.findByText(/se l.*indirizzo è registrato/i)
    ).toBeInTheDocument();
  });

  it("mostra errore se la richiesta fallisce", async () => {
    requestPasswordReset.mockRejectedValue(new Error("Rate limit"));
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> }
    );
    await userEvent.type(screen.getByPlaceholderText(/email/i), "x@y.z");
    await userEvent.click(screen.getByRole("button", { name: /invia link/i }));
    expect(await screen.findByText("Rate limit")).toBeInTheDocument();
  });
});
