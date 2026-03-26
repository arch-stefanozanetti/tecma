import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import {
  attributionGroupKey,
  isMarketingAttributionDoc,
  pickTouchFromDoc,
} from "../marketing/marketing-attribution.schema.js";
import { fetchGoogleAdsCampaignInsights } from "../marketing/google-ads-insights.stub.js";
import { fetchGa4TrafficSummary } from "../marketing/ga4-insights.stub.js";
import { fetchMetaCampaignInsights } from "../marketing/meta-ads-insights.stub.js";
import {
  getProjectMarketingSettingsRaw,
  type ProjectMarketingSettingsRow,
} from "../projects/project-marketing-settings.service.js";
import { aggregateTopPropertyViews } from "../platform/property-views.service.js";
import { logger } from "../../observability/logger.js";

export type BigDataSection = "full" | "overview" | "ads" | "meta" | "ga4" | "funnel" | "listings";

const BigDataQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  attributionModel: z.enum(["last_touch", "first_touch"]).default("last_touch"),
  section: z
    .enum(["full", "overview", "ads", "meta", "ga4", "funnel", "listings"])
    .optional()
    .default("full"),
});

const CACHE_COLLECTION = "tz_bigdata_cache";
const CACHE_TTL_MS = 60 * 60 * 1000;

export const BIG_DATA_CACHE_SCHEMA_VERSION = 4;

export interface BigDataChannelRow {
  key: string;
  utmSource: string;
  utmCampaign: string;
  leads: number;
  withAppointment: number;
  withProposal: number;
  sales: number;
}

export interface BigDataFunnelTotals {
  leads: number;
  appointments: number;
  proposals: number;
  sales: number;
}

export interface BigDataTopApartment {
  apartmentId: string;
  apartmentCode?: string;
  requestCount: number;
}

export interface BigDataTopPropertyView {
  listingId?: string;
  apartmentId?: string;
  viewCount: number;
}

export interface BigDataFunnelBridge {
  /** Somma impressions campagne Ads+Meta se disponibili. */
  impressions?: number;
  clicks?: number;
  sessions?: number;
  leads: number;
  sales: number;
}

export interface BigDataSnapshot {
  section?: BigDataSection;
  projectId: string;
  workspaceId: string;
  dateRange: { from: string; to: string };
  attributionModel: "last_touch" | "first_touch";
  definitions: {
    lead: string;
    appointment: string;
    proposal: string;
    sale: string;
    attribution: string;
    propertyView?: string;
  };
  crm: {
    channels: BigDataChannelRow[];
    funnelTotals: BigDataFunnelTotals;
    topApartments: BigDataTopApartment[];
  };
  listings?: {
    topPropertyViews: BigDataTopPropertyView[];
  };
  funnelBridge?: BigDataFunnelBridge;
  marketing: {
    googleAds: Awaited<ReturnType<typeof fetchGoogleAdsCampaignInsights>>;
    meta: Awaited<ReturnType<typeof fetchMetaCampaignInsights>>;
    ga4: Awaited<ReturnType<typeof fetchGa4TrafficSummary>>;
  };
  reconciliationNotes: string[];
  cachedAt: string;
  cacheExpiresAt: string;
}

/** Evita cache stale quando cambiano gli ID marketing salvati sulla scheda progetto. */
function bigDataMarketingFingerprint(settings: ProjectMarketingSettingsRow | null): string {
  if (!settings) return "||||";
  return [
    settings.googleAdsCustomerId?.trim() ?? "",
    settings.googleAdsLoginCustomerId?.trim() ?? "",
    settings.ga4PropertyId?.trim() ?? "",
    settings.metaAdAccountId?.trim() ?? "",
  ].join("|");
}

function cacheKey(input: z.infer<typeof BigDataQuerySchema>, marketingFp: string): string {
  const raw = JSON.stringify({
    v: BIG_DATA_CACHE_SCHEMA_VERSION,
    w: input.workspaceId,
    p: input.projectId,
    f: input.dateFrom,
    t: input.dateTo,
    m: input.attributionModel,
    s: input.section,
    mk: marketingFp,
  });
  return createHash("sha256").update(raw).digest("hex");
}

