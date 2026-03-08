import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("rende il contenuto e risponde al click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Salva</Button>);
    const btn = screen.getByRole("button", { name: /salva/i });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("è disabilitato quando disabled=true", () => {
    render(<Button disabled>Salva</Button>);
    expect(screen.getByRole("button", { name: /salva/i })).toBeDisabled();
  });

  it("applica variant outline", () => {
    render(<Button variant="outline">Indietro</Button>);
    const btn = screen.getByRole("button", { name: /indietro/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/border/);
  });

  it("applica size sm", () => {
    render(<Button size="sm">Piccolo</Button>);
    const btn = screen.getByRole("button", { name: /piccolo/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/text-xs|h-8/);
  });

  it("rende as Child (Slot) con elemento custom", () => {
    render(
      <Button asChild>
        <a href="/link">Link come bottone</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: /link come bottone/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/link");
  });
});
