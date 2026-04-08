import { describe, it, expect, render, screen } from "../../test-utils";
import { DateInput } from "./date-input";

describe("DateInput", () => {
  it("rende un trigger accessibile (calendario a comparsa)", () => {
    render(<DateInput aria-label="Data" />);
    expect(screen.getByRole("button", { name: /data/i })).toBeInTheDocument();
  });

  it("mostra icona calendario sul trigger", () => {
    const { container } = render(<DateInput aria-label="Data" />);
    const btn = screen.getByRole("button", { name: /data/i });
    expect(btn.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  it("accetta value e onChange", () => {
    render(<DateInput value="2025-01-15" onChange={() => {}} aria-label="Data" />);
    expect(screen.getByRole("button", { name: /data/i })).toHaveTextContent(/15 gennaio 2025/i);
  });

  it("supporta invalid come Input", () => {
    render(<DateInput invalid aria-label="Data" />);
    const btn = screen.getByRole("button", { name: /data/i });
    expect(btn.className).toMatch(/destructive|border-destructive/);
  });
});
