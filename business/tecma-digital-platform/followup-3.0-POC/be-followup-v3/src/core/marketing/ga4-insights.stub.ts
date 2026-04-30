import { ENV } from "../../config/env.js";
import { logger } from "../../observability/logger.js";
import { getMarketingGa4ServiceAccountJson } from "../connectors/marketing-analytics-config.service.js";
import {
  getGoogleMarketingUserAccessToken,
  lookupGa4PropertyDisplayLabel,
} from "../connectors/marketing-discovery.service.js";

const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export interface Ga4TrafficSummary {
  sessions?: number;
  activeUsers?: number;
  aptPageViews?: number;
}

export type Ga4RecommerceFilterKey = "typology" | "floor" | "surface" | "price";

export interface Ga4RecommerceFilterAgg {
  key: Ga4RecommerceFilterKey;
  value: string;
  screenPageViews: number;
}

export interface Ga4RecommerceAptFromGa4 {
  aptCode: string;
  screenPageViews: number;
}

export interface Ga4RecommerceWebPayload {
  listingSampleRows?: number;
  aptDetailSampleRows?: number;
  topFilterDimensions: Ga4RecommerceFilterAgg[];
  topAptViewsFromGa4: Ga4RecommerceAptFromGa4[];
  methodology?: string;
  error?: string;
}

export interface Ga4ChartsReportPayload {
  trend: Array<{ date: string; sessions: number; activeUsers: number }>;
  trendUsers: Array<{ date: string; newUsers: number; activeUsers: number }>;
  channels: Array<{ label: string; sessions: number }>;
  firstUserChannels: Array<{ channel: string; activeUsers: number; newUsers: number }>;
  devices: Array<{ category: string; sessions: number; activeUsers: number }>;
  firstUserAcquisition: Array<{ sourceMedium: string; sessions: number; newUsers: number }>;
  landingPages: Array<{ path: string; sessions: number; activeUsers: number }>;
  chartInsights?: string[];
}

