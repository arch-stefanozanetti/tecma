import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { ClientsFiltersDrawerContent, getDefaultFiltersDraft } from "./ClientsFiltersDrawerContent";

describe("ClientsFiltersDrawerContent", () => {
  it("getDefaultFiltersDraft restituisce draft con status all e timeFrame vuoto", () => {
    const draft = getDefaultFiltersDraft();
    expect(draft.status).toBe("all");
    expect(draft.timeFrame.activity).toBe("");
    expect(draft.timeFrame.fromDate).toBe("");
    expect(draft.timeFrame.toDate).toBe("");
    expect(draft.filterSearch).toBe("");
  });

  it("rende Stato e intervallo di tempo", () => {
    const onDraftChange = vi.fn();
    const onClearDates = vi.fn();
    const onClearFilters = vi.fn();
    const draft = getDefaultFiltersDraft();

    render(
      <ClientsFiltersDrawerContent
        draft={draft}
        onDraftChange={onDraftChange}
        onClearDates={onClearDates}
        onClearFilters={onClearFilters}
      />
    );

    expect(screen.getByText("Stato")).toBeInTheDocument();
    expect(screen.getByText(/imposta un intervallo di tempo/i)).toBeInTheDocument();
  });

  it("chiama onDraftChange quando si digita nella ricerca filtri", async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const draft = getDefaultFiltersDraft();

    render(
      <ClientsFiltersDrawerContent
        draft={draft}
        onDraftChange={onDraftChange}
        onClearDates={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/cerca un filtro/i);
    await user.type(searchInput, "x");
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ filterSearch: "x" }));
  });

  it("bottone Cancella filtri è disabilitato quando non ci sono filtri attivi", () => {
    const draft = getDefaultFiltersDraft();
    render(
      <ClientsFiltersDrawerContent
        draft={draft}
        onDraftChange={vi.fn()}
        onClearDates={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /cancella filtri/i })).toBeDisabled();
  });
});
