import { ENV } from "../../config/env.js";
import { getMarketingGoogleAdsOAuthSecrets } from "../connectors/marketing-analytics-config.service.js";

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
 * Credenziali OAuth: workspace (connector marketing_google_ads) o env globali.
 */
export async function fetchGoogleAdsCampaignInsights(_input: {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
  loginCustomerId?: string;
  workspaceId?: string;
}): Promise<GoogleAdsInsightsResult> {
  const token = ENV.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  let refresh = ENV.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (_input.workspaceId) {
    const oauth = await getMarketingGoogleAdsOAuthSecrets(_input.workspaceId);
    if (oauth?.refreshToken) refresh = oauth.refreshToken;
  }
  if (!token || !refresh) {
    return { configured: false, campaigns: [] };
  }
  const customerId =
    (_input.customerId?.trim() || ENV.GOOGLE_ADS_CUSTOMER_ID?.trim()) || undefined;
  return {
    configured: true,
    customerId,
    campaigns: [],
    error: "Google Ads API non ancora cablata: configurare client ufficiale e GAQL in questo modulo.",
  };
}
