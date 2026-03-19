import type { NextFunction, Request, Response } from "express";
import { ENV } from "../config/env.js";
import { getDb } from "../config/db.js";
import { logger } from "../observability/logger.js";

interface RawPlatformAccessConfig {
  workspaceId: string;
  projectIds?: string[];
  label?: string;
  scopes?: string[];
  quotaPerDay?: number;
}

export interface PlatformAccessContext {
  apiKey: string;
  workspaceId: string;
  projectIds: string[];
  label: string;
  scopes: string[];
  quotaPerDay: number | null;
}

let parsedKeysCache: Map<string, PlatformAccessContext> | null = null;

const parseApiKeys = (): Map<string, PlatformAccessContext> => {
  if (parsedKeysCache) return parsedKeysCache;
  const source = ENV.PLATFORM_API_KEYS.trim();
  if (!source) {
    parsedKeysCache = new Map();
    return parsedKeysCache;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    parsedKeysCache = new Map();
    return parsedKeysCache;
  }

  if (!parsed || typeof parsed !== "object") {
    parsedKeysCache = new Map();
    return parsedKeysCache;
  }

  const entries = Object.entries(parsed as Record<string, RawPlatformAccessConfig>);
  const map = new Map<string, PlatformAccessContext>();
  for (const [apiKey, config] of entries) {
    if (!apiKey || !config || typeof config !== "object") continue;
    const workspaceId = typeof config.workspaceId === "string" ? config.workspaceId.trim() : "";
    if (!workspaceId) continue;
    const projectIds = Array.isArray(config.projectIds)
      ? config.projectIds.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    map.set(apiKey, {
      apiKey,
      workspaceId,
      projectIds,
      label: typeof config.label === "string" && config.label.trim().length > 0 ? config.label.trim() : "platform-consumer",
      scopes:
        Array.isArray(config.scopes) && config.scopes.length > 0
          ? config.scopes.filter((scope): scope is string => typeof scope === "string" && scope.trim().length > 0)
          : ["platform.capabilities.read", "platform.listings.read", "platform.reports.read"],
      quotaPerDay:
        typeof config.quotaPerDay === "number" && Number.isFinite(config.quotaPerDay) && config.quotaPerDay > 0
          ? Math.floor(config.quotaPerDay)
          : null,
    });
  }
  parsedKeysCache = map;
  return map;
};

const readApiKey = (req: Request): string | null => {
  const header = req.get("x-api-key");
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  const bearer = req.get("authorization");
  if (typeof bearer === "string" && bearer.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice("bearer ".length).trim();
    if (token) return token;
  }
  return null;
};

export const platformApiKeyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = readApiKey(req);
  if (!apiKey) {
    res.status(401).json({ error: "Missing x-api-key" });
    return;
  }
  const config = parseApiKeys().get(apiKey);
  if (!config) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  req.platformAccess = config;
  next();
};

export const requirePlatformScope = (scope: string) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const access = req.platformAccess;
  if (!access) {
    res.status(401).json({ error: "Missing platform access context" });
    return;
  }
  if (access.scopes.includes("*") || access.scopes.includes(scope)) {
    next();
    return;
  }
  res.status(403).json({ error: `Missing required scope: ${scope}` });
};

const usageDateKey = (): string => new Date().toISOString().slice(0, 10);

export const enforcePlatformQuota = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const access = req.platformAccess;
  if (!access) {
    res.status(401).json({ error: "Missing platform access context" });
    return;
  }
  if (access.quotaPerDay == null) {
    next();
    return;
  }
  try {
    const db = getDb();
    const date = usageDateKey();
    const coll = db.collection("tz_platform_api_usage");
    const now = new Date().toISOString();
    const result = await coll.findOneAndUpdate(
      { apiKey: access.apiKey, date },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          apiKey: access.apiKey,
          label: access.label,
          workspaceId: access.workspaceId,
          date,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    const count = Number((result as { count?: unknown } | null)?.count ?? 0);
    if (count > access.quotaPerDay) {
      res.status(429).json({
        error: "Daily quota exceeded for this API key",
        quotaPerDay: access.quotaPerDay,
        date,
      });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "[platform] quota check failed");
    res.status(503).json({ error: "Platform quota service unavailable" });
  }
};