function baseDefinitions(
  attributionModel: "last_touch" | "first_touch"
): BigDataSnapshot["definitions"] {
  return {
    lead: "Nuovo record cliente nel periodo selezionato.",
    appointment: "Evento in calendar_events con clientId e data inizio nel periodo.",
    proposal: "Trattativa in stato preventivo o offerta (quote/offer) aggiornata nel periodo.",
    sale: "Trattativa in stato won aggiornata nel periodo.",
    attribution:
      attributionModel === "last_touch"
        ? "Campagne/UTM derivate da marketingAttribution.lastTouch al momento del lead."
        : "Campagne/UTM derivate da marketingAttribution.firstTouch al momento del lead.",
    propertyView: "Evento first-party inviato dal sito (Platform API property-views) con listingId o apartmentId.",
  };
}

async function buildCrmBlock(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  projectId: string,
  dateFrom: string,
  dateTo: string,
  attributionModel: "last_touch" | "first_touch",
  includeChannels: boolean
): Promise<{
  channels: BigDataChannelRow[];
  funnelTotals: BigDataFunnelTotals;
  topApartments: BigDataTopApartment[];
  allNewClientIds: string[];
}> {
  const dateFilter = { $gte: dateFrom, $lte: dateTo };

  const clientsColl = db.collection("tz_clients");
  const newClients = await clientsColl
    .find({
      workspaceId,
      projectId,
      createdAt: dateFilter,
    })
    .project({ _id: 1, marketingAttribution: 1 })
    .toArray();

  const channelToClientIds = new Map<string, string[]>();
  for (const c of newClients) {
    const id = String(c._id ?? "");
    const attr = c.marketingAttribution;
    const touch = isMarketingAttributionDoc(attr) ? pickTouchFromDoc(attr, attributionModel) : undefined;
    const gk = attributionGroupKey(touch);
    const list = channelToClientIds.get(gk) ?? [];
    list.push(id);
    channelToClientIds.set(gk, list);
  }

  const allNewClientIds = newClients.map((c) => String(c._id ?? ""));

  const calColl = db.collection("calendar_events");
  const appointmentFilter = {
    workspaceId,
    projectId,
    startsAt: dateFilter,
    clientId: { $exists: true, $nin: ["", null] },
  };
  const appointmentsTotal = await calColl.countDocuments(appointmentFilter);

  const reqColl = db.collection("tz_requests");
  const proposalsTotal = await reqColl.countDocuments({
    workspaceId,
    projectId,
    status: { $in: ["quote", "offer"] },
    updatedAt: dateFilter,
  });
  const salesTotal = await reqColl.countDocuments({
    workspaceId,
    projectId,
    status: "won",
    updatedAt: dateFilter,
  });

  const channels: BigDataChannelRow[] = [];
  if (includeChannels) {
    for (const [keyStr, clientIds] of channelToClientIds) {
      const parts = keyStr.split("::");
      const utmSource = parts[0] || "unknown";
      const utmCampaign = parts.length > 1 ? parts.slice(1).join("::") : "unknown";
      if (clientIds.length === 0) continue;

      const apptClients = await calColl.distinct("clientId", {
        ...appointmentFilter,
        clientId: { $in: clientIds },
      });
      const withAppointment = apptClients.filter(Boolean).length;

      const propClients = await reqColl.distinct("clientId", {
        workspaceId,
        projectId,
        clientId: { $in: clientIds },
        status: { $in: ["quote", "offer"] },
        updatedAt: dateFilter,
      });
      const withProposal = propClients.filter(Boolean).length;

      const saleClients = await reqColl.distinct("clientId", {
        workspaceId,
        projectId,
        clientId: { $in: clientIds },
        status: "won",
        updatedAt: dateFilter,
      });
      const sales = saleClients.filter(Boolean).length;

      channels.push({
        key: keyStr,
        utmSource,
        utmCampaign,
        leads: clientIds.length,
        withAppointment,
        withProposal,
        sales,
      });
    }
    channels.sort((a, b) => b.leads - a.leads);
  }

  const aptAgg = await reqColl
    .aggregate<{ _id: unknown; c: number }>([
      {
        $match: {
          workspaceId,
          projectId,
          apartmentId: { $exists: true, $nin: [null, ""] },
          updatedAt: dateFilter,
        },
      },
      { $group: { _id: "$apartmentId", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 15 },
    ])
    .toArray();

  const aptColl = db.collection("tz_apartments");
  const topApartments: BigDataTopApartment[] = [];
  for (const row of aptAgg) {
    const aid = String(row._id ?? "");
    if (!ObjectId.isValid(aid)) continue;
    const apt = await aptColl.findOne({ _id: new ObjectId(aid) }, { projection: { code: 1 } });
    topApartments.push({
      apartmentId: aid,
      apartmentCode: typeof apt?.code === "string" ? apt.code : undefined,
      requestCount: row.c,
    });
  }

  return {
    channels,
    funnelTotals: {
      leads: allNewClientIds.length,
      appointments: appointmentsTotal,
      proposals: proposalsTotal,
      sales: salesTotal,
    },
    topApartments,
    allNewClientIds,
  };
}

async function fetchMarketingForProject(
  workspaceId: string,
  projectId: string,
  dateFrom: string,
  dateTo: string,
  opts?: { includeGa4Recommerce?: boolean; includeGa4Charts?: boolean }
): Promise<BigDataSnapshot["marketing"]> {
  const settings = (await getProjectMarketingSettingsRaw(projectId)) ?? undefined;
  const customerId = settings?.googleAdsCustomerId?.trim();
  const loginCustomerId = settings?.googleAdsLoginCustomerId?.trim();
  const ga4PropertyId = settings?.ga4PropertyId?.trim();
  const metaAdAccountId = settings?.metaAdAccountId?.trim();

  const [googleAds, meta, ga4] = await Promise.all([
    fetchGoogleAdsCampaignInsights({
      dateFrom,
      dateTo,
      customerId,
      loginCustomerId,
      workspaceId,
    }),
    fetchMetaCampaignInsights({
      dateFrom,
      dateTo,
      adAccountId: metaAdAccountId,
      workspaceId,
    }),
    fetchGa4TrafficSummary({
      dateFrom,
      dateTo,
      propertyId: ga4PropertyId,
      workspaceId,
      includeRecommerceWeb: opts?.includeGa4Recommerce === true,
      includeGa4Charts: opts?.includeGa4Charts === true,
    }),
  ]);

  return { googleAds, meta, ga4 };
}

const EMPTY_MARKETING_BLOCK: BigDataSnapshot["marketing"] = {
  googleAds: { configured: false, campaigns: [] },
  meta: { configured: false, campaigns: [] },
  ga4: { configured: false, summary: {} },
};

/** Evita HTTP 500 se GA4/OAuth/network lancia durante Promise.all. */
async function fetchMarketingForProjectSafe(
  workspaceId: string,
  projectId: string,
  dateFrom: string,
  dateTo: string,
  opts?: { includeGa4Recommerce?: boolean; includeGa4Charts?: boolean }
): Promise<BigDataSnapshot["marketing"]> {
  try {
    return await fetchMarketingForProject(workspaceId, projectId, dateFrom, dateTo, opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ err: e, workspaceId, projectId }, "fetchMarketingForProject failed");
    return {
      ...EMPTY_MARKETING_BLOCK,
      ga4: {
        configured: false,
        summary: {},
        error: `Caricamento dati marketing fallito: ${msg.slice(0, 240)}`,
      },
    };
  }
}

