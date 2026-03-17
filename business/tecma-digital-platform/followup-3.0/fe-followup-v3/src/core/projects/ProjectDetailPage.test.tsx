import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    getProjectDetail: vi.fn().mockResolvedValue({
      id: "p1",
      name: "Progetto 1",
      displayName: "P1",
      mode: "sell",
    }),
    getProjectPolicies: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
    getProjectBranding: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
    getProjectEmailConfig: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
    listProjectEmailTemplates: vi.fn().mockResolvedValue([]),
    listProjectPdfTemplates: vi.fn().mockResolvedValue([]),
    saveProjectPolicies: vi.fn().mockResolvedValue(undefined),
    saveProjectEmailConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../auth/projectScope", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1" }),
}));

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const NoExtraRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  it("con projectId carica e mostra il progetto", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/p1"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: NoExtraRouter }
    );
    expect(await screen.findByRole("heading", { name: /p1/i })).toBeInTheDocument();
  });
});
