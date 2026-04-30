import { describe, it, expect } from "vitest";
import { render } from "../test-utils";
import { LogoTecma } from "./LogoTecma";

describe("LogoTecma", () => {
  it("rende un svg con viewBox e aria-hidden", () => {
    const { container } = render(<LogoTecma />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 48 48");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applica size di default 48", () => {
    const { container } = render(<LogoTecma />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("applica size custom", () => {
    const { container } = render(<LogoTecma size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("applica className", () => {
    const { container } = render(<LogoTecma className="h-12 w-12" />);
    const svg = container.querySelector("svg");
    const cls = typeof svg?.className === "string" ? svg.className : (svg as SVGElement)?.getAttribute?.("class") ?? "";
    expect(cls).toMatch(/h-12/);
  });

  it("applica fill custom", () => {
    const { container } = render(<LogoTecma fill="currentColor" />);
    const path = container.querySelector("path");
    expect(path).toHaveAttribute("fill", "currentColor");
  });
});
