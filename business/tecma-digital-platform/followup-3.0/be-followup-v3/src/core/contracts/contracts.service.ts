/**
 * Contratti: quando una request diventa vincolante (won / contract).
 * Collection tz_contracts. Collegamento request → unit, contract_type (sell | rent).
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_contracts";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ requestId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ unitId: 1 });
  indexEnsured = true;
}

export interface ContractRow {
  _id: string;
  requestId: string;
  unitId: string;
  workspaceId: string;
  contractType: "sell" | "rent";
  contractDate: string;
  createdAt: string;
}

export const createContract = async (params: {
  requestId: string;
  unitId: string;
  workspaceId: string;
  contractType: "sell" | "rent";
}): Promise<ContractRow> => {
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    _id: new ObjectId(),
    requestId: params.requestId,
    unitId: params.unitId,
    workspaceId: params.workspaceId,
    contractType: params.contractType,
    contractDate: now,
    createdAt: now,
  };
  await db.collection(COLLECTION).insertOne(doc);
  return {
    _id: doc._id.toHexString(),
    requestId: doc.requestId,
    unitId: doc.unitId,
    workspaceId: doc.workspaceId,
    contractType: doc.contractType,
    contractDate: doc.contractDate,
    createdAt: doc.createdAt,
  };
};
