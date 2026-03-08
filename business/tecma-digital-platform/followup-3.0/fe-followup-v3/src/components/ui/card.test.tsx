import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardMedia,
  CardTable,
  CardContainer,
} from "./card";

describe("Card", () => {
  it("rende contenuto e sottocomponenti", () => {
    render(
      <Card data-testid="card">
        <CardHeader>Titolo</CardHeader>
        <CardContent>Contenuto</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("Titolo");
    expect(card).toHaveTextContent("Contenuto");
    expect(card).toHaveTextContent("Footer");
  });

  it("chiama onSelect al click quando fornito", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Card onSelect={onSelect} data-testid="card">
        <CardContent>Cliccabile</CardContent>
      </Card>
    );
    await user.click(screen.getByTestId("card"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("applica selected (ring) quando selected=true", () => {
    render(
      <Card selected data-testid="card">
        <CardContent>Selezionata</CardContent>
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card.className).toMatch(/ring/);
  });

  it("rende CardMedia, CardTable, CardContainer", () => {
    render(
      <CardContainer>
        <Card data-testid="card">
          <CardHeader>T</CardHeader>
          <CardMedia>Media</CardMedia>
          <CardContent>
            <CardTable>Tabella</CardTable>
          </CardContent>
          <CardFooter>F</CardFooter>
        </Card>
      </CardContainer>
    );
    expect(screen.getByText("Media")).toBeInTheDocument();
    expect(screen.getByText("Tabella")).toBeInTheDocument();
  });

  it("applica fluid, orientation horizontal, borderLess", () => {
    render(
      <Card fluid orientation="horizontal" borderLess data-testid="card">
        <CardContent>C</CardContent>
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card.className).toMatch(/w-full|flex-row|border-0/);
  });

  it("risponde a keydown quando onSelect è fornito", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Card onSelect={onSelect} data-testid="card">
        <CardContent>C</CardContent>
      </Card>
    );
    screen.getByTestId("card").focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
  });

  it("risponde a keydown Space quando onSelect è fornito", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Card onSelect={onSelect} data-testid="card">
        <CardContent>C</CardContent>
      </Card>
    );
    screen.getByTestId("card").focus();
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalled();
  });
});
