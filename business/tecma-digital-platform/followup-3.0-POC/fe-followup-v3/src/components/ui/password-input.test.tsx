import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("rende il campo e il pulsante mostra/nascondi", () => {
    render(<PasswordInput placeholder="Password" />);
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mostra password/i })).toBeInTheDocument();
  });

  it("cambia tipo input e aria-label al click su mostra/nascondi", async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);
    const toggle = screen.getByRole("button", { name: /mostra password/i });
    await user.click(toggle);
    expect(screen.getByRole("button", { name: /nascondi password/i })).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/password/i);
    expect(input).toHaveAttribute("type", "text");
  });

  it("è disabilitato quando disabled=true", () => {
    render(<PasswordInput placeholder="Password" disabled />);
    expect(screen.getByPlaceholderText(/password/i)).toBeDisabled();
  });
});
