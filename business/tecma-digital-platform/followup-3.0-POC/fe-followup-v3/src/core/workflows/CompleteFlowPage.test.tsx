import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { CompleteFlowPage } from "./CompleteFlowPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    queryHCMaster: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0 } }),
    queryClientsLite: vi.fn().mockResolvedValue({ data: [] }),
    getTemplateConfiguration: vi.fn().mockResolvedValue({ template: { sections: [] } }),
    previewCompleteFlow: vi.fn().mockResolvedValue({ valid: true, steps: [], warnings: [], summary: {} }),
    executeCompleteFlow: vi.fn().mockResolvedValue({ done: true, apartmentId: "a1" }),
  },
}));

describe("CompleteFlowPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rende la pagina flusso completo", async () => {
    render(<CompleteFlowPage workspaceId="w1" projectIds={["p1"]} />);
    expect(await screen.findByRole("heading", { name: /configura flusso completo/i })).toBeInTheDocument();
  });

  it("mostra step e controlli del wizard", async () => {
    render(<CompleteFlowPage workspaceId="w1" projectIds={["p1"]} />);
    await screen.findByRole("heading", { name: /configura flusso completo/i });
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    expect(screen.getByText("Flow Summary")).toBeInTheDocument();
  });
});
