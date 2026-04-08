import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const mockDb = { collection: vi.fn() };

vi.mock("../../config/db.js", () => ({ getDb: () => mockDb }));
vi.mock("./project-access.js", () => ({
  ensureProjectInWorkspace: vi.fn().mockResolvedValue(undefined),
}));

import { updateProject } from "./projects.service.js";

describe("updateProject", () => {
  const updateOne = vi.fn();
  const findOne = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue({ updateOne, findOne });
  });

  it("aggiorna top-level e sincronizza mirror legacyPayload.rawProject", async () => {
    const pid = new ObjectId().toHexString();
    updateOne
      .mockResolvedValueOnce({ matchedCount: 1 }) // top-level update
      .mockResolvedValueOnce({ matchedCount: 1 }); // legacy mirror update
    findOne
      .mockResolvedValueOnce({
        _id: new ObjectId(pid),
        name: "P",
        displayName: "Project",
        mode: "sell",
        legacyPayload: { rawProject: { city: "Old" }, x: true },
      }) // for mirror merge
      .mockResolvedValueOnce({
        _id: new ObjectId(pid),
        name: "P",
        displayName: "Project",
        mode: "sell",
      }); // final read

    await updateProject(pid, "ws", true, { city: "Roma", customDomain: "dom.test" });

    expect(updateOne).toHaveBeenCalledTimes(2);
    const mirrorSet = updateOne.mock.calls[1][1].$set;
    expect(mirrorSet.legacyPayload.rawProject).toMatchObject({
      city: "Roma",
      customDomain: "dom.test",
    });
  });
});

