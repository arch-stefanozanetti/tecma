import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const insertOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      insertOne,
      find: () => ({ sort: () => ({ toArray: vi.fn().mockResolvedValue([]) }) }),
      findOne: vi.fn(),
      updateOne: vi.fn(),
    }),
  }),
}));

vi.mock("../workspaces/workspace-entitlements.service.js", () => ({
  isWorkspaceEntitledToFeature: vi.fn(),
}));

import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";
import { createPlatformApiKey, rotatePlatformApiKey } from "./platform-api-keys.service.js";

describe("platform-api-keys.service — entitlement publicApi", () => {
  beforeEach(() => {
    vi.mocked(isWorkspaceEntitledToFeature).mockResolvedValue(true);
    insertOne.mockReset();
    insertOne.mockResolvedValue({ insertedId: new ObjectId() });
  });

  it("createPlatformApiKey non inserisce se publicApi non abilitata", async () => {
    vi.mocked(isWorkspaceEntitledToFeature).mockResolvedValue(false);
    await expect(createPlatformApiKey("ws1", { label: "x" })).rejects.toMatchObject({
      name: "HttpError",
      statusCode: 403,
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("rotatePlatformApiKey fallisce se publicApi non abilitata", async () => {
    vi.mocked(isWorkspaceEntitledToFeature).mockResolvedValue(false);
    const keyId = new ObjectId().toHexString();
    await expect(rotatePlatformApiKey("ws1", keyId)).rejects.toMatchObject({
      name: "HttpError",
      statusCode: 403,
    });
  });
});
