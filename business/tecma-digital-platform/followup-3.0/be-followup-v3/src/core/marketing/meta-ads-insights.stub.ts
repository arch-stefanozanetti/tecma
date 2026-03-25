import { ENV } from "../../config/env.js";

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
}): Promise<MetaAdsInsightsResult> {
  const token = ENV.META_ACCESS_TOKEN?.trim();
  const act = (ENV.META_AD_ACCOUNT_ID?.trim() || _input.adAccountId?.trim()) ?? "";
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
