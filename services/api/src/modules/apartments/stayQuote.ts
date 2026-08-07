import { z } from 'zod';

import type { PriceCalendarEntryRow } from './priceCalendar.js';

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/u;

/** Query di preventivazione soggiorno (rent breve/medio termine). */
export const stayQuoteQuerySchema = z
  .object({
    workspaceId: z.string().min(1),
    checkIn: z.string().regex(isoDateOnly),
    checkOut: z.string().regex(isoDateOnly),
    guests: z.coerce.number().int().min(1).max(30).optional(),
  })
  .strict()
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  });

export type StayQuoteInput = z.infer<typeof stayQuoteQuerySchema>;

export type StayQuoteNight = {
  date: string;
  price: number;
  source: 'calendar' | 'fallback';
  availability: 'available' | 'blocked' | 'reserved' | 'unknown';
  minStay?: number;
};

export type StayQuoteIssue = {
  code: 'MISSING_PRICE' | 'NOT_AVAILABLE' | 'MIN_STAY' | 'NO_FALLBACK_PRICE';
  message: string;
};

export type StayQuote = {
  checkIn: string;
  checkOut: string;
  nights: number;
  currency: string;
  total: number;
  averagePerNight: number;
  minStayRequired: number;
  bookable: boolean;
  nightsBreakdown: StayQuoteNight[];
  blockedDates: string[];
  missingDates: string[];
  issues: StayQuoteIssue[];
};

const MS_PER_DAY = 86_400_000;

const toUtcTime = (date: string): number => {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

const toIsoDate = (time: number): string => new Date(time).toISOString().slice(0, 10);

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

/** Notti del soggiorno: include il check-in, esclude il check-out. */
export const enumerateStayDates = (checkIn: string, checkOut: string): string[] => {
  const start = toUtcTime(checkIn);
  const end = toUtcTime(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const dates: string[] = [];
  for (let time = start; time < end; time += MS_PER_DAY) {
    dates.push(toIsoDate(time));
  }
  return dates;
};

/**
 * Costruisce il preventivo di soggiorno combinando il calendario prezzi
 * (`tz_price_calendar`) con un prezzo di fallback per notte (canone mensile / 30
 * oppure prezzo unita). Il preventivo e sempre restituito: `bookable` e `issues`
 * descrivono i blocchi (disponibilita, min stay, prezzi mancanti).
 */
export const buildStayQuote = (params: {
  input: Pick<StayQuoteInput, 'checkIn' | 'checkOut'>;
  entries: readonly PriceCalendarEntryRow[];
  fallbackPricePerNight?: number | null;
  currency?: string;
}): StayQuote => {
  const { input, entries } = params;
  const currency = params.currency ?? 'EUR';
  const fallback =
    typeof params.fallbackPricePerNight === 'number' && params.fallbackPricePerNight >= 0
      ? params.fallbackPricePerNight
      : null;

  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  const dates = enumerateStayDates(input.checkIn, input.checkOut);

  const nightsBreakdown: StayQuoteNight[] = [];
  const blockedDates: string[] = [];
  const missingDates: string[] = [];
  let total = 0;
  let minStayRequired = 1;

  for (const date of dates) {
    const entry = byDate.get(date);
    if (entry == null) {
      missingDates.push(date);
      nightsBreakdown.push({
        date,
        price: fallback ?? 0,
        source: 'fallback',
        availability: 'unknown',
      });
      total += fallback ?? 0;
      continue;
    }
    if (entry.availability !== 'available') blockedDates.push(date);
    if (typeof entry.minStay === 'number' && entry.minStay > minStayRequired) {
      minStayRequired = entry.minStay;
    }
    nightsBreakdown.push({
      date,
      price: entry.price,
      source: 'calendar',
      availability: entry.availability,
      ...(typeof entry.minStay === 'number' ? { minStay: entry.minStay } : {}),
    });
    total += entry.price;
  }

  const nights = nightsBreakdown.length;
  const issues: StayQuoteIssue[] = [];
  if (blockedDates.length > 0) {
    issues.push({
      code: 'NOT_AVAILABLE',
      message: `Date non disponibili: ${blockedDates.join(', ')}`,
    });
  }
  if (missingDates.length > 0) {
    issues.push({
      code: fallback == null ? 'NO_FALLBACK_PRICE' : 'MISSING_PRICE',
      message:
        fallback == null
          ? `Nessun prezzo a calendario ne fallback per: ${missingDates.join(', ')}`
          : `Prezzo a calendario mancante, applicato fallback per: ${missingDates.join(', ')}`,
    });
  }
  if (nights > 0 && nights < minStayRequired) {
    issues.push({
      code: 'MIN_STAY',
      message: `Soggiorno minimo richiesto: ${minStayRequired} notti`,
    });
  }

  const bookable =
    nights > 0 &&
    blockedDates.length === 0 &&
    nights >= minStayRequired &&
    (missingDates.length === 0 || fallback != null);

  return {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    currency,
    total: roundCurrency(total),
    averagePerNight: nights === 0 ? 0 : roundCurrency(total / nights),
    minStayRequired,
    bookable,
    nightsBreakdown,
    blockedDates,
    missingDates,
    issues,
  };
};
