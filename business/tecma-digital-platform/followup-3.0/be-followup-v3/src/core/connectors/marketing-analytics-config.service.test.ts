import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  getMarketingMetaAdsConfig,
  getMarketingGa4Config,
  getMarketingGoogleAdsConfig,
} from "./marketing-analytics-config.service.js";

const findOne = vi.fn();
const updateOne = vi.fn();
const deleteOne = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne,
      updateOne,
      deleteOne,
    }),
  }),
}));

describe("marketing-analytics-config.service", () => {
  beforeEach(() => {
    findOne.mockReset();
    updateOne.mockReset();
    deleteOne.mockReset();
  });

  it("getMarketingMetaAdsConfig non espone il token in chiaro", async () => {
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "marketing_meta_ads",
      config: { accessToken: "EAAB_secret_value_1234" },
      updatedAt: new Date(),
    });
    const row = await getMarketingMetaAdsConfig("ws1");
    expect(row?.accessTokenMasked).toMatch(/\*+1234$/);
    expect(row?.accessTokenMasked).not.toContain("EAAB_secret");
  });

  it("getMarketingGa4Config maschera il JSON", async () => {
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "marketing_ga4",
      config: { serviceAccountJson: '{"type":"service_account"}' },
      updatedAt: new Date(),
    });
    const row = await getMarketingGa4Config("ws1");
    expect(row?.serviceAccountJsonMasked).toContain("mascherato");
    expect(row?.serviceAccountJsonMasked).not.toContain("service_account");
  });

  it("getMarketingGoogleAdsConfig maschera refresh token", async () => {
    findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      workspaceId: "ws1",
      connectorId: "marketing_google_ads",
      config: { refreshToken: "1//0abcdefSECRET" },
      updatedAt: new Date(),
    });
    const row = await getMarketingGoogleAdsConfig("ws1");
    expect(row?.refreshTokenMasked).toMatch(/\*+CRET$/);
  });
});
