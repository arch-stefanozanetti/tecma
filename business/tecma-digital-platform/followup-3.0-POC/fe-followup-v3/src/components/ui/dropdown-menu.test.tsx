import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("rende trigger e apre il menu al click", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Apri</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Etichetta</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => {}}>Voce 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Voce 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByRole("button", { name: /apri/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /apri/i }));
    expect(await screen.findByText("Etichetta")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /voce 1/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /voce 2/i })).toBeInTheDocument();
  });

  it("chiama onSelect quando si clicca su un item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Azione</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await user.click(screen.getByRole("button", { name: /menu/i }));
    const action = await screen.findByRole("menuitem", { name: /azione/i });
    await user.click(action);
    expect(onSelect).toHaveBeenCalled();
  });
});
