import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { mongoPrimaryKeyFilter, workspaceIdFieldFilter } from '../../lib/mongoIdentity.js';

const salePriceBaseSchema = z
  .object({
    workspaceId: z.string().min(1),
    price: z.coerce.number().min(0),
    currency: z.literal('EUR').default('EUR'),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime().optional(),
  })
  .strict();

export const salePriceSchema = salePriceBaseSchema.refine(
  (value) => value.validTo == null || value.validTo >= value.validFrom,
  {
    message: 'validTo must be after validFrom',
    path: ['validTo'],
  },
);

export const salePricePatchSchema = salePriceBaseSchema
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

export type SalePriceInput = z.infer<typeof salePriceSchema>;
export type SalePricePatchInput = z.infer<typeof salePricePatchSchema>;

export type SalePriceRow = {
  _id: string;
  unitId: string;
  workspaceId: string;
  price: number;
  currency: 'EUR';
  validFrom: string;
  validTo?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SalePriceDocument = Omit<SalePriceRow, '_id'> & { _id: ObjectId | string };

type SalePricesCollection = {
  find: (filter: Record<string, unknown>) => {
    sort: (sort: Record<string, 1 | -1>) => { toArray: () => Promise<SalePriceDocument[]> };
  };
  findOne: (filter: Record<string, unknown>) => Promise<SalePriceDocument | null>;
  insertOne: (doc: SalePriceDocument) => Promise<unknown>;
  updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
};

export const mapSalePrice = (doc: SalePriceDocument): SalePriceRow => ({
  _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
  unitId: String(doc.unitId),
  workspaceId: String(doc.workspaceId),
  price: Number(doc.price),
  currency: 'EUR',
  validFrom: String(doc.validFrom),
  ...(doc.validTo != null ? { validTo: String(doc.validTo) } : {}),
  ...(doc.createdAt != null ? { createdAt: String(doc.createdAt) } : {}),
  ...(doc.updatedAt != null ? { updatedAt: String(doc.updatedAt) } : {}),
});

export const listSalePrices = async (
  collection: SalePricesCollection,
  unitId: string,
  workspaceId: string,
): Promise<SalePriceRow[]> => {
  const docs = await collection
    .find({ unitId, ...workspaceIdFieldFilter(workspaceId) })
    .sort({ validFrom: -1, _id: -1 })
    .toArray();
  return docs.map(mapSalePrice);
};

export const createSalePrice = async (
  collection: SalePricesCollection,
  unitId: string,
  input: SalePriceInput,
): Promise<SalePriceRow> => {
  const now = new Date().toISOString();
  const doc: SalePriceDocument = {
    _id: new ObjectId(),
    unitId,
    workspaceId: input.workspaceId,
    price: input.price,
    currency: 'EUR',
    validFrom: input.validFrom,
    ...(input.validTo != null ? { validTo: input.validTo } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(doc);
  return mapSalePrice(doc);
};

export const updateSalePrice = async (
  collection: SalePricesCollection,
  unitId: string,
  priceId: string,
  input: SalePricePatchInput,
): Promise<SalePriceRow | null> => {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const field of ['price', 'currency', 'validFrom', 'validTo'] as const) {
    if (input[field] !== undefined) patch[field] = input[field];
  }
  await collection.updateOne(
    { ...mongoPrimaryKeyFilter(priceId), unitId, ...workspaceIdFieldFilter(input.workspaceId) },
    { $set: patch },
  );
  const doc = await collection.findOne({
    ...mongoPrimaryKeyFilter(priceId),
    unitId,
    ...workspaceIdFieldFilter(input.workspaceId),
  });
  return doc == null ? null : mapSalePrice(doc);
};

export const resolveCurrentSalePrice = (
  salePrices: SalePriceRow[],
  now = new Date().toISOString(),
): SalePriceRow | null =>
  salePrices.find(
    (price) => price.validFrom <= now && (price.validTo == null || price.validTo >= now),
  ) ?? null;
