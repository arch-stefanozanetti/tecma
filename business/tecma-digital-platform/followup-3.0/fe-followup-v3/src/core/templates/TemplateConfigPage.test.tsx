import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { TemplateConfigPage } from "./TemplateConfigPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getTemplateConfiguration: vi.fn().mockResolvedValue({ projectId: "p1", template: { sections: [] } }),
    saveTemplateConfiguration: vi.fn().mockResolvedValue({ saved: true }),
    validateTemplateConfiguration: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
  },
}));

describe("TemplateConfigPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina template", () => {
    render(<TemplateConfigPage workspaceId="w1" projectIds={["p1"]} />);
    expect(screen.getByRole("button", { name: /load/i })).toBeInTheDocument();
  });

  it("mostra sezione configurazione template", () => {
    render(<TemplateConfigPage workspaceId="w1" projectIds={["p1"]} />);
    expect(screen.getByRole("button", { name: /load/i })).toBeInTheDocument();
    expect(screen.getByText(/template|configurazione/i)).toBeInTheDocument();
  });
});