function sumCampaignImpressions(
  campaigns: Array<{ impressions?: number; clicks?: number }>
): { impressions: number; clicks: number } {
  let impressions = 0;
  let clicks = 0;
  for (const c of campaigns) {
    impressions += typeof c.impressions === "number" ? c.impressions : 0;
    clicks += typeof c.clicks === "number" ? c.clicks : 0;
  }
  return { impressions, clicks };
}

function buildFunnelBridge(
  marketing: BigDataSnapshot["marketing"],
  funnelTotals: BigDataFunnelTotals
): BigDataFunnelBridge {
  const g = sumCampaignImpressions(marketing.googleAds?.campaigns ?? []);
  const m = sumCampaignImpressions(marketing.meta?.campaigns ?? []);
  const impressions = g.impressions + m.impressions > 0 ? g.impressions + m.impressions : undefined;
  const clicks = g.clicks + m.clicks > 0 ? g.clicks + m.clicks : undefined;
  const sessions =
    typeof marketing.ga4?.summary?.sessions === "number" ? marketing.ga4.summary.sessions : undefined;
  return {
    ...(impressions !== undefined ? { impressions } : {}),
    ...(clicks !== undefined ? { clicks } : {}),
    ...(sessions !== undefined ? { sessions } : {}),
    leads: funnelTotals.leads,
    sales: funnelTotals.sales,
  };
}

