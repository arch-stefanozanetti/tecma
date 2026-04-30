import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findOne = vi.fn();
  const updateOne = vi.fn();
  return { findOne, updateOne };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne: mocks.findOne,
      updateOne: mocks.updateOne,
    }),
  }),
}));

vi.mock("./project-access.js", () => ({
  ensureProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
  toIsoDate: (v: unknown) => String(v ?? ""),
}));

import { getProjectPolicies, putProjectPolicies } from "./project-policies.service.js";

describe("project-policies.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads legalNotes from stored document", async () => {
    mocks.findOne.mockResolvedValueOnce({
      projectId: "p1",
      legalNotes: "legacy notes",
      updatedAt: "2026-03-26T00:00:00.000Z",
    });

    const row = await getProjectPolicies("p1", "w1", true);
    expect(row.legalNotes).toBe("legacy notes");
  });

  it("persists legalNotes on put", async () => {
    mocks.findOne.mockResolvedValueOnce({
      projectId: "p1",
      legalNotes: "saved notes",
      updatedAt: "2026-03-26T00:00:00.000Z",
    });

    const row = await putProjectPolicies("p1", "w1", true, { legalNotes: "saved notes" });
    expect(mocks.updateOne).toHaveBeenCalled();
    expect(row.legalNotes).toBe("saved notes");
  });
});

