import { describe, it, expect, vi, render, screen, fireEvent } from "../../test-utils";
import { Slider } from "./slider";

describe("Slider", () => {
  it("rende input range con min/max/step di default", () => {
    render(<Slider data-testid="slider" />);
    const slider = screen.getByTestId("slider");
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveAttribute("step", "1");
  });

  it("accetta min, max, step custom", () => {
    render(<Slider min={10} max={200} step={5} data-testid="slider" />);
    const slider = screen.getByTestId("slider");
    expect(slider).toHaveAttribute("min", "10");
    expect(slider).toHaveAttribute("max", "200");
    expect(slider).toHaveAttribute("step", "5");
  });

  it("chiama onValueChange al change", () => {
    const onValueChange = vi.fn();
    render(<Slider onValueChange={onValueChange} data-testid="slider" />);
    const slider = screen.getByTestId("slider");
    fireEvent.change(slider, { target: { value: "50", valueAsNumber: 50 } });
    expect(onValueChange).toHaveBeenCalledWith(50);
  });

  it("chiama anche onChange quando fornito", () => {
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(
      <Slider onValueChange={onValueChange} onChange={onChange} data-testid="slider" />
    );
    const slider = screen.getByTestId("slider");
    fireEvent.change(slider, { target: { value: "25", valueAsNumber: 25 } });
    expect(onValueChange).toHaveBeenCalledWith(25);
    expect(onChange).toHaveBeenCalled();
  });

  it("è disabilitato quando disabled=true", () => {
    render(<Slider disabled data-testid="slider" />);
    expect(screen.getByTestId("slider")).toBeDisabled();
  });
});
