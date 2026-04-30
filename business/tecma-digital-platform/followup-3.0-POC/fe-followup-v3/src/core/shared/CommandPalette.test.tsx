import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { CommandPalette } from "./CommandPalette";

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSelectSection: vi.fn(),
  navigate: vi.fn(),
  workspaceId: "w1",
  projectIds: ["p1"],
};

describe("CommandPalette", () => {
  it("non rende contenuto quando chiuso", () => {
    render(
      <CommandPalette {...defaultProps} isOpen={false} />
    );
    expect(screen.queryByPlaceholderText(/digita un comando|ricerca/i)).not.toBeInTheDocument();
  });

  it("rende input di ricerca quando aperto", () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByPlaceholderText(/digita un comando|cerca/i)).toBeInTheDocument();
  });

  it("chiama onSelectSection quando si seleziona un comando di sezione", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CommandPalette {...defaultProps} onSelectSection={onSelect} />
    );
    const btn = screen.getByRole("option", { name: /home/i });
    await user.click(btn);
    expect(onSelect).toHaveBeenCalledWith("cockpit");
  });
});
