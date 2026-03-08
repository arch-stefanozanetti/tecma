import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "../../test-utils";
import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  it("rende header con nome utente", () => {
    render(<AppHeader userName="Mario Rossi" />);
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
  });

  it("rende trigger profilo con userEmail", () => {
    render(<AppHeader userName="Mario" userEmail="mario@test.com" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("chiama onLogout quando si clicca Esci nel dropdown", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(<AppHeader userName="Mario" userEmail="m@t.com" onLogout={onLogout} />);
    await user.click(screen.getByRole("button"));
    const esci = await screen.findByRole("menuitem", { name: /esci/i });
    await user.click(esci);
    expect(onLogout).toHaveBeenCalled();
  });
});
