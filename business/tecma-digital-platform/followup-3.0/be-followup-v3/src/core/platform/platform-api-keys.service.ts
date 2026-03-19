import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const KEYS_COLLECTION = "tz_platform_api_keys";
const USAGE_COLLECTION = "tz_platform_api_usage";

const PlatformKeyInputSchema = z.object({
  label: z.string().min(1),
  projectIds: z.array(z.string().min(1)).default([]),
  scopes: z.array(z.string().min(1)).default(["platform.capabilities.read", "platform.listings.read", "platform.reports.read"]),
  quotaPerDay: z.number().int().min(1).max(1_000_000).optional().nullable(),
});

const hashKey = (raw: string): string => crypto.createHash("sha256").update(raw, "utf8").digest("hex");

const maskKey = (raw: string): string => (raw.length <= 8 ? "****" : `${raw.slice(0, 4)}...${raw.slice(-4)}`);

export interface PlatformApiKeyRow {
  _id: string;
  workspaceId: string;
  label: string;
  projectIds: string[];
  scopes: string[];
  quotaPerDay: number | null;
  active: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedPlatformApiKey {
  id: string;
  workspaceId: string;
  label: string;
  projectIds: string[];
  scopes: string[];
  quotaPerDay: number | null;
}

const nowIso = (): string => new Date().toISOString();

export const listPlatformApiKeys = async (workspaceId: string): Promise<{ data: PlatformApiKeyRow[] }> => {
  const db = getDb();
  const rows = await db.collection(KEYS_COLLECTION).find({ workspaceId }).sort({ createdAt: -1 }).toArray();
  return {
    data: rows.map((row) => ({
      _id: row._id instanceof ObjectId ? row._id.toHexString() : String(row._id ?? ""),
      workspaceId: String(row.workspaceId ?? ""),
      label: String(row.label ?? ""),
      projectIds: Array.isArray(row.projectIds) ? row.projectIds.filter((v): v is string => typeof v === "string") : [],
      scopes: Array.isArray(row.scopes) ? row.scopes.filter((v): v is string => typeof v === "string") : [],
      quotaPerDay: typeof row.quotaPerDay === "number" ? row.quotaPerDay : null,
      active: row.active !== false,
      lastUsedAt: typeof row.lastUsedAt === "string" ? row.lastUsedAt : undefined,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : nowIso(),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : nowIso(),
    })),
  };
};

export const createPlatformApiKey = async (
  workspaceId: string,
  rawInput: unknown,
): Promise<{ key: PlatformApiKeyRow; apiKey: string; apiKeyMasked: string }> => {
  const input = PlatformKeyInputSchema.parse(rawInput);
  const apiKey = crypto.randomBytes(24).toString("hex");
  const createdAt = nowIso();
  const db = getDb();
  const result = await db.collection(KEYS_COLLECTION).insertOne({
    workspaceId,
    label: input.label.trim(),
    projectIds: input.projectIds,
    scopes: input.scopes,
    quotaPerDay: input.quotaPerDay ?? null,
    active: true,
    keyHash: hashKey(apiKey),
    keyVersion: 1,
    createdAt,
    updatedAt: createdAt,
  });
  return {
    key: {
      _id: result.insertedId.toHexString(),
      workspaceId,
      label: input.label.trim(),
      projectIds: input.projectIds,
      scopes: input.scopes,
      quotaPerDay: input.quotaPerDay ?? null,
      active: true,
      createdAt,
      updatedAt: createdAt,
    },
    apiKey,
    apiKeyMasked: maskKey(apiKey),
  };
};

export const rotatePlatformApiKey = async (
  workspaceId: string,
  keyId: string,
): Promise<{ key: PlatformApiKeyRow; apiKey: string; apiKeyMasked: string }> => {
  if (!ObjectId.isValid(keyId)) throw new HttpError("Invalid key id", 400);
  const apiKey = crypto.randomBytes(24).toString("hex");
  const updatedAt = nowIso();
  const db = getDb();
  const oid = new ObjectId(keyId);
  const row = await db.collection(KEYS_COLLECTION).findOne({ _id: oid, workspaceId, active: true });
  if (!row) throw new HttpError("Platform API key not found", 404);
  await db.collection(KEYS_COLLECTION).updateOne(
    { _id: oid, workspaceId },
    {
      $set: {
        keyHash: hashKey(apiKey),
        updatedAt,
        rotatedAt: updatedAt,
      },
      $inc: { keyVersion: 1 },
    },
  );
  return {
    key: {
      _id: keyId,
      workspaceId,
      label: String(row.label ?? ""),
      projectIds: Array.isArray(row.projectIds) ? row.projectIds.filter((v): v is string => typeof v === "string") : [],
      scopes: Array.isArray(row.scopes) ? row.scopes.filter((v): v is string => typeof v === "string") : [],
      quotaPerDay: typeof row.quotaPerDay === "number" ? row.quotaPerDay : null,
      active: true,
      lastUsedAt: typeof row.lastUsedAt === "string" ? row.lastUsedAt : undefined,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : updatedAt,
      updatedAt,
    },
    apiKey,
    apiKeyMasked: maskKey(apiKey),
  };
};

export const revokePlatformApiKey = async (workspaceId: string, keyId: string): Promise<{ deleted: boolean }> => {
  if (!ObjectId.isValid(keyId)) throw new HttpError("Invalid key id", 400);
  const db = getDb();
  const result = await db.collection(KEYS_COLLECTION).updateOne(
    { _id: new ObjectId(keyId), workspaceId, active: true },
    { $set: { active: false, revokedAt: nowIso(), updatedAt: nowIso() } },
  );
  if (result.matchedCount === 0) throw new HttpError("Platform API key not found", 404);
  return { deleted: true };
};

export const resolvePlatformApiKeyByRaw = async (rawApiKey: string): Promise<ResolvedPlatformApiKey | null> => {
  const db = getDb();
  const row = await db.collection(KEYS_COLLECTION).findOne({
    keyHash: hashKey(rawApiKey),
    active: true,
  });
  if (!row) return null;
  return {
    id: row._id instanceof ObjectId ? row._id.toHexString() : String(row._id ?? ""),
    workspaceId: String(row.workspaceId ?? ""),
    label: String(row.label ?? "platform-consumer"),
    projectIds: Array.isArray(row.projectIds) ? row.projectIds.filter((v): v is string => typeof v === "string") : [],
    scopes: Array.isArray(row.scopes) ? row.scopes.filter((v): v is string => typeof v === "string") : [],
    quotaPerDay: typeof row.quotaPerDay === "number" ? row.quotaPerDay : null,
  };
};

export const trackPlatformApiKeyUsage = async (keyId: string): Promise<void> => {
  if (!ObjectId.isValid(keyId)) return;
  const db = getDb();
  await db.collection(KEYS_COLLECTION).updateOne({ _id: new ObjectId(keyId) }, { $set: { lastUsedAt: nowIso(), updatedAt: nowIso() } });
};

export const getPlatformUsageSummary = async (
  workspaceId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ data: Array<{ keyRef: string; count: number; date: string }> }> => {
  const db = getDb();
  const from = dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined;
  const to = dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined;
  const match: Record<string, unknown> = { workspaceId };
  if (from || to) {
    match.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  const rows = await db.collection(USAGE_COLLECTION).find(match).sort({ date: -1, count: -1 }).limit(500).toArray();
  return {
    data: rows.map((row) => ({
      keyRef: String(row.apiKey ?? ""),
      count: typeof row.count === "number" ? row.count : 0,
      date: typeof row.date === "string" ? row.date : "",
    })),
  };
};

