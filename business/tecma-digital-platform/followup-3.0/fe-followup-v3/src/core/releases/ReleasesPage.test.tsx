import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { ReleasesPage } from "./ReleasesPage";

describe("ReleasesPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
  });

  it("rende la pagina senza crash", () => {
    render(<ReleasesPage />);
    expect(document.body.textContent).toBeTruthy();
  });

  it("mostra il titolo Release e novità", async () => {
    render(<ReleasesPage />);
    expect(await screen.findByRole("heading", { name: /release e novità/i })).toBeInTheDocument();
  });
});
