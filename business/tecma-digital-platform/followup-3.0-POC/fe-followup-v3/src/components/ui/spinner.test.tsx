import { describe, it, expect, render, screen } from "../../test-utils";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  it("rende con role status e aria-label", () => {
    render(<Spinner />);
    const el = screen.getByRole("status", { name: /caricamento/i });
    expect(el).toBeInTheDocument();
  });

  it("mostra testo sr-only Caricamento", () => {
    render(<Spinner />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  it("applica size sm, md, lg", () => {
    const { container } = render(<Spinner size="sm" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/size-4/);
    const { container: c2 } = render(<Spinner size="md" />);
    expect((c2.firstChild as HTMLElement).className).toMatch(/size-6/);
    const { container: c3 } = render(<Spinner size="lg" />);
    expect((c3.firstChild as HTMLElement).className).toMatch(/size-8/);
  });
});
