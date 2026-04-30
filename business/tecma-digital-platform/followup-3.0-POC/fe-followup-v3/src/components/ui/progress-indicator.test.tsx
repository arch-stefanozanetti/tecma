import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressIndicator } from "./progress-indicator";

describe("ProgressIndicator", () => {
  it("rende N barre di progresso", () => {
    render(
      <ProgressIndicator
        steps={3}
        currentStep={2}
        valueProgressBar={50}
        data-testid="progress-indicator"
      />
    );
    expect(screen.getByTestId("progress-indicator")).toBeInTheDocument();
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(3);
  });

  it("mostra label currentStep / steps quando showValue=true", () => {
    render(
      <ProgressIndicator
        steps={4}
        currentStep={2}
        valueProgressBar={30}
        showValue
      />
    );
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
  });
});
