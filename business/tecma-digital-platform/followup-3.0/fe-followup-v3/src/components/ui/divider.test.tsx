import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Divider } from "./divider";

describe("Divider", () => {
  it("rende con ruolo separator", () => {
    render(<Divider data-testid="divider" />);
    const el = screen.getByTestId("divider");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("role", "separator");
  });

  it("default orientation è horizontal", () => {
    render(<Divider data-testid="divider" />);
    expect(screen.getByTestId("divider")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("applica orientation vertical", () => {
    render(<Divider orientation="vertical" data-testid="divider" />);
    expect(screen.getByTestId("divider")).toHaveAttribute("aria-orientation", "vertical");
  });
});
