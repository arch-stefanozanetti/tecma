import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  it("non rende contenuto quando chiuso", () => {
    render(
      <CommandPalette isOpen={false} onClose={vi.fn()} onSelectSection={vi.fn()} />
    );
    expect(screen.queryByPlaceholderText(/cerca|search/i)).not.toBeInTheDocument();
  });

  it("rende input di ricerca quando aperto", () => {
    render(
      <CommandPalette isOpen onClose={vi.fn()} onSelectSection={vi.fn()} />
    );
    expect(screen.getByPlaceholderText(/digita un comando/i)).toBeInTheDocument();
  });

  it("chiama onSelectSection quando si seleziona un comando", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CommandPalette isOpen onClose={vi.fn()} onSelectSection={onSelect} />
    );
    const btn = screen.getByRole("button", { name: /home/i });
    await user.click(btn);
    expect(onSelect).toHaveBeenCalledWith("cockpit");
  });
});
