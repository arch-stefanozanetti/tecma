import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, CheckboxWithLabel } from "./checkbox";

describe("Checkbox", () => {
  it("rende unchecked e risponde al click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox onCheckedChange={onChange} aria-label="Test" />);
    const cb = screen.getByRole("checkbox", { name: /test/i });
    expect(cb).toHaveAttribute("aria-checked", "false");
    await user.click(cb);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("rende checked quando checked=true", () => {
    render(<Checkbox checked aria-label="Test" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("è disabilitato quando disabled=true", () => {
    render(<Checkbox disabled aria-label="Test" />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("applica variant muted e size default", () => {
    const { container } = render(
      <Checkbox variant="muted" size="default" aria-label="Test" />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/h-6 w-6/);
  });

  it("applica variant muted quando checked", () => {
    const { container } = render(
      <Checkbox variant="muted" checked aria-label="Test" />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/accent|muted|foreground/);
  });

  it("applica size sm (icon h-3 w-3)", () => {
    const { container } = render(
      <Checkbox size="sm" checked aria-label="Test" />
    );
    const btn = container.querySelector("button");
    expect(btn?.querySelector("svg")).toBeInTheDocument();
    expect(btn?.className).toMatch(/h-5|border/);
  });

  it("variant accent quando checked applica border-primary bg-primary", () => {
    const { container } = render(
      <Checkbox variant="accent" checked aria-label="Test" />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/border-primary|bg-primary/);
  });

  it("size default quando checked applica icon h-4 w-4", () => {
    const { container } = render(
      <Checkbox size="default" checked aria-label="Test" />
    );
    const svg = container.querySelector("button svg");
    expect(svg).toBeInTheDocument();
    const classAttr = typeof svg?.className === "string" ? svg.className : (svg as SVGElement).getAttribute("class") ?? "";
    expect(classAttr).toMatch(/h-4 w-4/);
  });

  it("applica invalid (ring destructive)", () => {
    const { container } = render(
      <Checkbox invalid aria-label="Test" />
    );
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/destructive|ring/);
  });
});

describe("CheckboxWithLabel", () => {
  it("rende label e checkbox", () => {
    render(<CheckboxWithLabel label="Accept terms" />);
    expect(screen.getByText("Accept terms")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("click sul label attiva il checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CheckboxWithLabel label="Accept" onCheckedChange={onChange} />
    );
    await user.click(screen.getByText("Accept"));
    expect(onChange).toHaveBeenCalled();
  });

  it("mostra (optional) e Required quando richiesto", () => {
    render(
      <CheckboxWithLabel
        label="Field"
        showOptional
        showRequiredError
      />
    );
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("accetta label come ReactNode (no aria-label string)", () => {
    render(
      <CheckboxWithLabel label={<span data-testid="custom-label">Custom</span>} />
    );
    expect(screen.getByTestId("custom-label")).toHaveTextContent("Custom");
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});
