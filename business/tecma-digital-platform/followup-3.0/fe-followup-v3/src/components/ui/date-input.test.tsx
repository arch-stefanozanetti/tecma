import { describe, it, expect, render, screen } from "../../test-utils";
import { DateInput } from "./date-input";

describe("DateInput", () => {
  it("rende un input type=date", () => {
    render(<DateInput aria-label="Data" />);
    const input = screen.getByLabelText(/data/i);
    expect(input).toHaveAttribute("type", "date");
    expect(input).toBeInTheDocument();
  });

  it("mostra icona calendario (wrapper con type=date)", () => {
    const { container } = render(<DateInput />);
    const input = container.querySelector('input[type="date"]');
    expect(input).toBeInTheDocument();
    const wrapper = input?.closest("div");
    expect(wrapper?.querySelector("svg")).toBeInTheDocument();
  });

  it("accetta value e onChange", () => {
    render(<DateInput value="2025-01-15" onChange={() => {}} aria-label="Data" />);
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).toHaveValue("2025-01-15");
  });

  it("supporta invalid come Input", () => {
    const { container } = render(<DateInput invalid aria-label="Data" />);
    const wrapper = container.querySelector('input[type="date"]')?.closest("div");
    expect(wrapper?.className).toMatch(/destructive|border/);
  });
});
