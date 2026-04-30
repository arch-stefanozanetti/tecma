/**
 * KPI economici affitto (stima): MRR da canoni mensili su unità locato,
 * valore trattative affitto chiuse nel periodo (campo budget su tz_requests).
 * Non sostituisce contabilità o incassi reali.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const RentRevenueInputSchema = z.object({
  workspaceId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
const RentRevenueAiInputSchema = RentRevenueInputSchema.extend({
  query: z.string().min(1).max(500),
});

const WON_STATUSES = ["won", "closed_won", "venduto", "locato"] as const;
const LOST_STATUSES = ["lost", "closed_lost"] as const;
const TERMINAL_STATUSES = [...WON_STATUSES, ...LOST_STATUSES] as const;

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

function normalizeRange(dateFrom?: string, dateTo?: string): { dateFrom: string; dateTo: string } {
  const d = defaultDateRange();
  let from = (dateFrom?.trim() || d.dateFrom).slice(0, 10);
  let to = (dateTo?.trim() || d.dateTo).slice(0, 10);
  if (from > to) {
    const t = from;
    from = to;
    to = t;
  }
  return { dateFrom: from, dateTo: to };
}

/** Fine giornata UTC per confronti ISO con validTo su monthly rents */
function asOfIsoFromDateTo(dateTo: string): string {
  const base = dateTo.length >= 10 ? dateTo.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return new Date(`${base}T23:59:59.999Z`).toISOString();
}

