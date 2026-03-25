import { ENV } from "../../config/env.js";

export interface GoogleAdsCampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  /** Valuta account, importo in unità principali (es. EUR). */
  spend: number;
}

export interface GoogleAdsInsightsResult {
  configured: boolean;
  customerId?: string;
  campaigns: GoogleAdsCampaignMetrics[];
  error?: string;
}

/**
 * Placeholder: richiede Google Ads API + OAuth (vedi docs/MARKETING_APIS_RUNBOOK.md).
 * Quando le env sono assenti, ritorna lista vuota senza fallire la dashboard.
 */
export async function fetchGoogleAdsCampaignInsights(_input: {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
}): Promise<GoogleAdsInsightsResult> {
  const token = ENV.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const refresh = ENV.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!token || !refresh) {
    return { configured: false, campaigns: [] };
  }
  return {
    configured: true,
    customerId: ENV.GOOGLE_ADS_CUSTOMER_ID?.trim(),
    campaigns: [],
    error: "Google Ads API non ancora cablata: configurare client ufficiale e GAQL in questo modulo.",
  };
}
