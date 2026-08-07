import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { workspaceIdFieldFilter } from '../../lib/mongoIdentity.js';

export const inventoryStatusSchema = z.enum(['available', 'locked', 'reserved', 'sold']);

export const inventoryPatchSchema = z
  .object({
    workspaceId: z.string().min(1),
    inventoryStatus: inventoryStatusSchema,
    requestId: z.string().min(1).optional(),
  })
  .strict();

export type InventoryPatchInput = z.infer<typeof inventoryPatchSchema>;

export type InventoryRow = {
  _id?: string;
  unitId: string;
  workspaceId: string;
  inventoryStatus: z.infer<typeof inventoryStatusSchema>;
  requestId?: string;
  updatedAt?: string;
};

type InventoryDocument = Omit<InventoryRow, '_id'> & { _id?: ObjectId | string };

type InventoryCollection = {
  findOne: (filter: Record<string, unknown>) => Promise<InventoryDocument | null>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

export const mapInventory = (doc: InventoryDocument): InventoryRow => ({
  ...(doc._id != null
    ? { _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id) }
    : {}),
  unitId: String(doc.unitId),
  workspaceId: String(doc.workspaceId),
  inventoryStatus: inventoryStatusSchema.parse(doc.inventoryStatus),
  ...(doc.requestId != null ? { requestId: String(doc.requestId) } : {}),
  ...(doc.updatedAt != null ? { updatedAt: String(doc.updatedAt) } : {}),
});

export const defaultInventory = (unitId: string, workspaceId: string): InventoryRow => ({
  unitId,
  workspaceId,
  inventoryStatus: 'available',
});

export const getInventory = async (
  collection: InventoryCollection,
  unitId: string,
  workspaceId: string,
): Promise<InventoryRow> => {
  const doc = await collection.findOne({ unitId, ...workspaceIdFieldFilter(workspaceId) });
  return doc == null ? defaultInventory(unitId, workspaceId) : mapInventory(doc);
};

export const updateInventory = async (
  collection: InventoryCollection,
  unitId: string,
  input: InventoryPatchInput,
): Promise<InventoryRow> => {
  const now = new Date().toISOString();
  const patch = {
    unitId,
    workspaceId: input.workspaceId,
    inventoryStatus: input.inventoryStatus,
    ...(input.requestId != null ? { requestId: input.requestId } : {}),
    updatedAt: now,
  };
  await collection.updateOne(
    { unitId, ...workspaceIdFieldFilter(input.workspaceId) },
    { $set: patch, $setOnInsert: { _id: new ObjectId(), createdAt: now } },
    { upsert: true },
  );
  return getInventory(collection, unitId, input.workspaceId);
};
