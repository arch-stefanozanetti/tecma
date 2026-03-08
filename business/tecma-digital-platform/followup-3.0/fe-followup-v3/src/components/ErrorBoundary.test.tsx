import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../test-utils";
import { ErrorBoundary } from "./ErrorBoundary";

const Throw = () => {
  throw new Error("Test error");
};

describe("ErrorBoundary", () => {
  it("rende i children quando non c è errore", () => {
    render(
      <ErrorBoundary>
        <span data-testid="child">OK</span>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("OK");
  });

  it("mostra fallback custom se fornito", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div data-testid="custom">Custom fallback</div>}>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("Custom fallback");
    vi.restoreAllMocks();
  });

  it("mostra messaggio di errore e pulsanti quando nessun fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Throw />
      </ErrorBoundary>
    );
    expect(screen.getByText(/si è verificato un errore/i)).toBeInTheDocument();
    expect(screen.getByText(/ricarica pagina/i)).toBeInTheDocument();
    expect(screen.getByText(/torna al login/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Test error");
    vi.restoreAllMocks();
  });
});
