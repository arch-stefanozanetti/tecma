import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne: mockFindOne,
    }),
  }),
}));

vi.mock("../projects/project-access.js", () => ({
  ensureProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
}));

import { resolveStorageScope } from "./storage-policy.service.js";

describe("resolveStorageScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OCI_ALLOWED_BUCKETS = "tecma-assets-coll,tecma-assets-prod";
  });

  it("workspace user resta confinato nel prefix workspace", async () => {
    const scope = await resolveStorageScope({
      workspaceId: "ws1",
      isTecmaAdmin: false,
    });
    expect(scope.bucket).toBe("tecma-assets-coll");
    expect(scope.prefix).toBe("workspaces/ws1/");
  });

  it("workspace user con project usa root initiatives/<displayName>/", async () => {
    mockFindOne.mockResolvedValue({ displayName: "Arborea Living" });
    const scope = await resolveStorageScope({
      workspaceId: "ws1",
      projectId: "p1",
      isTecmaAdmin: false,
    });
    expect(scope.prefix).toBe("initiatives/Arborea%20Living/");
  });

  it("admin può scegliere bucket da allowlist", async () => {
    const scope = await resolveStorageScope({
      workspaceId: "ws1",
      isTecmaAdmin: true,
      requestedBucket: "tecma-assets-prod",
      requestedPrefix: "initiatives/prova/",
    });
    expect(scope.bucket).toBe("tecma-assets-prod");
    expect(scope.prefix).toBe("initiatives/prova/");
  });
});