export interface Ga4InsightsResult {
  configured: boolean;
  propertyId?: string;
  /** Nome account + proprietà da Admin API (se OAuth e lookup disponibili). */
  propertyDisplayName?: string;
  summary: Ga4TrafficSummary;
  error?: string;
  recommerceWeb?: Ga4RecommerceWebPayload;
  report?: Ga4ChartsReportPayload;
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

type Ga4RunReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

function readDimensionMetricViews(row: Ga4RunReportRow): { dim: string; views: number } | null {
  const dim = row.dimensionValues?.[0]?.value?.trim() ?? "";
  const v = Number(row.metricValues?.[0]?.value ?? 0) || 0;
  if (!dim) return null;
  return { dim, views: v };
}

export function parseListingFilterParamsFromPathPlusQuery(pathPlusQuery: string): Partial<
  Record<Ga4RecommerceFilterKey, string>
> {
  const qIdx = pathPlusQuery.indexOf("?");
  const pathname = (qIdx >= 0 ? pathPlusQuery.slice(0, qIdx) : pathPlusQuery).trim();
  const search = qIdx >= 0 ? pathPlusQuery.slice(qIdx + 1) : "";
  const isListing =
    pathname.startsWith("/appartamenti") ||
    pathname === "/listing" ||
    pathname.startsWith("/listing/");
  if (!isListing) return {};
  const sp = new URLSearchParams(search);
  const out: Partial<Record<Ga4RecommerceFilterKey, string>> = {};
  const typ = sp.get("typology") ?? sp.get("type") ?? sp.get("tipologia");
  if (typ?.trim()) out.typology = typ.trim();
  const fl = sp.get("floor") ?? sp.get("piano");
  if (fl?.trim()) out.floor = fl.trim();
  const surf = sp.get("surface") ?? sp.get("area") ?? sp.get("superficie");
  if (surf?.trim()) out.surface = surf.trim();
  const price =
    sp.get("price") ??
    sp.get("prezzo") ??
    sp.get("price_min") ??
    sp.get("price_max") ??
    sp.get("priceMin") ??
    sp.get("priceMax");
  if (price?.trim()) out.price = price.trim();
  return out;
}

export function parseAptCodeFromPathPlusQuery(pathPlusQuery: string): string | null {
  const qIdx = pathPlusQuery.indexOf("?");
  const pathname = (qIdx >= 0 ? pathPlusQuery.slice(0, qIdx) : pathPlusQuery).trim();
  if (!pathname.startsWith("/appartamento")) return null;
  const search = qIdx >= 0 ? pathPlusQuery.slice(qIdx + 1) : "";
  const sp = new URLSearchParams(search);
  const code =
    sp.get("apt") ?? sp.get("apartment") ?? sp.get("id") ?? sp.get("listing") ?? sp.get("unit");
  const t = code?.trim();
  return t ? t : null;
}

function aggregateListingFilters(rows: Ga4RunReportRow[]): Ga4RecommerceFilterAgg[] {
  const buckets = new Map<string, number>();
  const keyOf = (k: Ga4RecommerceFilterKey, v: string) => `${k}:${v}`;
  for (const row of rows) {
    const parsed = readDimensionMetricViews(row);
    if (!parsed) continue;
    const filters = parseListingFilterParamsFromPathPlusQuery(parsed.dim);
    for (const k of ["typology", "floor", "surface", "price"] as const) {
      const val = filters[k];
      if (!val) continue;
      const ck = keyOf(k, val);
      buckets.set(ck, (buckets.get(ck) ?? 0) + parsed.views);
    }
  }
  const list: Ga4RecommerceFilterAgg[] = [];
  for (const [ck, screenPageViews] of buckets) {
    const colon = ck.indexOf(":");
    const key = ck.slice(0, colon) as Ga4RecommerceFilterKey;
    const value = ck.slice(colon + 1);
    list.push({ key, value, screenPageViews });
  }
  list.sort((a, b) => b.screenPageViews - a.screenPageViews);
  return list.slice(0, 40);
}

function aggregateAptDetail(rows: Ga4RunReportRow[]): Ga4RecommerceAptFromGa4[] {
  const m = new Map<string, number>();
  for (const row of rows) {
    const parsed = readDimensionMetricViews(row);
    if (!parsed) continue;
    const apt = parseAptCodeFromPathPlusQuery(parsed.dim);
    if (!apt) continue;
    m.set(apt, (m.get(apt) ?? 0) + parsed.views);
  }
  const list: Ga4RecommerceAptFromGa4[] = [...m.entries()].map(([aptCode, screenPageViews]) => ({
    aptCode,
    screenPageViews,
  }));
  list.sort((a, b) => b.screenPageViews - a.screenPageViews);
  return list.slice(0, 25);
}

async function ga4RunReportJson(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<{ rows?: Ga4RunReportRow[] } | null> {
  const url = `${GA4_DATA_API}/properties/${encodeURIComponent(propertyId)}:runReport`;
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
      { status: res.status, bodyPreview: text.slice(0, 400), propertyId },
      "GA4 runReport failed"
    );
    return null;
  }
  try {
    return JSON.parse(text) as { rows?: Ga4RunReportRow[] };
  } catch (e) {
    logger.warn({ err: e }, "GA4 runReport JSON parse failed");
    return null;
  }
}

function orPathBeginsWith(prefixes: string[]): Record<string, unknown> {
  return {
    orGroup: {
      expressions: prefixes.map((value) => ({
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "BEGINS_WITH", value },
        },
      })),
    },
  };
}

async function fetchGa4RecommerceWebViaOAuth(
  accessToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<Ga4RecommerceWebPayload> {
  const dateRanges = [{ startDate: toGa4Date(dateFrom), endDate: toGa4Date(dateTo) }];
  const common = {
    dateRanges,
    dimensions: [{ name: "pagePathPlusQueryString" }],
    metrics: [{ name: "screenPageViews" }],
    limit: 10000,
  };

  const listingBody = {
    ...common,
    dimensionFilter: orPathBeginsWith(["/appartamenti", "/listing"]),
  };
  const aptBody = {
    ...common,
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "BEGINS_WITH", value: "/appartamento" },
      },
    },
  };

  const [listingJson, aptJson] = await Promise.all([
    ga4RunReportJson(accessToken, propertyId, listingBody),
    ga4RunReportJson(accessToken, propertyId, aptBody),
  ]);

  if (!listingJson && !aptJson) {
    return {
      topFilterDimensions: [],
      topAptViewsFromGa4: [],
      error:
        "GA4 Data API non ha restituito righe recommerce (verifica permessi e che la proprietà tracci path+query).",
    };
  }

  const listingRows = listingJson?.rows ?? [];
  const aptRows = aptJson?.rows ?? [];

  return {
    listingSampleRows: listingRows.length,
    aptDetailSampleRows: aptRows.length,
    topFilterDimensions: aggregateListingFilters(listingRows),
    topAptViewsFromGa4: aggregateAptDetail(aptRows),
    methodology:
      "MVP: pagePathPlusQueryString + parsing query (typology, floor, surface, price). Per report più stabili usare eventi GTM dedicati.",
  };
}

