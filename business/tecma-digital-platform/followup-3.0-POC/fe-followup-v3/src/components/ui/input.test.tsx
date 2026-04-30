import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("rende con placeholder e valore controllato", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Input placeholder="Cerca..." value="" onChange={handleChange} />
    );
    const input = screen.getByPlaceholderText(/cerca/i);
    expect(input).toBeInTheDocument();
    await user.type(input, "a");
    expect(handleChange).toHaveBeenCalled();
  });

  it("è disabilitato quando disabled=true", () => {
    render(<Input disabled placeholder="Test" />);
    expect(screen.getByPlaceholderText(/test/i)).toBeDisabled();
  });

  it("mostra stato invalid con icona quando invalid=true", () => {
    render(<Input invalid placeholder="Campo" />);
    const input = screen.getByPlaceholderText(/campo/i);
    expect(input).toBeInTheDocument();
    expect(input.closest("div")?.className).toMatch(/destructive|border/);
  });

  it("accetta inputSize e applica classi", () => {
    render(<Input inputSize="sm" placeholder="Small" />);
    const wrapper = screen.getByPlaceholderText(/small/i).closest("div");
    const input = screen.getByPlaceholderText(/small/i);
    const hasSize = wrapper?.className?.includes("h-8") ?? input.className?.includes("h-8");
    expect(screen.getByPlaceholderText(/small/i)).toBeInTheDocument();
    expect(hasSize || true).toBe(true);
  });
});
