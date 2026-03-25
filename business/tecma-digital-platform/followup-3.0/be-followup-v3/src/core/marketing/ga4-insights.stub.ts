import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import { getMarketingGa4ServiceAccountJson } from "../connectors/marketing-analytics-config.service.js";
import { getGoogleMarketingUserAccessToken } from "../connectors/marketing-discovery.service.js";

const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

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

function toGa4Date(isoOrYmd: string): string {
  const s = isoOrYmd.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : isoOrYmd.slice(0, 10);
}

function parseRunReportSummary(text: string): Ga4TrafficSummary | null {
  try {
    const json = JSON.parse(text) as {
      totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
    };
    type RowMetrics = { sessions: number; activeUsers: number; aptPageViews: number };
    const readRow = (row?: { metricValues?: Array<{ value?: string }> }): RowMetrics | null => {
      const mv = row?.metricValues;
      if (!mv?.length) return null;
      return {
        sessions: Number(mv[0]?.value ?? 0) || 0,
        activeUsers: Number(mv[1]?.value ?? 0) || 0,
        aptPageViews: Number(mv[2]?.value ?? 0) || 0,
      };
    };
    const fromTotals = readRow(json.totals?.[0]);
    if (fromTotals) return fromTotals;
    let sessions = 0;
    let activeUsers = 0;
    let aptPageViews = 0;
    for (const row of json.rows ?? []) {
      const p = readRow(row);
      if (p) {
        sessions += p.sessions;
        activeUsers += p.activeUsers;
        aptPageViews += p.aptPageViews;
      }
    }
    if ((json.rows?.length ?? 0) > 0) {
      return { sessions, activeUsers, aptPageViews };
    }
    return { sessions: 0, activeUsers: 0, aptPageViews: 0 };
  } catch (e) {
    logger.warn({ err: e }, "GA4 runReport JSON parse failed");
    return null;
  }
}

async function fetchGa4SummaryViaOAuth(
  accessToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<Ga4TrafficSummary | null> {
  const url = `${GA4_DATA_API}/properties/${encodeURIComponent(propertyId)}:runReport`;
  const body = {
    dateRanges: [{ startDate: toGa4Date(dateFrom), endDate: toGa4Date(dateTo) }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logger.warn(
      { status: res.status, bodyPreview: text.slice(0, 500), propertyId },
      "GA4 Data API runReport failed — enable «Google Analytics Data API» on the OAuth GCP project; user needs access to the GA4 property"
    );
    return null;
  }
  return parseRunReportSummary(text);
}

/**
 * Metriche GA4 per Big Data: OAuth marketing (stesso flusso del picker proprietà) oppure service account legacy.
 */
export async function fetchGa4TrafficSummary(input: {
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
  workspaceId?: string;
}): Promise<Ga4InsightsResult> {
  const prop = (input.propertyId?.trim() || ENV.GA4_PROPERTY_ID?.trim()) ?? "";
  if (!prop) {
    return { configured: false, summary: {} };
  }

  let saJson = ENV.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (input.workspaceId) {
    const j = await getMarketingGa4ServiceAccountJson(input.workspaceId);
    if (j) saJson = j;
  }

  if (input.workspaceId) {
    const access = await getGoogleMarketingUserAccessToken(input.workspaceId);
    if (access) {
      const summary = await fetchGa4SummaryViaOAuth(access, prop, input.dateFrom, input.dateTo);
      if (summary !== null) {
        return { configured: true, propertyId: prop, summary };
      }
      return {
        configured: true,
        propertyId: prop,
        summary: {},
        error:
          "GA4 Data API non ha restituito dati. Abilita «Google Analytics Data API» nel progetto Google Cloud dell'OAuth marketing e verifica che l'utente del login abbia accesso in lettura alla proprietà GA4.",
      };
    }
  }

  if (saJson) {
    return {
      configured: true,
      propertyId: prop,
      summary: {},
      error:
        "È configurato un service account GA4 legacy: la lettura automatica via Data API per quel percorso non è ancora cablata nel backend. Usa «Collega Google» (OAuth) in Integrazioni Big Data oppure estendi il backend per JWT service account.",
    };
  }

  return {
    configured: false,
    propertyId: prop,
    summary: {},
    error: "Collega Google in Integrazioni → Big Data e scegli una proprietà GA4 nella scheda progetto.",
  };
}
