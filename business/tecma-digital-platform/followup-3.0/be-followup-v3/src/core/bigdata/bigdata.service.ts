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

const BigDataQuerySchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  attributionModel: z.enum(["last_touch", "first_touch"]).default("last_touch"),
});

const CACHE_COLLECTION = "tz_bigdata_cache";
const CACHE_TTL_MS = 60 * 60 * 1000;

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
  /** Nuovi clienti nel periodo (CRM). */
  leads: number;
  /** Eventi calendario con clientId nel periodo. */
  appointments: number;
  /** Trattative in stato preventivo/offerta aggiornate nel periodo. */
  proposals: number;
  /** Trattative vinte (won) aggiornate nel periodo. */
  sales: number;
}

export interface BigDataTopApartment {
  apartmentId: string;
  apartmentCode?: string;
  requestCount: number;
}

export interface BigDataSnapshot {
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
  };
  crm: {
    channels: BigDataChannelRow[];
    funnelTotals: BigDataFunnelTotals;
    topApartments: BigDataTopApartment[];
  };
  marketing: {
    googleAds: Awaited<ReturnType<typeof fetchGoogleAdsCampaignInsights>>;
    meta: Awaited<ReturnType<typeof fetchMetaCampaignInsights>>;
    ga4: Awaited<ReturnType<typeof fetchGa4TrafficSummary>>;
  };
  reconciliationNotes: string[];
  cachedAt: string;
  cacheExpiresAt: string;
}

function cacheKey(input: z.infer<typeof BigDataQuerySchema>): string {
  const raw = JSON.stringify({
    w: input.workspaceId,
    p: input.projectId,
    f: input.dateFrom,
    t: input.dateTo,
    m: input.attributionModel,
  });
  return createHash("sha256").update(raw).digest("hex");
}

export async function getBigDataProjectSnapshot(rawInput: unknown): Promise<{ data: BigDataSnapshot }> {
  const input = BigDataQuerySchema.parse(rawInput);
  const db = getDb();
  const key = cacheKey(input);
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
    const touch =
      isMarketingAttributionDoc(attr) ? pickTouchFromDoc(attr, attributionModel) : undefined;
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

  const [googleAds, meta, ga4] = await Promise.all([
    fetchGoogleAdsCampaignInsights({ dateFrom, dateTo }),
    fetchMetaCampaignInsights({ dateFrom, dateTo }),
    fetchGa4TrafficSummary({ dateFrom, dateTo }),
  ]);

  const reconciliationNotes: string[] = [
    "Lead = nuovo cliente CRM (tz_clients) creato nel periodo.",
    "Appuntamento = evento calendario con clientId nel periodo.",
    "Proposta = trattativa in stato quote o offer con updatedAt nel periodo.",
    "Vendita = trattativa won con updatedAt nel periodo.",
    attributionModel === "last_touch"
      ? "Attribuzione canale: last touch (marketingAttribution.lastTouch)."
      : "Attribuzione canale: first touch (marketingAttribution.firstTouch).",
  ];
  if (googleAds.error) reconciliationNotes.push(`Google Ads: ${googleAds.error}`);
  if (meta.error) reconciliationNotes.push(`Meta: ${meta.error}`);
  if (ga4.error) reconciliationNotes.push(`GA4: ${ga4.error}`);

  const snapshot: BigDataSnapshot = {
    projectId,
    workspaceId,
    dateRange: { from: dateFrom, to: dateTo },
    attributionModel,
    definitions: {
      lead: "Nuovo record cliente nel periodo selezionato.",
      appointment: "Evento in calendar_events con clientId e data inizio nel periodo.",
      proposal: "Trattativa in stato preventivo o offerta (quote/offer) aggiornata nel periodo.",
      sale: "Trattativa in stato won aggiornata nel periodo.",
      attribution:
        attributionModel === "last_touch"
          ? "Campagne/UTM derivate da marketingAttribution.lastTouch al momento del lead."
          : "Campagne/UTM derivate da marketingAttribution.firstTouch al momento del lead.",
    },
    crm: {
      channels,
      funnelTotals: {
        leads: allNewClientIds.length,
        appointments: appointmentsTotal,
        proposals: proposalsTotal,
        sales: salesTotal,
      },
      topApartments,
    },
    marketing: { googleAds, meta, ga4 },
    reconciliationNotes,
    cachedAt: nowIso,
    cacheExpiresAt: expiresAt,
  };

  await db.collection(CACHE_COLLECTION).updateOne(
    { cacheKey: key },
    {
      $set: {
        cacheKey: key,
        workspaceId,
        projectId,
        payload: snapshot,
        expiresAt,
        createdAt: nowIso,
      },
    },
    { upsert: true }
  );

  return { data: snapshot };
}
