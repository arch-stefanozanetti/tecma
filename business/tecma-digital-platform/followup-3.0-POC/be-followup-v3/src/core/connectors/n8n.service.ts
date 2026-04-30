/**
 * Connettore n8n: configurazione per workspace e trigger workflow via REST API.
 * Collection tz_connector_configs (connectorId: 'n8n').
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "n8n";

const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  defaultWorkflowId: z.string().optional(),
});

export interface N8nConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    baseUrl: string;
    /** In GET risposta mascherata (solo ultimi 4 caratteri). */
    apiKeyMasked?: string;
    defaultWorkflowId?: string;
  };
  updatedAt: string;
}

/** Config in input (apiKey in chiaro per salvataggio). */
export interface N8nConfigInput {
  baseUrl: string;
  apiKey: string;
  defaultWorkflowId?: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

export async function getN8nConfig(workspaceId: string): Promise<N8nConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: String(doc.connectorId),
    config: {
      baseUrl: String(config?.baseUrl ?? ""),
      apiKeyMasked: config?.apiKey ? maskApiKey(String(config.apiKey)) : undefined,
      defaultWorkflowId: config?.defaultWorkflowId != null ? String(config.defaultWorkflowId) : undefined,
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function saveN8nConfig(workspaceId: string, input: N8nConfigInput): Promise<N8nConfigRow> {
  const parsed = ConfigSchema.parse({
    baseUrl: input.baseUrl.replace(/\/$/, ""),
    apiKey: input.apiKey.trim(),
    defaultWorkflowId: input.defaultWorkflowId?.trim() || undefined,
  });
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId,
    connectorId: CONNECTOR_ID,
    config: {
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      ...(parsed.defaultWorkflowId && { defaultWorkflowId: parsed.defaultWorkflowId }),
    },
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    { $set: doc },
    { upsert: true }
  );
  const id = result.upsertedCount === 1 ? (result.upsertedId as ObjectId) : (await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID }))?._id;
  const row = await getN8nConfig(workspaceId);
  if (!row) throw new HttpError("Failed to read saved n8n config", 500);
  return row;
}

export async function deleteN8nConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

/** Restituisce config con apiKey in chiaro (solo per uso interno backend). */
async function getN8nConfigInternal(workspaceId: string): Promise<{ baseUrl: string; apiKey: string; defaultWorkflowId?: string } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const baseUrl = String(config?.baseUrl ?? "").replace(/\/$/, "");
  const apiKey = String(config?.apiKey ?? "").trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    defaultWorkflowId: config?.defaultWorkflowId != null ? String(config.defaultWorkflowId) : undefined,
  };
}

/**
 * Avvia un workflow n8n via REST API.
 * POST {baseUrl}/api/v1/workflows/{workflowId}/execute
 * Header: X-N8N-API-KEY
 */
export async function triggerN8nWorkflow(
  workspaceId: string,
  workflowId: string | undefined,
  data: Record<string, unknown>
): Promise<{ executionId?: number; waitingForWebhook?: boolean }> {
  const config = await getN8nConfigInternal(workspaceId);
  if (!config) throw new HttpError("n8n connector not configured for this workspace", 400);
  const wfId = workflowId?.trim() || config.defaultWorkflowId?.trim();
  if (!wfId) throw new HttpError("workflowId required (or set default in n8n config)", 400);

  const url = `${config.baseUrl}/api/v1/workflows/${encodeURIComponent(wfId)}/execute`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": config.apiKey,
    },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(`n8n API error: ${res.status} ${text}`, res.status >= 500 ? 502 : 400);
  }
  const json = (await res.json()) as { executionId?: number; waitingForWebhook?: boolean };
  return json;
}
