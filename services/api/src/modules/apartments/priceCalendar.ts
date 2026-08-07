import { ObjectId, type Collection } from 'mongodb';
import { z } from 'zod';

import { workspaceIdFieldFilter } from '../../lib/mongoIdentity.js';

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/u;

export const priceCalendarAvailabilitySchema = z.enum(['available', 'blocked', 'reserved']);

export const priceCalendarQuerySchema = z
  .object({
    workspaceId: z.string().min(1),
    from: z.string().regex(isoDateOnly),
    to: z.string().regex(isoDateOnly),
  })
  .strict()
  .refine((value) => value.to >= value.from, {
    message: 'to must be after from',
    path: ['to'],
  });

export const priceCalendarEntrySchema = z
  .object({
    date: z.string().regex(isoDateOnly),
    price: z.coerce.number().min(0),
    minStay: z.coerce.number().int().min(1).optional(),
    availability: priceCalendarAvailabilitySchema,
  })
  .strict();

export const priceCalendarUpsertSchema = z
  .object({
    workspaceId: z.string().min(1),
    entries: z.array(priceCalendarEntrySchema).min(1).max(370),
  })
  .strict();

export type PriceCalendarQueryInput = z.infer<typeof priceCalendarQuerySchema>;
export type PriceCalendarUpsertInput = z.infer<typeof priceCalendarUpsertSchema>;

export type PriceCalendarEntryRow = {
  _id: string;
  unitId: string;
  workspaceId: string;
  date: string;
  price: number;
  minStay?: number;
  availability: z.infer<typeof priceCalendarAvailabilitySchema>;
  createdAt?: string;
  updatedAt?: string;
};

type PriceCalendarDocument = Omit<PriceCalendarEntryRow, '_id'> & { _id: ObjectId | string };

type PriceCalendarCollection = Pick<Collection<PriceCalendarDocument>, 'bulkWrite' | 'find'>;

export const mapPriceCalendarEntry = (doc: PriceCalendarDocument): PriceCalendarEntryRow => ({
  _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
  unitId: String(doc.unitId),
  workspaceId: String(doc.workspaceId),
  date: String(doc.date),
  price: Number(doc.price),
  ...(typeof doc.minStay === 'number' ? { minStay: doc.minStay } : {}),
  availability: priceCalendarAvailabilitySchema.parse(doc.availability),
  ...(doc.createdAt != null ? { createdAt: String(doc.createdAt) } : {}),
  ...(doc.updatedAt != null ? { updatedAt: String(doc.updatedAt) } : {}),
});

export const listPriceCalendar = async (
  collection: PriceCalendarCollection,
  unitId: string,
  input: PriceCalendarQueryInput,
): Promise<PriceCalendarEntryRow[]> => {
  const docs = await collection
    .find({
      unitId,
      ...workspaceIdFieldFilter(input.workspaceId),
      date: { $gte: input.from, $lte: input.to },
    })
    .sort({ date: 1 })
    .toArray();
  return docs.map(mapPriceCalendarEntry);
};

export const upsertPriceCalendar = async (
  collection: PriceCalendarCollection,
  unitId: string,
  input: PriceCalendarUpsertInput,
): Promise<PriceCalendarEntryRow[]> => {
  const now = new Date().toISOString();
  await collection.bulkWrite(
    input.entries.map((entry) => ({
      updateOne: {
        filter: { unitId, workspaceId: input.workspaceId, date: entry.date },
        update: {
          $set: {
            unitId,
            workspaceId: input.workspaceId,
            date: entry.date,
            price: entry.price,
            ...(entry.minStay != null ? { minStay: entry.minStay } : {}),
            availability: entry.availability,
            updatedAt: now,
          },
          $setOnInsert: { _id: new ObjectId(), createdAt: now },
        },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  const dates = input.entries.map((entry) => entry.date);
  const from = dates.reduce((min, date) => (date < min ? date : min), dates[0] ?? '');
  const to = dates.reduce((max, date) => (date > max ? date : max), dates[0] ?? '');
  return listPriceCalendar(collection, unitId, { workspaceId: input.workspaceId, from, to });
};
