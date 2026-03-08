import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("rende navigazione con aria-label", () => {
    render(
      <Pagination page={1} totalPages={5} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole("navigation", { name: /paginazione/i })).toBeInTheDocument();
  });

  it("mostra pulsante prima pagina e ultima con layout complete", () => {
    render(
      <Pagination page={2} totalPages={10} layout="complete" onPageChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /prima pagina/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ultima pagina/i })).toBeInTheDocument();
  });

  it("chiama onPageChange al click su pagina successiva", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} totalPages={5} onPageChange={onPageChange} />
    );
    const next = screen.getByRole("button", { name: /pagina successiva|successiv/i });
    await user.click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disabilita prev sulla prima pagina", () => {
    render(
      <Pagination page={1} totalPages={5} onPageChange={vi.fn()} />
    );
    const prev = screen.getByRole("button", { name: /precedente|prec/i });
    expect(prev).toBeDisabled();
  });
});
