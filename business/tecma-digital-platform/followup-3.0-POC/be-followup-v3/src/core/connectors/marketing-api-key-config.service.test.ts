import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  getMarketingApiKeyConfig,
  getMarketingConnectorSecrets,
  saveMarketingApiKeyConfig,
} from "./marketing-api-key-config.service.js";

const findOne = vi.fn();
const updateOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne,
      updateOne,
    }),
  }),
}));

const entitled = vi.fn();
vi.mock("../workspaces/workspace-entitlements.service.js", () => ({
  isWorkspaceEntitledToFeature: (...args: unknown[]) => entitled(...args),
}));

describe("marketing-api-key-config.service", () => {
  beforeEach(() => {
    findOne.mockReset();
    updateOne.mockReset();
    entitled.mockReset();
  });

  it("getMarketingApiKeyConfig restituisce null se assente", async () => {
    findOne.mockResolvedValueOnce(null);
    await expect(getMarketingApiKeyConfig("ws1", "mailchimp")).resolves.toBeNull();
  });

  it("getMarketingApiKeyConfig maschera apiKey", async () => {
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "mailchimp",
      config: { apiKey: "abcdefghij" },
      updatedAt: new Date(),
    });
    const row = await getMarketingApiKeyConfig("ws1", "mailchimp");
    expect(row?.config.apiKeyMasked).toMatch(/\*+ghij$/);
  });

  it("saveMarketingApiKeyConfig rifiuta senza integrations", async () => {
    entitled.mockImplementation(async (_ws: string, f: string) => f === "mailchimp");
    await expect(saveMarketingApiKeyConfig("ws1", "mailchimp", "k")).rejects.toMatchObject({ statusCode: 403 });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("saveMarketingApiKeyConfig rifiuta senza modulo marketing", async () => {
    entitled.mockImplementation(async (_ws: string, f: string) => f === "integrations");
    await expect(saveMarketingApiKeyConfig("ws1", "mailchimp", "key")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("saveMarketingApiKeyConfig esegue upsert e legge riga mascherata", async () => {
    entitled.mockResolvedValue(true);
    findOne.mockResolvedValueOnce(null);
    updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "mailchimp",
      config: { apiKey: "mysecretkey" },
      updatedAt: new Date(),
    });
    const row = await saveMarketingApiKeyConfig("ws1", "mailchimp", "mysecretkey");
    expect(updateOne).toHaveBeenCalled();
    expect(row.config.apiKeyMasked).toMatch(/\*+tkey$/);
  });

  it("save activecampaign senza apiBaseUrl e senza doc esistente ⇒ 400", async () => {
    entitled.mockResolvedValue(true);
    findOne.mockResolvedValueOnce(null);
    await expect(saveMarketingApiKeyConfig("ws1", "activecampaign", { apiKey: "tok" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("save activecampaign con apiBaseUrl persiste config", async () => {
    entitled.mockResolvedValue(true);
    findOne.mockResolvedValueOnce(null);
    updateOne.mockResolvedValueOnce({ matchedCount: 1 });
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "activecampaign",
      config: { apiKey: "mysecretkey", apiBaseUrl: "https://x.api-us1.com" },
      updatedAt: new Date(),
    });
    const row = await saveMarketingApiKeyConfig("ws1", "activecampaign", {
      apiKey: "mysecretkey",
      apiBaseUrl: "https://x.api-us1.com",
    });
    expect(row.config.apiBaseUrl).toBe("https://x.api-us1.com");
  });

  it("getMarketingConnectorSecrets legge apiKey e apiBaseUrl", async () => {
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "activecampaign",
      config: { apiKey: "secret", apiBaseUrl: "https://a.api-us1.com/" },
      updatedAt: new Date(),
    });
    await expect(getMarketingConnectorSecrets("ws1", "activecampaign")).resolves.toEqual({
      apiKey: "secret",
      apiBaseUrl: "https://a.api-us1.com",
    });
  });
});
