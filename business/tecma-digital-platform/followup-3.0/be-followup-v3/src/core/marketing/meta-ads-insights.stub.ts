import { ENV } from "../../config/env.js";
import { getMarketingMetaAdsAccessToken } from "../connectors/marketing-analytics-config.service.js";

export interface MetaCampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
}

export interface MetaAdsInsightsResult {
  configured: boolean;
  adAccountId?: string;
  campaigns: MetaCampaignMetrics[];
  error?: string;
}

/** Placeholder Marketing API Meta — vedi docs/MARKETING_APIS_RUNBOOK.md */
export async function fetchMetaCampaignInsights(_input: {
  dateFrom: string;
  dateTo: string;
  adAccountId?: string;
  workspaceId?: string;
}): Promise<MetaAdsInsightsResult> {
  let token = ENV.META_ACCESS_TOKEN?.trim();
  if (_input.workspaceId) {
    const t = await getMarketingMetaAdsAccessToken(_input.workspaceId);
    if (t) token = t;
  }
  const act = (_input.adAccountId?.trim() || ENV.META_AD_ACCOUNT_ID?.trim()) ?? "";
  if (!token || !act) {
    return { configured: false, campaigns: [] };
  }
  return {
    configured: true,
    adAccountId: act,
    campaigns: [],
    error: "Meta Marketing API non ancora cablata: chiamare /insights con time_range.",
  };
}