function baseReconciliationNotes(
  attributionModel: "last_touch" | "first_touch",
  marketing: BigDataSnapshot["marketing"]
): string[] {
  const notes: string[] = [
    "Lead = nuovo cliente CRM (tz_clients) creato nel periodo.",
    "Appuntamento = evento calendario con clientId nel periodo.",
    "Proposta = trattativa in stato quote o offer con updatedAt nel periodo.",
    "Vendita = trattativa won con updatedAt nel periodo.",
    attributionModel === "last_touch"
      ? "Attribuzione canale: last touch (marketingAttribution.lastTouch)."
      : "Attribuzione canale: first touch (marketingAttribution.firstTouch).",
  ];
  if (marketing.googleAds?.error) notes.push(`Google Ads: ${marketing.googleAds.error}`);
  if (marketing.meta?.error) notes.push(`Meta: ${marketing.meta.error}`);
  if (marketing.ga4?.error) notes.push(`GA4: ${marketing.ga4.error}`);
  return notes;
}

export async function getBigDataProjectSnapshot(rawInput: unknown): Promise<{ data: BigDataSnapshot }> {
  const input = BigDataQuerySchema.parse(rawInput);
  const section: BigDataSection = input.section ?? "full";
  const db = getDb();
  const mktRow = await getProjectMarketingSettingsRaw(input.projectId);
  const key = cacheKey(input, bigDataMarketingFingerprint(mktRow));
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS).toISOString();

  const cached = await db.collection(CACHE_COLLECTION).findOne({ cacheKey: key });
  if (cached && typeof cached.expiresAt === "string" && new Date(cached.expiresAt).getTime() > Date.now()) {
    const payload = cached.payload as BigDataSnapshot;
    return {
      data: {
        ...payload,
        cachedAt: typeof cached.createdAt === "string" ? cached.createdAt : nowIso,
        cacheExpiresAt: cached.expiresAt,
      },
    };
  }

  const { workspaceId, projectId, dateFrom, dateTo, attributionModel } = input;
  const definitions = baseDefinitions(attributionModel);

  const topPvRows = await aggregateTopPropertyViews(workspaceId, projectId, dateFrom, dateTo, 15);
  const topPropertyViews: BigDataTopPropertyView[] = topPvRows.map((r) => ({
    ...(r.listingId ? { listingId: r.listingId } : {}),
    ...(r.apartmentId ? { apartmentId: r.apartmentId } : {}),
    viewCount: r.viewCount,
  }));

  let snapshot: BigDataSnapshot;

  if (section === "ads") {
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: false,
      includeGa4Charts: false,
    });
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, false);
    snapshot = {
      section: "ads",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: { channels: [], funnelTotals: crm.funnelTotals, topApartments: [] },
      marketing: { googleAds: marketing.googleAds, meta: marketing.meta, ga4: marketing.ga4 },
      reconciliationNotes: baseReconciliationNotes(attributionModel, marketing),
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else if (section === "meta") {
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: false,
      includeGa4Charts: false,
    });
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, false);
    snapshot = {
      section: "meta",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: { channels: [], funnelTotals: crm.funnelTotals, topApartments: [] },
      marketing: { googleAds: marketing.googleAds, meta: marketing.meta, ga4: marketing.ga4 },
      reconciliationNotes: baseReconciliationNotes(attributionModel, marketing),
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else if (section === "ga4") {
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: true,
      includeGa4Charts: true,
    });
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, false);
    snapshot = {
      section: "ga4",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: { channels: [], funnelTotals: crm.funnelTotals, topApartments: [] },
      marketing: { googleAds: marketing.googleAds, meta: marketing.meta, ga4: marketing.ga4 },
      reconciliationNotes: baseReconciliationNotes(attributionModel, marketing),
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else if (section === "funnel") {
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, true);
    const marketing = {
      googleAds: { configured: false, campaigns: [] },
      meta: { configured: false, campaigns: [] },
      ga4: { configured: false, summary: {} },
    } as BigDataSnapshot["marketing"];
    snapshot = {
      section: "funnel",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: {
        channels: crm.channels,
        funnelTotals: crm.funnelTotals,
        topApartments: crm.topApartments,
      },
      marketing,
      reconciliationNotes: baseReconciliationNotes(attributionModel, marketing),
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else if (section === "listings") {
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, false);
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: true,
      includeGa4Charts: true,
    });
    snapshot = {
      section: "listings",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: {
        channels: [],
        funnelTotals: crm.funnelTotals,
        topApartments: crm.topApartments,
      },
      listings: { topPropertyViews },
      marketing,
      reconciliationNotes: [
        ...baseReconciliationNotes(attributionModel, marketing),
        "Top trattative = tz_requests per apartmentId nel periodo.",
        "Top visualizzazioni = eventi tz_property_view_events nel periodo.",
        "GA4 listino web: filtri e schede da URL quando OAuth e proprietà GA4 sono attivi.",
      ],
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else if (section === "overview") {
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, false);
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: false,
      includeGa4Charts: false,
    });
    const funnelBridge = buildFunnelBridge(marketing, crm.funnelTotals);
    snapshot = {
      section: "overview",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: {
        channels: [],
        funnelTotals: crm.funnelTotals,
        topApartments: [],
      },
      listings: { topPropertyViews },
      funnelBridge,
      marketing,
      reconciliationNotes: baseReconciliationNotes(attributionModel, marketing),
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  } else {
    const crm = await buildCrmBlock(db, workspaceId, projectId, dateFrom, dateTo, attributionModel, true);
    const marketing = await fetchMarketingForProjectSafe(workspaceId, projectId, dateFrom, dateTo, {
      includeGa4Recommerce: true,
      includeGa4Charts: true,
    });
    const reconciliationNotes = baseReconciliationNotes(attributionModel, marketing);
    snapshot = {
      section: "full",
      projectId,
      workspaceId,
      dateRange: { from: dateFrom, to: dateTo },
      attributionModel,
      definitions,
      crm: {
        channels: crm.channels,
        funnelTotals: crm.funnelTotals,
        topApartments: crm.topApartments,
      },
      listings: { topPropertyViews },
      funnelBridge: buildFunnelBridge(marketing, crm.funnelTotals),
      marketing,
      reconciliationNotes,
      cachedAt: nowIso,
      cacheExpiresAt: expiresAt,
    };
  }

  await db.collection(CACHE_COLLECTION).updateOne(
    { cacheKey: key },
    {
      $set: {
        cacheKey: key,
        workspaceId,
        projectId,
        section,
        payload: snapshot,
        expiresAt,
        createdAt: nowIso,
      },
    },
    { upsert: true }
  );

  return { data: snapshot };
}
