import { describe, it, expect, render, screen, userEvent } from "../../test-utils";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet";

describe("Sheet", () => {
  it("apre con trigger e mostra contenuto", async () => {
    const u = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Apri sheet</button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Titolo</SheetTitle>
            <SheetDescription>Descrizione</SheetDescription>
          </SheetHeader>
          <p>Body</p>
          <SheetFooter>Footer</SheetFooter>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByRole("button", { name: /apri sheet/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /apri sheet/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Titolo");
    expect(screen.getByRole("dialog")).toHaveTextContent("Body");
  });

  it("con defaultOpen mostra subito il dialog", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Già aperto</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Già aperto");
  });

  it("SheetContent side left rende il pannello", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent side="left">Contenuto left</SheetContent>
      </Sheet>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Contenuto left");
  });
});
