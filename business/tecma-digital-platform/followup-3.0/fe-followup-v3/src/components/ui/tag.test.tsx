import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tag } from "./tag";

describe("Tag", () => {
  it("rende il label", () => {
    render(<Tag label="Etichetta" data-testid="tag" />);
    expect(screen.getByTestId("tag")).toHaveTextContent("Etichetta");
  });

  it("mostra il pulsante dismiss quando dismissable e onDismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Tag label="Rimuovi" dismissable onDismiss={onDismiss} data-testid="tag" />
    );
    const removeBtn = screen.getByRole("button", { name: /rimuovi/i });
    expect(removeBtn).toBeInTheDocument();
    await user.click(removeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("chiama onTagClick quando si clicca sul tag (se fornito)", async () => {
    const user = userEvent.setup();
    const onTagClick = vi.fn();
    render(
      <Tag label="Clicca" onTagClick={onTagClick} data-testid="tag" />
    );
    const tag = screen.getByTestId("tag");
    expect(tag).toHaveAttribute("role", "button");
    await user.click(tag);
    expect(onTagClick).toHaveBeenCalledTimes(1);
  });

  it("mostra icon e risponde a Enter/Spazio quando clickable", async () => {
    const user = userEvent.setup();
    const onTagClick = vi.fn();
    render(
      <Tag label="Con icon" icon={<span data-testid="tag-icon">I</span>} onTagClick={onTagClick} />
    );
    expect(screen.getByTestId("tag-icon")).toBeInTheDocument();
    screen.getByTestId("tag").focus();
    await user.keyboard("{Enter}");
    expect(onTagClick).toHaveBeenCalled();
    await user.keyboard(" ");
    expect(onTagClick).toHaveBeenCalledTimes(2);
  });

  it("è disabilitato quando disabled=true", () => {
    render(<Tag label="Off" disabled dismissable onDismiss={vi.fn()} data-testid="tag" />);
    const tag = screen.getByTestId("tag");
    expect(tag.className).toMatch(/opacity-50|pointer-events-none/);
  });
});
