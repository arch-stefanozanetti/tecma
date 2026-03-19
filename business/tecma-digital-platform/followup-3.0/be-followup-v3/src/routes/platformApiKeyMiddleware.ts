import type { NextFunction, Request, Response } from "express";
import { ENV } from "../config/env.js";

interface RawPlatformAccessConfig {
  workspaceId: string;
  projectIds?: string[];
  label?: string;
}

export interface PlatformAccessContext {
  apiKey: string;
  workspaceId: string;
  projectIds: string[];
  label: string;
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

