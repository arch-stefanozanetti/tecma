import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { mongoPrimaryKeyFilter, workspaceIdFieldFilter } from '../../lib/mongoIdentity.js';

const monthlyRentBaseSchema = z
  .object({
    workspaceId: z.string().min(1),
    pricePerMonth: z.coerce.number().min(0),
    deposit: z.coerce.number().min(0).optional(),
    currency: z.literal('EUR').default('EUR'),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime().optional(),
  })
  .strict();

export const monthlyRentSchema = monthlyRentBaseSchema.refine(
  (value) => value.validTo == null || value.validTo >= value.validFrom,
  {
    message: 'validTo must be after validFrom',
    path: ['validTo'],
  },
);

export const monthlyRentPatchSchema = monthlyRentBaseSchema
  .partial()
  .extend({
    workspaceId: z.string().min(1),
  })
  .refine(
    (value) => value.validTo == null || value.validFrom == null || value.validTo >= value.validFrom,
    {
      message: 'validTo must be after validFrom',
      path: ['validTo'],
    },
  );

export type MonthlyRentInput = z.infer<typeof monthlyRentSchema>;
export type MonthlyRentPatchInput = z.infer<typeof monthlyRentPatchSchema>;

export type MonthlyRentRow = {
  _id: string;
  unitId: string;
  workspaceId: string;
  pricePerMonth: number;
  deposit?: number;
  currency: 'EUR';
  validFrom: string;
  validTo?: string;
  createdAt?: string;
  updatedAt?: string;
};

type MonthlyRentDocument = Omit<MonthlyRentRow, '_id'> & { _id: ObjectId | string };

type MonthlyRentsCollection = {
  find: (filter: Record<string, unknown>) => {
    sort: (sort: Record<string, 1 | -1>) => { toArray: () => Promise<MonthlyRentDocument[]> };
  };
  findOne: (filter: Record<string, unknown>) => Promise<MonthlyRentDocument | null>;
  insertOne: (doc: MonthlyRentDocument) => Promise<unknown>;
  updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
};

export const mapMonthlyRent = (doc: MonthlyRentDocument): MonthlyRentRow => ({
  _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
  unitId: String(doc.unitId),
  workspaceId: String(doc.workspaceId),
  pricePerMonth: Number(doc.pricePerMonth),
  ...(typeof doc.deposit === 'number' ? { deposit: doc.deposit } : {}),
  currency: 'EUR',
  validFrom: String(doc.validFrom),
  ...(doc.validTo != null ? { validTo: String(doc.validTo) } : {}),
  ...(doc.createdAt != null ? { createdAt: String(doc.createdAt) } : {}),
  ...(doc.updatedAt != null ? { updatedAt: String(doc.updatedAt) } : {}),
});

export const listMonthlyRents = async (
  collection: MonthlyRentsCollection,
  unitId: string,
  workspaceId: string,
): Promise<MonthlyRentRow[]> => {
  const docs = await collection
    .find({ unitId, ...workspaceIdFieldFilter(workspaceId) })
    .sort({ validFrom: -1, _id: -1 })
    .toArray();
  return docs.map(mapMonthlyRent);
};

export const createMonthlyRent = async (
  collection: MonthlyRentsCollection,
  unitId: string,
  input: MonthlyRentInput,
): Promise<MonthlyRentRow> => {
  const now = new Date().toISOString();
  const doc: MonthlyRentDocument = {
    _id: new ObjectId(),
    unitId,
    workspaceId: input.workspaceId,
    pricePerMonth: input.pricePerMonth,
    ...(input.deposit != null ? { deposit: input.deposit } : {}),
    currency: 'EUR',
    validFrom: input.validFrom,
    ...(input.validTo != null ? { validTo: input.validTo } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return mapMonthlyRent(doc);
};

export const updateMonthlyRent = async (
  collection: MonthlyRentsCollection,
  unitId: string,
  rentId: string,
  input: MonthlyRentPatchInput,
): Promise<MonthlyRentRow | null> => {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const field of ['pricePerMonth', 'deposit', 'currency', 'validFrom', 'validTo'] as const) {
    if (input[field] !== undefined) patch[field] = input[field];
  }
  await collection.updateOne(
    { ...mongoPrimaryKeyFilter(rentId), unitId, ...workspaceIdFieldFilter(input.workspaceId) },
    { $set: patch },
  );
  const doc = await collection.findOne({
    ...mongoPrimaryKeyFilter(rentId),
    unitId,
    ...workspaceIdFieldFilter(input.workspaceId),
  });
  return doc == null ? null : mapMonthlyRent(doc);
};

export const resolveCurrentMonthlyRent = (
  monthlyRents: MonthlyRentRow[],
  now = new Date().toISOString(),
): MonthlyRentRow | null =>
  monthlyRents.find(
    (rent) => rent.validFrom <= now && (rent.validTo == null || rent.validTo >= now),
  ) ?? null;
