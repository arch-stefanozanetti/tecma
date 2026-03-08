import { describe, it, expect, render, screen, userEvent } from "../../test-utils";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("rende trigger e non mostra tooltip inizialmente", () => {
    render(
      <Tooltip content="Testo tooltip">
        <button type="button">Hover me</button>
      </Tooltip>
    );
    expect(screen.getByRole("button", { name: /hover me/i })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("mostra tooltip al mouseEnter", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Testo tooltip">
        <button type="button">Hover</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Testo tooltip");
  });

  it("nasconde tooltip al mouseLeave", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="C">
        <button type="button">H</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.unhover(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("mostra secondLine e showIcon", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Prima riga" secondLine="Seconda riga" showIcon>
        <span>Trigger</span>
      </Tooltip>
    );
    await user.hover(screen.getByText("Trigger"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Prima riga");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Seconda riga");
    const dot = document.querySelector(".size-2.rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("applica side bottom, left, right", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="C" side="bottom">
        <span>T</span>
      </Tooltip>
    );
    await user.hover(screen.getByText("T"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("C");
  });

  it("applica side left e right", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Tooltip content="Left" side="left">
        <span>X</span>
      </Tooltip>
    );
    await user.hover(screen.getByText("X"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Left");
    rerender(
      <Tooltip content="Right" side="right">
        <span>X</span>
      </Tooltip>
    );
    await user.hover(screen.getByText("X"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Right");
  });
});
