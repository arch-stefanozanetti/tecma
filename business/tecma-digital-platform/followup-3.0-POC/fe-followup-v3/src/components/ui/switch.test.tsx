import { describe, it, expect, vi, render, screen, userEvent } from "../../test-utils";
import { Switch } from "./switch";

describe("Switch", () => {
  it("rende come button (switch)", () => {
    render(<Switch aria-label="Toggle" />);
    const sw = screen.getByRole("switch", { name: /toggle/i });
    expect(sw).toBeInTheDocument();
  });

  it("è unchecked di default", () => {
    render(<Switch aria-label="T" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "unchecked");
  });

  it("è checked quando checked=true", () => {
    render(<Switch checked aria-label="T" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
  });

  it("chiama onCheckedChange al click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch onCheckedChange={onCheckedChange} aria-label="T" />);
    await user.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalled();
  });

  it("applica size e muted", () => {
    const { container } = render(<Switch size="lg" muted aria-label="T" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/h-8|w-16|muted/);
  });

  it("applica size sm", () => {
    const { container } = render(<Switch size="sm" aria-label="T" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/h-4|w-8/);
  });

  it("applica size md", () => {
    const { container } = render(<Switch size="md" aria-label="T" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/h-6|w-12/);
  });
});