function parseTrendSessionsUsers(rows: Ga4RunReportRow[]): Array<{
  date: string;
  sessions: number;
  activeUsers: number;
}> {
  const out: Array<{ date: string; sessions: number; activeUsers: number }> = [];
  for (const row of rows) {
    const date = row.dimensionValues?.[0]?.value?.trim() ?? "";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const activeUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    if (date) out.push({ date, sessions, activeUsers });
  }
  return out;
}

function parseTrendNewUsers(rows: Ga4RunReportRow[]): Array<{
  date: string;
  newUsers: number;
  activeUsers: number;
}> {
  const out: Array<{ date: string; newUsers: number; activeUsers: number }> = [];
  for (const row of rows) {
    const date = row.dimensionValues?.[0]?.value?.trim() ?? "";
    const newUsers = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const activeUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    if (date) out.push({ date, newUsers, activeUsers });
  }
  return out;
}

function parseSessionChannelRows(rows: Ga4RunReportRow[]): Array<{ label: string; sessions: number }> {
  const out: Array<{ label: string; sessions: number }> = [];
  for (const row of rows) {
    const label = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    out.push({ label, sessions });
  }
  return out;
}

function parseFirstUserChannelRows(
  rows: Ga4RunReportRow[]
): Array<{ channel: string; activeUsers: number; newUsers: number }> {
  const out: Array<{ channel: string; activeUsers: number; newUsers: number }> = [];
  for (const row of rows) {
    const channel = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const activeUsers = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const newUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    out.push({ channel, activeUsers, newUsers });
  }
  return out;
}

function parseDeviceCategoryRows(
  rows: Ga4RunReportRow[]
): Array<{ category: string; sessions: number; activeUsers: number }> {
  const out: Array<{ category: string; sessions: number; activeUsers: number }> = [];
  for (const row of rows) {
    const category = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const activeUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    out.push({ category, sessions, activeUsers });
  }
  return out;
}

function parseFirstUserSourceMediumRows(
  rows: Ga4RunReportRow[]
): Array<{ sourceMedium: string; sessions: number; newUsers: number }> {
  const out: Array<{ sourceMedium: string; sessions: number; newUsers: number }> = [];
  for (const row of rows) {
    const src = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const med = row.dimensionValues?.[1]?.value?.trim() || "(not set)";
    const sourceMedium = `${src} / ${med}`;
    const sessions = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const newUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    out.push({ sourceMedium, sessions, newUsers });
  }
  return out;
}

function parseLandingPageRows(
  rows: Ga4RunReportRow[]
): Array<{ path: string; sessions: number; activeUsers: number }> {
  const out: Array<{ path: string; sessions: number; activeUsers: number }> = [];
  for (const row of rows) {
    const path = row.dimensionValues?.[0]?.value?.trim() || "(not set)";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const activeUsers = Number(row.metricValues?.[1]?.value ?? 0) || 0;
    out.push({ path, sessions, activeUsers });
  }
  return out;
}

function buildChartInsights(
  channels: Array<{ label: string; sessions: number }>,
  firstUserChannels: Array<{ channel: string; activeUsers: number; newUsers: number }>,
  devices: Array<{ category: string; sessions: number; activeUsers: number }>
): string[] {
  const bullets: string[] = [];
  const topSess = [...channels].sort((a, b) => b.sessions - a.sessions)[0];
  if (topSess && topSess.sessions > 0) {
    bullets.push(
      `Tra i canali di sessione, «${topSess.label}» registra il maggior volume (${topSess.sessions.toLocaleString("it-IT")} sessioni nel periodo).`
    );
  }
  const topFu = [...firstUserChannels].sort((a, b) => b.activeUsers - a.activeUsers)[0];
  if (topFu && topFu.activeUsers > 0) {
    bullets.push(
      `Per il primo accesso, il canale predefinito più frequente è «${topFu.channel}» (${topFu.activeUsers.toLocaleString("it-IT")} utenti attivi).`
    );
  }
  const topDev = [...devices].sort((a, b) => b.sessions - a.sessions)[0];
  if (topDev && topDev.sessions > 0) {
    bullets.push(
      `Per categoria dispositivo, «${topDev.category}» registra più sessioni (${topDev.sessions.toLocaleString("it-IT")}).`
    );
  }
  return bullets;
}

