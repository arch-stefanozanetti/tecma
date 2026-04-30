import { describe, it, expect, render, screen } from "../../test-utils";
import { Progress } from "./progress";

describe("Progress", () => {
  it("rende con value e showLabel", () => {
    render(<Progress value={50} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("nasconde label quando showLabel=false", () => {
    render(<Progress value={30} showLabel={false} />);
    expect(screen.queryByText("30%")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("clampa value tra 0 e 100", () => {
    render(<Progress value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
