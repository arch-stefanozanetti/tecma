import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ButtonGroup } from "./button-group";
import { Button } from "./button";

describe("ButtonGroup", () => {
  it("rende i figli e ha role=group", () => {
    render(
      <ButtonGroup>
        <Button>A</Button>
        <Button>B</Button>
      </ButtonGroup>
    );
    const group = screen.getByRole("group");
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^a$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^b$/i })).toBeInTheDocument();
  });

  it("orientamento orizzontale applica classi inline-flex", () => {
    render(
      <ButtonGroup orientation="horizontal">
        <Button>Uno</Button>
      </ButtonGroup>
    );
    const group = screen.getByRole("group");
    expect(group.className).toMatch(/inline-flex/);
  });

  it("orientamento verticale applica flex-col gap", () => {
    render(
      <ButtonGroup orientation="vertical">
        <Button>Uno</Button>
      </ButtonGroup>
    );
    const group = screen.getByRole("group");
    expect(group.className).toMatch(/flex-col|gap-2/);
  });

  it("accetta figli non-Button (renderizzati come sono)", () => {
    render(
      <ButtonGroup>
        <button type="button">Native</button>
      </ButtonGroup>
    );
    expect(screen.getByRole("button", { name: /native/i })).toBeInTheDocument();
  });

  it("i pulsanti rispondono al click", async () => {
    const user = userEvent.setup();
    const onA = vi.fn();
    const onB = vi.fn();
    render(
      <ButtonGroup>
        <Button onClick={onA}>A</Button>
        <Button onClick={onB}>B</Button>
      </ButtonGroup>
    );
    await user.click(screen.getByRole("button", { name: /^a$/i }));
    await user.click(screen.getByRole("button", { name: /^b$/i }));
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledTimes(1);
  });
});