function listMonthsInclusive(fromYm: string, toYm: string): string[] {
  const out: string[] = [];
  const [fy, fm] = fromYm.split("-").map((x) => Number.parseInt(x, 10));
  const [ty, tm] = toYm.split("-").map((x) => Number.parseInt(x, 10));
  let y = fy;
  let m = fm;
  for (;;) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (y === ty && m === tm) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function ymFromIsoRange(dateFrom: string, dateTo: string): { fromYm: string; toYm: string } {
  return {
    fromYm: dateFrom.slice(0, 7),
    toYm: dateTo.slice(0, 7),
  };
}

export interface RentRevenueMonthPoint {
  /** Chiave YYYY-MM */
  month: string;
  /** Somma budget (o budgetMax) richieste affitto chiuse nel mese (proxy valore commerciale). */
  wonDealsValue: number;
  wonDealsCount: number;
  /** MRR stimato a data di riferimento (flat su tutte le barre per confronto visivo). */
  estimatedMrr: number;
}

export interface RentRevenueSummaryData {
  currency: string;
  /** Data/ora di calcolo lato server */
  computedAt: string;
  /** Canoni valutati alla fine del periodo richiesto (non oltre adesso). */
  asOf: string;
  dateFrom: string;
  dateTo: string;
  methodology: string;
  rentUnitsListed: number;
  rentUnitsRented: number;
  /** Somma canoni mensili correnti (tz_monthly_rents) per unità mode=RENT e status=RENTED. */
  estimatedMrr: number;
  periodWonDealsCount: number;
  periodWonDealsValue: number;
  openRentPipelineDeals: number;
  openRentPipelineValue: number;
  cumulativeWonDealsCount: number;
  cumulativeWonDealsValue: number;
  monthsInPeriod: number;
  /** MRR × mesi nel periodo: scenario “tariffe attuali × durata”, non incassi certi. */
  theoreticalPeriodCanoni: number;
  monthly: RentRevenueMonthPoint[];
  dataQuality: {
    wonDealsWithoutQuoteLink: number;
    wonDealsWithoutAmount: number;
    wonDealsWithoutEffectiveDate: number;
    recurringCanoneMissingByModel: boolean;
    notes: string[];
  };
}

export async function getRentRevenueSummary(rawInput: unknown): Promise<{ data: RentRevenueSummaryData }> {
  const parsed = RentRevenueInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new HttpError("Parametri non validi per rent revenue summary", 400);
  }
  const { workspaceId, projectIds } = parsed.data;
  const { dateFrom, dateTo } = normalizeRange(parsed.data.dateFrom, parsed.data.dateTo);
  const asOfCap = new Date().toISOString();
  const asOf = asOfIsoFromDateTo(dateTo < asOfCap.slice(0, 10) ? dateTo : asOfCap.slice(0, 10));

  const db = getDb();
  const apt = db.collection("tz_apartments");
  const req = db.collection("tz_requests");
  const quotes = db.collection("tz_quotes");

  const baseApt = { workspaceId, projectId: { $in: projectIds }, mode: "RENT" as const };

  const [rentUnitsListed, rentUnitsRented, mrrAgg, wonPeriodRows, wonCumulativeRows, openPipe] = await Promise.all([
    apt.countDocuments(baseApt),
    apt.countDocuments({ ...baseApt, status: "RENTED" }),
    apt
      .aggregate([
        { $match: { ...baseApt, status: "RENTED" } },
        { $addFields: { unitIdStr: { $toString: "$_id" } } },
        {
          $lookup: {
            from: "tz_monthly_rents",
            let: { uid: "$unitIdStr" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$unitId", "$$uid"] },
                      { $lte: ["$validFrom", asOf] },
                      {
                        $or: [
                          { $eq: [{ $type: "$validTo" }, "missing"] },
                          { $eq: ["$validTo", null] },
                          { $gte: ["$validTo", asOf] },
                        ],
                      },
                    ],
                  },
                },
              },
              { $sort: { validFrom: -1 } },
              { $limit: 1 },
            ],
            as: "currentRent",
          },
        },
        {
          $addFields: {
            ppm: {
              $ifNull: [{ $arrayElemAt: ["$currentRent.pricePerMonth", 0] }, 0],
            },
          },
        },
        { $group: { _id: null, mrr: { $sum: "$ppm" } } },
      ])
      .toArray(),
    req
      .find(
        {
          workspaceId,
          projectId: { $in: projectIds },
          type: "rent",
          status: { $in: [...WON_STATUSES] },
          updatedAt: { $gte: `${dateFrom}T00:00:00.000Z`, $lte: `${dateTo}T23:59:59.999Z` },
        },
        {
          projection: {
            _id: 1,
            quoteId: 1,
            quoteTotalPrice: 1,
            quoteExpiryOn: 1,
            budget: 1,
            budgetMax: 1,
            updatedAt: 1,
            apartmentId: 1,
          },
        }
      )
      .toArray(),
    req
      .find(
        {
          workspaceId,
          projectId: { $in: projectIds },
          type: "rent",
          status: { $in: [...WON_STATUSES] },
          updatedAt: { $lte: `${dateTo}T23:59:59.999Z` },
        },
        {
          projection: {
            _id: 1,
            quoteId: 1,
            quoteTotalPrice: 1,
            budget: 1,
            budgetMax: 1,
          },
        }
      )
      .toArray(),
    req
      .aggregate([
        {
          $match: {
            workspaceId,
            projectId: { $in: projectIds },
            type: "rent",
            status: { $nin: [...TERMINAL_STATUSES] },
          },
        },
        {
          $group: {
            _id: null,
            deals: { $sum: 1 },
            value: {
              $sum: {
                $convert: {
                  input: { $ifNull: ["$budgetMax", "$budget"] },
                  to: "double",
                  onError: 0,
                  onNull: 0,
                },
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const wonRows = wonPeriodRows as Array<{
    _id?: unknown;
    quoteId?: unknown;
    quoteTotalPrice?: unknown;
    quoteExpiryOn?: unknown;
    budget?: unknown;
    budgetMax?: unknown;
    updatedAt?: unknown;
    apartmentId?: unknown;
  }>;
  const wonRowsCumulative = wonCumulativeRows as Array<{
    quoteId?: unknown;
    quoteTotalPrice?: unknown;
    budget?: unknown;
    budgetMax?: unknown;
  }>;
  const quoteIds = Array.from(
    new Set(
      wonRows
        .map((r) => (typeof r.quoteId === "string" ? r.quoteId.trim() : ""))
        .filter((x) => x.length > 0)
    )
  );
  const quoteObjectIds = quoteIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const quoteRows = quoteObjectIds.length
    ? ((await quotes
        .find(
          { workspaceId, _id: { $in: quoteObjectIds } },
          { projection: { _id: 1, totalPrice: 1, expiryOn: 1 } }
        )
        .toArray()) as Array<Record<string, unknown>>)
    : [];
  const quoteMap = new Map<string, { totalPrice?: number; expiryOn?: string }>();
  for (const row of quoteRows) {
    const key = typeof row._id === "object" && row._id !== null ? String((row._id as { toString?: () => string }).toString?.() ?? "") : "";
    if (!key) continue;
    quoteMap.set(key, {
      totalPrice: typeof row.totalPrice === "number" ? row.totalPrice : undefined,
      expiryOn: typeof row.expiryOn === "string" ? row.expiryOn : undefined,
    });
  }
  const pickValue = (row: { quoteId?: unknown; quoteTotalPrice?: unknown; budget?: unknown; budgetMax?: unknown }): number => {
    const quoteId = typeof row.quoteId === "string" ? row.quoteId : "";
    const quoteValue = quoteId ? quoteMap.get(quoteId)?.totalPrice : undefined;
    if (typeof quoteValue === "number" && Number.isFinite(quoteValue)) return quoteValue;
    if (typeof row.quoteTotalPrice === "number" && Number.isFinite(row.quoteTotalPrice)) return row.quoteTotalPrice;
    if (typeof row.budgetMax === "number" && Number.isFinite(row.budgetMax)) return row.budgetMax;
    if (typeof row.budget === "number" && Number.isFinite(row.budget)) return row.budget;
    return 0;
  };

  const estimatedMrr = Number((mrrAgg[0] as { mrr?: number } | undefined)?.mrr ?? 0);
  const periodWonDealsCount = wonRows.length;
  const periodWonDealsValue = Number(wonRows.reduce((acc, row) => acc + pickValue(row), 0));
  const cumulativeWonDealsCount = wonRowsCumulative.length;
  const cumulativeWonDealsValue = Number(wonRowsCumulative.reduce((acc, row) => acc + pickValue(row), 0));
  const openRentPipelineDeals = Number((openPipe[0] as { deals?: number } | undefined)?.deals ?? 0);
  const openRentPipelineValue = Number((openPipe[0] as { value?: number } | undefined)?.value ?? 0);

  const { fromYm, toYm } = ymFromIsoRange(dateFrom, dateTo);
  const monthKeys = listMonthsInclusive(fromYm, toYm);
  const monthsInPeriod = monthKeys.length;
  const wonByMonth = new Map<string, { wonDealsValue: number; wonDealsCount: number }>();
  for (const row of wonRows) {
    const rawUpdated = row.updatedAt;
    const iso =
      rawUpdated instanceof Date
        ? rawUpdated.toISOString()
        : typeof rawUpdated === "string"
          ? rawUpdated
          : "";
    if (!iso || iso.length < 7) continue;
    const month = iso.slice(0, 7);
    const current = wonByMonth.get(month) ?? { wonDealsValue: 0, wonDealsCount: 0 };
    current.wonDealsCount += 1;
    current.wonDealsValue += pickValue(row);
    wonByMonth.set(month, current);
  }

  const monthly: RentRevenueMonthPoint[] = monthKeys.map((month) => {
    const w = wonByMonth.get(month) ?? { wonDealsValue: 0, wonDealsCount: 0 };
    return {
      month,
      wonDealsValue: w.wonDealsValue,
      wonDealsCount: w.wonDealsCount,
      estimatedMrr,
    };
  });

  const theoreticalPeriodCanoni = Number((estimatedMrr * monthsInPeriod).toFixed(2));

  const wonDealsWithoutQuoteLink = wonRows.filter((row) => !(typeof row.quoteId === "string" && row.quoteId.trim())).length;
  const wonDealsWithoutAmount = wonRows.filter((row) => pickValue(row) <= 0).length;
  const wonDealsWithoutEffectiveDate = wonRows.filter((row) => {
    const quoteId = typeof row.quoteId === "string" ? row.quoteId : "";
    const quoteExpiryOn = quoteId ? quoteMap.get(quoteId)?.expiryOn : undefined;
    const reqExpiryOn = typeof row.quoteExpiryOn === "string" ? row.quoteExpiryOn : undefined;
    return !quoteExpiryOn && !reqExpiryOn;
  }).length;

  const methodology =
    "Fonte V2: richieste affitto in stato vinto (tz_requests) con importo prioritario da quote (tz_quotes.totalPrice), " +
    "fallback su quoteTotalPrice/budget della richiesta; MRR stimato da canoni mensili correnti sulle unità locate. " +
    "Non include incassi reali, ritardi, spese o IVA.";

  const data: RentRevenueSummaryData = {
    currency: "EUR",
    computedAt: new Date().toISOString(),
    asOf,
    dateFrom,
    dateTo,
    methodology,
    rentUnitsListed,
    rentUnitsRented,
    estimatedMrr: Number(estimatedMrr.toFixed(2)),
    periodWonDealsCount,
    periodWonDealsValue: Number(periodWonDealsValue.toFixed(2)),
    openRentPipelineDeals,
    openRentPipelineValue: Number(openRentPipelineValue.toFixed(2)),
    cumulativeWonDealsCount,
    cumulativeWonDealsValue: Number(cumulativeWonDealsValue.toFixed(2)),
    monthsInPeriod,
    theoreticalPeriodCanoni,
    monthly,
    dataQuality: {
      wonDealsWithoutQuoteLink,
      wonDealsWithoutAmount,
      wonDealsWithoutEffectiveDate,
      recurringCanoneMissingByModel: true,
      notes: [
        "Mancano campi espliciti start/end/rinnovo canone nei documenti rent won: MRR ricorrente è stimato da tz_monthly_rents.",
        "Per la massima affidabilità economica, rendere obbligatori quoteId e importo contratto in chiusura trattativa rent.",
      ],
    },
  };

  return { data };
}

export async function runRentRevenueAiQuery(rawInput: unknown): Promise<{
  data: {
    answer: string;
    scope: { workspaceId: string; projectIds: string[]; dateFrom: string; dateTo: string };
    chartSpec: { chartType: "bar+line"; xKey: "month"; yKeys: ["wonDealsValue", "estimatedMrr"] };
    metrics: {
      periodWonDealsValue: number;
      cumulativeWonDealsValue: number;
      estimatedMrr: number;
      openRentPipelineValue: number;
      rentUnitsRented: number;
      rentUnitsListed: number;
    };
    monthly: RentRevenueMonthPoint[];
    methodology: string;
    dataQuality: RentRevenueSummaryData["dataQuality"];
  };
}> {
  const input = RentRevenueAiInputSchema.parse(rawInput);
  const { data } = await getRentRevenueSummary(input);
  const q = input.query.toLowerCase();
  const wantsMrr = q.includes("mrr") || q.includes("ricorr");
  const wantsCumulative = q.includes("cumulat") || q.includes("totale");
  const wantsPipeline = q.includes("pipeline") || q.includes("apert");
  const highlightValue = wantsMrr
    ? `MRR stimato ${Number(data.estimatedMrr).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`
    : wantsCumulative
      ? `cumulato ${Number(data.cumulativeWonDealsValue).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`
      : wantsPipeline
        ? `pipeline aperta ${Number(data.openRentPipelineValue).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`
        : `periodo ${Number(data.periodWonDealsValue).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`;

  const answer =
    `Sintesi ricavi affitti (${data.dateFrom} → ${data.dateTo}): ${highlightValue}. ` +
    `Unità locate ${data.rentUnitsRented}/${data.rentUnitsListed}, MRR stimato ${Number(data.estimatedMrr).toLocaleString("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    })}. ` +
    "Query eseguita solo su dataset aggregato rent-revenue (read-only).";

  return {
    data: {
      answer,
      scope: {
        workspaceId: input.workspaceId,
        projectIds: input.projectIds,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
      },
      chartSpec: { chartType: "bar+line", xKey: "month", yKeys: ["wonDealsValue", "estimatedMrr"] },
      metrics: {
        periodWonDealsValue: data.periodWonDealsValue,
        cumulativeWonDealsValue: data.cumulativeWonDealsValue,
        estimatedMrr: data.estimatedMrr,
        openRentPipelineValue: data.openRentPipelineValue,
        rentUnitsRented: data.rentUnitsRented,
        rentUnitsListed: data.rentUnitsListed,
      },
      monthly: data.monthly,
      methodology: data.methodology,
      dataQuality: data.dataQuality,
    },
  };
}
