import { describe, it, expect } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import {
  PrioritySuggestionsList,
  MAX_AGGREGATED_DETAIL_VISIBLE,
  type PriorityActionItem,
} from "./PrioritySuggestionsList";

const baseItem = (over: Partial<PriorityActionItem>): PriorityActionItem => ({
  id: "1",
  suggestionId: "s1",
  title: "Proposte ferme (12)",
  urgency: "risk",
  context: "Motivo di gruppo",
  action: "Contattare i clienti",
  ...over,
});

describe("PrioritySuggestionsList (aggregated detail)", () => {
  it("mostra accordion dettagli e al massimo K righe con … e altre M", async () => {
    const user = userEvent.setup();
    const labels = Array.from({ length: MAX_AGGREGATED_DETAIL_VISIBLE + 4 }, (_, i) => ({
      label: `Voce ${i + 1}`,
      clientId: i % 2 === 0 ? `c${i}` : undefined,
    }));
    const item = baseItem({ aggregatedItems: labels });

    render(
      <PrioritySuggestionsList
        items={[item]}
        executingSuggestionId={null}
        scopeEmail="u@test.com"
        onExecuteWithAi={() => {}}
        getSectionForAction={() => "clients"}
      />
    );

    const toggle = screen.getByTestId("priority-aggregated-toggle");
    expect(toggle).toHaveTextContent(`Mostra dettagli (${labels.length})`);

    await user.click(toggle);
    expect(screen.getByTestId("priority-aggregated-list")).toBeInTheDocument();
    const more = screen.getByTestId("priority-aggregated-more");
    expect(more).toHaveTextContent(`… e altre 4`);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/clients/c0");
  });
});
