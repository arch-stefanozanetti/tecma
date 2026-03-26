import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const mockDb = {
  collection: vi.fn(),
};

vi.mock("../../config/db.js", () => ({
  getDb: () => mockDb,
}));

vi.mock("./project-access.js", () => ({
  ensureProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
  toIsoDate: (v: unknown) => (typeof v === "string" ? v : new Date("2020-01-01T00:00:00.000Z").toISOString()),
}));

import { putProjectLegacyOverrides } from "./project-legacy-overrides.service.js";

describe("putProjectLegacyOverrides", () => {
  const overridesUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });
  const overridesFindOne = vi.fn().mockImplementation((filter: { projectId?: string }) =>
    Promise.resolve({
      projectId: filter.projectId,
      updatedAt: "2020-01-01T00:00:00.000Z",
    })
  );
  const tzFindOne = vi.fn();
  const tzUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });

  beforeEach(() => {
    vi.clearAllMocks();
    overridesUpdateOne.mockResolvedValue({ acknowledged: true });
    overridesFindOne.mockImplementation((filter: { projectId?: string }) =>
      Promise.resolve({
        projectId: filter.projectId,
        updatedAt: "2020-01-01T00:00:00.000Z",
      })
    );
    mockDb.collection.mockImplementation((name: string) => {
      if (name === "tz_project_legacy_overrides") {
        return { updateOne: overridesUpdateOne, findOne: overridesFindOne };
      }
      if (name === "tz_projects") {
        return { findOne: tzFindOne, updateOne: tzUpdateOne };
      }
      return { updateOne: vi.fn(), findOne: vi.fn() };
    });
  });

  it("scrive overrides e merge su tz_projects.legacyPayload.rawProject", async () => {
    const pid = new ObjectId().toHexString();
    tzFindOne.mockResolvedValue({
      _id: new ObjectId(pid),
      legacyPayload: {
        rawProject: { name: "old", nested: { a: 1 } },
        other: true,
      },
    });

    await putProjectLegacyOverrides(pid, "ws", true, {
      identityFields: { displayName: "Nuovo" },
    });

    expect(overridesUpdateOne).toHaveBeenCalled();
    expect(tzUpdateOne).toHaveBeenCalled();
    const setArg = tzUpdateOne.mock.calls[0][1].$set;
    expect(setArg.legacyPayload).toMatchObject({
      other: true,
      rawProject: expect.objectContaining({
        name: "old",
        displayName: "Nuovo",
        nested: { a: 1 },
      }),
    });
  });

  it("non aggiorna tz_projects se solo flag booleani senza patch raw", async () => {
    const pid = new ObjectId().toHexString();
    tzFindOne.mockResolvedValue({
      _id: new ObjectId(pid),
      legacyPayload: { rawProject: {} },
    });

    await putProjectLegacyOverrides(pid, "ws", true, {
      enabledTools: { quotations: true },
    });

    expect(overridesUpdateOne).toHaveBeenCalled();
    expect(tzUpdateOne).not.toHaveBeenCalled();
  });
});
