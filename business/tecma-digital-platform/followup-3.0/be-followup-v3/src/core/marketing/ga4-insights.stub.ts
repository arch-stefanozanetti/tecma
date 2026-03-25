import { ENV } from "../../config/env.js";

export interface Ga4TrafficSummary {
  sessions?: number;
  activeUsers?: number;
  aptPageViews?: number;
}

export interface Ga4InsightsResult {
  configured: boolean;
  propertyId?: string;
  summary: Ga4TrafficSummary;
  error?: string;
}

/** Placeholder GA4 Data API — vedi docs/MARKETING_APIS_RUNBOOK.md */
export async function fetchGa4TrafficSummary(_input: {
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
}): Promise<Ga4InsightsResult> {
  const json = ENV.GA4_SERVICE_ACCOUNT_JSON?.trim();
  const prop = (ENV.GA4_PROPERTY_ID?.trim() || _input.propertyId?.trim()) ?? "";
  if (!json || !prop) {
    return { configured: false, summary: {} };
  }
  return {
    configured: true,
    propertyId: prop,
    summary: {},
    error: "GA4 Data API non ancora cablata: usare @google-analytics/data e service account.",
  };
}
