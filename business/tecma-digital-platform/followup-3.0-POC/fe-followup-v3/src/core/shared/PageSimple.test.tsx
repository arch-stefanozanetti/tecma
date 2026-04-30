import { describe, it, expect } from "vitest";
import { render, screen } from "../../test-utils";
import { PageSimple } from "./PageSimple";

describe("PageSimple", () => {
  it("rende title e description", () => {
    render(
      <PageSimple title="Titolo" description="Descrizione">
        <p>Contenuto</p>
      </PageSimple>
    );
    expect(screen.getByRole("heading", { name: /titolo/i })).toBeInTheDocument();
    expect(screen.getByText(/descrizione/i)).toBeInTheDocument();
    expect(screen.getByText("Contenuto")).toBeInTheDocument();
  });

  it("applica className al wrapper", () => {
    const { container } = render(
      <PageSimple title="T" description="D" className="custom-class">
        <span />
      </PageSimple>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
  });
});
