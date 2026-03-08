import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Snackbar } from "./snackbar";

describe("Snackbar", () => {
  it("non rende nulla quando open=false", () => {
    render(
      <Snackbar open={false} onClose={vi.fn()} title="Nascosto" />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rende titolo e descrizione quando open=true", () => {
    render(
      <Snackbar
        open
        onClose={vi.fn()}
        title="Titolo"
        description="Descrizione"
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Titolo");
    expect(screen.getByRole("alert")).toHaveTextContent("Descrizione");
  });

  it("chiama onClose al click su chiudi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Snackbar open onClose={onClose} title="Chiudi" />);
    const closeBtn = screen.getByRole("button", { name: /chiudi/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applica anchorOrigin custom (center e right)", () => {
    render(
      <Snackbar
        open
        onClose={() => {}}
        title="Centro"
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Centro");
  });

  it("applica anchorOrigin horizontal right", () => {
    render(
      <Snackbar
        open
        onClose={() => {}}
        title="Destra"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    );
    expect(screen.getByText("Destra")).toBeInTheDocument();
  });

  it("chiama onClose dopo autoHideDuration", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <Snackbar
        open
        onClose={onClose}
        title="Auto"
        autoHideDuration={3000}
      />
    );
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
