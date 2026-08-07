import { describe, expect, it } from 'vitest';

import type { PriceCalendarEntryRow } from './priceCalendar.js';
import { buildStayQuote, enumerateStayDates } from './stayQuote.js';

const entry = (
  date: string,
  price: number,
  availability: PriceCalendarEntryRow['availability'] = 'available',
  minStay?: number,
): PriceCalendarEntryRow => ({
  _id: `id-${date}`,
  unitId: 'unit-1',
  workspaceId: 'ws-1',
  date,
  price,
  availability,
  ...(minStay != null ? { minStay } : {}),
});

describe('enumerateStayDates', () => {
  it('includes check-in and excludes check-out', () => {
    expect(enumerateStayDates('2026-05-01', '2026-05-04')).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
  });

  it('returns no nights when the range is empty or inverted', () => {
    expect(enumerateStayDates('2026-05-04', '2026-05-04')).toEqual([]);
    expect(enumerateStayDates('2026-05-05', '2026-05-04')).toEqual([]);
  });

  it('crosses month and DST boundaries', () => {
    expect(enumerateStayDates('2026-03-28', '2026-04-01')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ]);
  });
});

describe('buildStayQuote', () => {
  it('sums seasonal calendar prices per night', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-05-01', checkOut: '2026-05-04' },
      entries: [entry('2026-05-01', 120), entry('2026-05-02', 150), entry('2026-05-03', 150)],
    });

    expect(quote.nights).toBe(3);
    expect(quote.total).toBe(420);
    expect(quote.averagePerNight).toBe(140);
    expect(quote.bookable).toBe(true);
    expect(quote.issues).toEqual([]);
  });

  it('applies the fallback nightly price for uncovered dates', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-06-01', checkOut: '2026-06-03' },
      entries: [entry('2026-06-01', 100)],
      fallbackPricePerNight: 90,
    });

    expect(quote.total).toBe(190);
    expect(quote.missingDates).toEqual(['2026-06-02']);
    expect(quote.nightsBreakdown[1]?.source).toBe('fallback');
    expect(quote.bookable).toBe(true);
    expect(quote.issues.map((issue) => issue.code)).toEqual(['MISSING_PRICE']);
  });

  it('is not bookable without calendar price nor fallback', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-06-01', checkOut: '2026-06-02' },
      entries: [],
    });

    expect(quote.bookable).toBe(false);
    expect(quote.issues.map((issue) => issue.code)).toEqual(['NO_FALLBACK_PRICE']);
  });

  it('flags blocked or reserved nights', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-07-10', checkOut: '2026-07-12' },
      entries: [entry('2026-07-10', 200), entry('2026-07-11', 200, 'reserved')],
    });

    expect(quote.blockedDates).toEqual(['2026-07-11']);
    expect(quote.bookable).toBe(false);
    expect(quote.issues.map((issue) => issue.code)).toEqual(['NOT_AVAILABLE']);
  });

  it('enforces the highest min stay found in the range', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-08-01', checkOut: '2026-08-03' },
      entries: [entry('2026-08-01', 300, 'available', 5), entry('2026-08-02', 300)],
    });

    expect(quote.minStayRequired).toBe(5);
    expect(quote.bookable).toBe(false);
    expect(quote.issues.map((issue) => issue.code)).toEqual(['MIN_STAY']);
  });

  it('rounds currency values to two decimals', () => {
    const quote = buildStayQuote({
      input: { checkIn: '2026-09-01', checkOut: '2026-09-04' },
      entries: [
        entry('2026-09-01', 33.333),
        entry('2026-09-02', 33.333),
        entry('2026-09-03', 33.334),
      ],
    });

    expect(quote.total).toBe(100);
    expect(quote.averagePerNight).toBe(33.33);
  });
});
