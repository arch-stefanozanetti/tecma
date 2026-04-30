import { describe, it, expect, vi, render, screen, userEvent } from "../../test-utils";
import { Accordion, AccordionItem } from "./accordion";

describe("Accordion", () => {
  it("rende i children", () => {
    render(
      <Accordion>
        <AccordionItem title="Sezione 1" open>Contenuto 1</AccordionItem>
      </Accordion>
    );
    expect(screen.getByText("Sezione 1")).toBeInTheDocument();
    expect(screen.getByText("Contenuto 1")).toBeInTheDocument();
  });

  it("applica className", () => {
    const { container } = render(
      <Accordion className="custom">
        <AccordionItem title="T">X</AccordionItem>
      </Accordion>
    );
    expect(container.firstChild).toHaveClass("custom");
  });
});

describe("AccordionItem", () => {
  it("mostra contenuto quando open=true, nascosto quando open=false", () => {
    const { rerender } = render(
      <AccordionItem title="Apri" open={false}>Nascosto</AccordionItem>
    );
    expect(screen.queryByText("Nascosto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apri/i })).toHaveAttribute("aria-expanded", "false");
    rerender(
      <AccordionItem title="Apri" open>Nascosto</AccordionItem>
    );
    expect(screen.getByText("Nascosto")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("chiama onOpenChange al click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <AccordionItem title="T" onOpenChange={onOpenChange}>
        C
      </AccordionItem>
    );
    await user.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("con type=border applica bordo", () => {
    const { container } = render(
      <AccordionItem title="T" type="border">C</AccordionItem>
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toMatch(/border/);
  });

  it("disabilitato non risponde al click", () => {
    render(
      <AccordionItem title="T" disabled>
        C
      </AccordionItem>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("mostra actionOpen e actionClose quando open", () => {
    render(
      <AccordionItem title="T" open actionOpen={<span>See all</span>} actionClose={<span>See less</span>}>
        C
      </AccordionItem>
    );
    expect(screen.getByText("See all")).toBeInTheDocument();
    expect(screen.getByText("See less")).toBeInTheDocument();
  });
});