async function fetchGa4ChartsBundle(
  accessToken: string,
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<Ga4ChartsReportPayload> {
  const dateRanges = [{ startDate: toGa4Date(dateFrom), endDate: toGa4Date(dateTo) }];
  const orderDateAsc = [{ dimension: { dimensionName: "date" } }];
  const [
    trendJson,
    trendUsersJson,
    sessChJson,
    fuChJson,
    deviceJson,
    firstUserSmJson,
    landingJson,
  ] = await Promise.all([
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: orderDateAsc,
      limit: 10000,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "newUsers" }, { name: "activeUsers" }],
      orderBys: orderDateAsc,
      limit: 10000,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit: 15,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "firstUserDefaultChannelGroup" }],
      metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
      orderBys: [{ desc: true, metric: { metricName: "activeUsers" } }],
      limit: 15,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit: 10,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "firstUserSource" }, { name: "firstUserMedium" }],
      metrics: [{ name: "sessions" }, { name: "newUsers" }],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit: 15,
    }),
    ga4RunReportJson(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ desc: true, metric: { metricName: "sessions" } }],
      limit: 15,
    }),
  ]);

  const trend = trendJson?.rows ? parseTrendSessionsUsers(trendJson.rows) : [];
  const trendUsers = trendUsersJson?.rows ? parseTrendNewUsers(trendUsersJson.rows) : [];
  const channels = sessChJson?.rows ? parseSessionChannelRows(sessChJson.rows) : [];
  const firstUserChannels = fuChJson?.rows ? parseFirstUserChannelRows(fuChJson.rows) : [];
  const devices = deviceJson?.rows ? parseDeviceCategoryRows(deviceJson.rows) : [];
  const firstUserAcquisition = firstUserSmJson?.rows
    ? parseFirstUserSourceMediumRows(firstUserSmJson.rows)
    : [];
  const landingPages = landingJson?.rows ? parseLandingPageRows(landingJson.rows) : [];
  const chartInsights =
    channels.length > 0 || firstUserChannels.length > 0 || devices.length > 0
      ? buildChartInsights(channels, firstUserChannels, devices)
      : undefined;

  return {
    trend,
    trendUsers,
    channels,
    firstUserChannels,
    devices,
    firstUserAcquisition,
    landingPages,
    chartInsights,
  };
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

export async function fetchGa4TrafficSummary(input: {
  dateFrom: string;
  dateTo: string;
  propertyId?: string;
  workspaceId?: string;
  includeRecommerceWeb?: boolean;
  includeGa4Charts?: boolean;
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

  const includeRecommerce = input.includeRecommerceWeb === true;
  const includeCharts = input.includeGa4Charts === true;

  if (input.workspaceId) {
    const access = await getGoogleMarketingUserAccessToken(input.workspaceId);
    if (access) {
      const summary = await fetchGa4SummaryViaOAuth(access, prop, input.dateFrom, input.dateTo);
      if (summary !== null) {
        let recommerceWeb: Ga4RecommerceWebPayload | undefined;
        let report: Ga4ChartsReportPayload | undefined;
        const emptyCharts: Ga4ChartsReportPayload = {
          trend: [],
          trendUsers: [],
          channels: [],
          firstUserChannels: [],
          devices: [],
          firstUserAcquisition: [],
          landingPages: [],
        };
        const wsId = input.workspaceId;
        const [recommerceResult, chartsResult, propertyDisplayName] = await Promise.all([
          includeRecommerce
            ? fetchGa4RecommerceWebViaOAuth(access, prop, input.dateFrom, input.dateTo).catch((e) => {
                logger.warn({ err: e }, "GA4 recommerce web fetch failed");
                return {
                  topFilterDimensions: [] as Ga4RecommerceFilterAgg[],
                  topAptViewsFromGa4: [] as Ga4RecommerceAptFromGa4[],
                  error: e instanceof Error ? e.message : "Errore report recommerce GA4",
                } satisfies Ga4RecommerceWebPayload;
              })
            : Promise.resolve(undefined),
          includeCharts
            ? fetchGa4ChartsBundle(access, prop, input.dateFrom, input.dateTo).catch((e) => {
                logger.warn({ err: e }, "GA4 charts bundle fetch failed");
                return { ...emptyCharts };
              })
            : Promise.resolve(undefined),
          wsId
            ? lookupGa4PropertyDisplayLabel(wsId, prop).catch((e) => {
                logger.warn({ err: e }, "GA4 property display name lookup failed");
                return undefined;
              })
            : Promise.resolve(undefined),
        ]);
        if (recommerceResult) recommerceWeb = recommerceResult;
        if (chartsResult) report = chartsResult;
        return {
          configured: true,
          propertyId: prop,
          ...(propertyDisplayName ? { propertyDisplayName } : {}),
          summary,
          ...(recommerceWeb ? { recommerceWeb } : {}),
          ...(report ? { report } : {}),
        };
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
