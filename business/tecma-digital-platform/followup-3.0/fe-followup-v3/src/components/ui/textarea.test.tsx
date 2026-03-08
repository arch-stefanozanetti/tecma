import { describe, it, expect, render, screen } from "../../test-utils";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("rende textarea con placeholder", () => {
    render(<Textarea placeholder="Scrivi qui..." />);
    const ta = screen.getByPlaceholderText(/scrivi qui/i);
    expect(ta).toBeInTheDocument();
    expect(ta.tagName).toBe("TEXTAREA");
  });

  it("applica invalid (bordo rosso)", () => {
    const { container } = render(<Textarea invalid placeholder="X" />);
    const ta = container.querySelector("textarea");
    expect(ta?.className).toMatch(/destructive/);
  });

  it("mostra helperText nel footer", () => {
    render(<Textarea helperText="Max 500 caratteri" />);
    expect(screen.getByText("Max 500 caratteri")).toBeInTheDocument();
  });

  it("mostra character count quando maxLength e showWordCount", () => {
    render(<Textarea maxLength={100} defaultValue="hello" />);
    expect(screen.getByText("5/100")).toBeInTheDocument();
  });

  it("calcola currentLength da value controllato", () => {
    render(<Textarea value="ciao" maxLength={10} onChange={() => {}} />);
    expect(screen.getByText("4/10")).toBeInTheDocument();
  });

  it("è disabilitato e readOnly quando passati", () => {
    render(<Textarea disabled readOnly placeholder="X" />);
    const ta = screen.getByPlaceholderText(/^x$/i);
    expect(ta).toBeDisabled();
    expect(ta).toHaveAttribute("readonly");
  });
});
