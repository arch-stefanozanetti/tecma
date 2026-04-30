import { describe, it, expect, render, screen } from "../../test-utils";
import { Badge } from "./badge";

describe("Badge", () => {
  it("rende il contenuto", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("applica variant default", () => {
    const { container } = render(<Badge>X</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/primary|bg-primary/);
  });

  it("applica variant secondary", () => {
    const { container } = render(<Badge variant="secondary">Y</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/secondary/);
  });

  it("applica variant destructive e outline", () => {
    render(<Badge variant="destructive">Err</Badge>);
    expect(screen.getByText("Err")).toBeInTheDocument();
    const { container } = render(<Badge variant="outline">Out</Badge>);
    expect((container.firstChild as HTMLElement).className).toMatch(/foreground|outline/);
  });
});
