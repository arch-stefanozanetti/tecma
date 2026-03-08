import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "./alert";

describe("Alert", () => {
  it("rende variant neutral (default) con icona muted", () => {
    render(<Alert title="Titolo" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Titolo");
    expect(screen.getByRole("alert").className).toMatch(/bg-muted|text-muted/);
  });

  it("rende con action e children", () => {
    render(
      <Alert title="Titolo" action={<button type="button">Azione</button>}>
        Corpo messaggio
      </Alert>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Titolo");
    expect(screen.getByRole("alert")).toHaveTextContent("Corpo messaggio");
    expect(screen.getByRole("button", { name: /azione/i })).toBeInTheDocument();
  });

  it("chiama onClose al click su Chiudi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Alert title="Titolo" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /chiudi/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applica variant success", () => {
    render(<Alert variant="success" title="Ok" />);
    expect(screen.getByRole("alert").className).toMatch(/green|success/);
  });
});
