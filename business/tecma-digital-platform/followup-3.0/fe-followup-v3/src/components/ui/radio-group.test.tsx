import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, Radio } from "./radio-group";

describe("RadioGroup + Radio", () => {
  it("rende i radio e permette di selezionare un valore", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup name="test" value="b" onChange={onChange}>
        <Radio value="a" label="Opzione A" />
        <Radio value="b" label="Opzione B" />
      </RadioGroup>
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radioA = screen.getByRole("radio", { name: /opzione a/i });
    const radioB = screen.getByRole("radio", { name: /opzione b/i });
    expect(radioB).toBeChecked();
    expect(radioA).not.toBeChecked();
    await user.click(radioA);
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("rispetta disabled sul gruppo", () => {
    render(
      <RadioGroup name="test" disabled>
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    expect(screen.getByRole("radio")).toBeDisabled();
  });

  it("può essere usato con Radio fuori da RadioGroup (name su Radio)", () => {
    render(
      <div>
        <Radio name="solo" value="x" label="Solo" />
      </div>
    );
    const radio = screen.getByRole("radio", { name: /solo/i });
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute("name", "solo");
  });

  it("orientation vertical applica flex-col", () => {
    const { container } = render(
      <RadioGroup name="g" value="a" orientation="vertical">
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    const group = screen.getByRole("radiogroup");
    expect(group.className).toMatch(/flex-col/);
  });

  it("orientation horizontal applica flex-row", () => {
    const { container } = render(
      <RadioGroup name="g" value="a" orientation="horizontal">
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    const group = screen.getByRole("radiogroup");
    expect(group.className).toMatch(/flex-row/);
  });

  it("Radio senza label rende senza aria-labelledby", () => {
    render(
      <RadioGroup name="g" value="a">
        <Radio value="a" />
      </RadioGroup>
    );
    const radio = screen.getByRole("radio");
    expect(radio).toBeInTheDocument();
  });

  it("Radio fuori da RadioGroup senza name ha name vuoto", () => {
    render(
      <div>
        <Radio value="x" />
      </div>
    );
    const radio = screen.getByRole("radio");
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute("name", "");
  });
});
