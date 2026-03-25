import { z } from "zod";

/** Singolo touch (first / last) persistito su Mongo. */
export interface MarketingTouch {
  gclid?: string;
  fbclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  capturedAt: string;
  /** Query string troncata (privacy / size). */
  rawQuery?: string;
}

export interface MarketingAttributionDoc {
  firstTouch: MarketingTouch;
  lastTouch: MarketingTouch;
}

const optionalTrimmed = z.string().trim().optional();

export const MarketingTouchPartialSchema = z.object({
  gclid: optionalTrimmed,
  fbclid: optionalTrimmed,
  gbraid: optionalTrimmed,
  wbraid: optionalTrimmed,
  utmSource: optionalTrimmed,
  utmMedium: optionalTrimmed,
  utmCampaign: optionalTrimmed,
  utmContent: optionalTrimmed,
  utmTerm: optionalTrimmed,
  landingPath: optionalTrimmed,
  capturedAt: z.string().min(1).optional(),
  rawQuery: z.string().max(4096).optional(),
});

export const MarketingAttributionInputSchema = z.object({
  /** Touch corrente dal sito (Webflow); in create diventa first+last, in update aggiorna solo last. */
  touch: MarketingTouchPartialSchema.optional(),
});

const RAW_QUERY_MAX = 512;

export function touchHasSignal(t: MarketingTouchPartial): boolean {
  return Boolean(
    (t.gclid && t.gclid.trim()) ||
      (t.fbclid && t.fbclid.trim()) ||
      (t.gbraid && t.gbraid.trim()) ||
      (t.wbraid && t.wbraid.trim()) ||
      (t.utmSource && t.utmSource.trim()) ||
      (t.utmMedium && t.utmMedium.trim()) ||
      (t.utmCampaign && t.utmCampaign.trim()) ||
      (t.utmContent && t.utmContent.trim()) ||
      (t.utmTerm && t.utmTerm.trim()) ||
      (t.landingPath && t.landingPath.trim()) ||
      (t.rawQuery && t.rawQuery.trim())
  );
}

type MarketingTouchPartial = z.infer<typeof MarketingTouchPartialSchema>;

export function normalizeTouchPartial(input: MarketingTouchPartial, nowIso: string): MarketingTouch {
  const rawQuery =
    typeof input.rawQuery === "string" && input.rawQuery.trim()
      ? input.rawQuery.trim().slice(0, RAW_QUERY_MAX)
      : undefined;
  const trim = (s: string | undefined) => (typeof s === "string" ? s.trim() : undefined);
  return {
    ...(trim(input.gclid) && { gclid: trim(input.gclid) }),
    ...(trim(input.fbclid) && { fbclid: trim(input.fbclid) }),
    ...(trim(input.gbraid) && { gbraid: trim(input.gbraid) }),
    ...(trim(input.wbraid) && { wbraid: trim(input.wbraid) }),
    ...(trim(input.utmSource) && { utmSource: trim(input.utmSource) }),
    ...(trim(input.utmMedium) && { utmMedium: trim(input.utmMedium) }),
    ...(trim(input.utmCampaign) && { utmCampaign: trim(input.utmCampaign) }),
    ...(trim(input.utmContent) && { utmContent: trim(input.utmContent) }),
    ...(trim(input.utmTerm) && { utmTerm: trim(input.utmTerm) }),
    ...(trim(input.landingPath) && { landingPath: trim(input.landingPath) }),
    capturedAt: (input.capturedAt && input.capturedAt.trim()) || nowIso,
    ...(rawQuery && { rawQuery }),
  };
}

export function pickTouchFromDoc(
  doc: MarketingAttributionDoc | undefined,
  model: "last_touch" | "first_touch"
): MarketingTouch | undefined {
  if (!doc) return undefined;
  return model === "first_touch" ? doc.firstTouch : doc.lastTouch;
}

/** Chiave di raggruppamento dashboard (non identità utente). */
export function attributionGroupKey(touch: MarketingTouch | undefined): string {
  if (!touch) return "unknown";
  const src = (touch.utmSource || "").toLowerCase().trim() || "unknown";
  const camp = (touch.utmCampaign || "").toLowerCase().trim() || "unknown";
  return `${src}::${camp}`;
}

export function isMarketingAttributionDoc(v: unknown): v is MarketingAttributionDoc {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.firstTouch === "object" && o.firstTouch !== null && typeof o.lastTouch === "object" && o.lastTouch !== null;
}
