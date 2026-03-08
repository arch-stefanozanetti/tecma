import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stepper } from "./stepper";

describe("Stepper", () => {
  it("rende il numero di step e le label", () => {
    render(
      <Stepper
        currentStep={1}
        steps={[
          { label: "Uno" },
          { label: "Due" },
          { label: "Tre" },
        ]}
        data-testid="stepper"
      />
    );
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.getByText("Uno")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText("Tre")).toBeInTheDocument();
  });

  it("mostra description sugli step quando fornita", () => {
    render(
      <Stepper
        steps={[
          { label: "Uno", description: "Desc uno" },
          { label: "Due" },
        ]}
        currentStep={0}
      />
    );
    expect(screen.getByText("Desc uno")).toBeInTheDocument();
  });

  it("accetta steps come numero", () => {
    render(<Stepper currentStep={0} steps={3} data-testid="stepper" />);
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
  });

  it("orientation vertical applica flex-col", () => {
    const { container } = render(
      <Stepper
        currentStep={1}
        steps={[{ label: "A" }, { label: "B" }]}
        orientation="vertical"
        data-testid="stepper"
      />
    );
    const stepper = screen.getByTestId("stepper");
    expect(stepper.className).toMatch(/flex-col/);
  });

  it("mostra step completato con check e step corrente", () => {
    render(
      <Stepper
        currentStep={1}
        steps={[
          { label: "Done", description: "First" },
          { label: "Current" },
        ]}
        data-testid="stepper"
      />
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});
