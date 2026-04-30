import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../../test-utils";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("../../api/followupApi", () => ({
  followupApi: {
    projects: {
      getProjectDetail: vi.fn().mockResolvedValue({
        id: "p1",
        name: "Progetto 1",
        displayName: "P1",
        mode: "sell",
      }),
      getProjectPolicies: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      getProjectBranding: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      getProjectMarketingSettings: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      putProjectMarketingSettings: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      getProjectWorkflowSettings: vi.fn().mockResolvedValue({
        projectId: "p1",
        workspaceId: "ws-1",
        workflowId: null,
        updatedAt: "",
      }),
      putProjectWorkflowSettings: vi.fn().mockResolvedValue({
        projectId: "p1",
        workspaceId: "ws-1",
        workflowId: null,
        updatedAt: "",
      }),
      getProjectEmailConfig: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      listProjectEmailTemplates: vi.fn().mockResolvedValue([]),
      listProjectPdfTemplates: vi.fn().mockResolvedValue([]),
      listProjectAccess: vi.fn().mockResolvedValue({ data: [] }),
      getProjectLegacyOverrides: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
      putProjectLegacyOverrides: vi.fn().mockResolvedValue({ projectId: "p1", updatedAt: "" }),
    },
    listWorkflowsByWorkspace: vi.fn().mockResolvedValue({ workflows: [] }),
    listAssets: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, perPage: 25, totalPages: 0 } }),
    getAssetDownloadUrl: vi.fn().mockResolvedValue({ downloadUrl: "" }),
    apartments: { queryApartments: vi.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, perPage: 25, totalPages: 0 } }) },
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
