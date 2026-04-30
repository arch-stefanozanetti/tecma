/**
 * Configurazione AI per workspace: provider + API key (salvata, mai restituita in chiaro).
 * Un solo record per workspace (upsert). Usato per abilitare suggerimenti AI e future funzioni LLM.
 */
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { z } from "zod";

const COLLECTION = "tz_workspace_ai_config";

export const AI_PROVIDERS = ["claude", "openai", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];
const PutBodySchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string(),
});

function maskKey(raw: string): string {
  if (!raw || raw.length <= 8) return "****";
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export interface WorkspaceAiConfigPublic {
  configured: boolean;
  provider?: string;
  apiKeyMasked?: string;
}

/** GET: restituisce solo configured, provider e apiKeyMasked. La chiave non viene mai esposta. */
export async function getWorkspaceAiConfig(workspaceId: string): Promise<WorkspaceAiConfigPublic> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  if (!doc) return { configured: false };
  const apiKey = doc.apiKey;
  return {
    configured: true,
    provider: String(doc.provider ?? ""),
    apiKeyMasked: typeof apiKey === "string" && apiKey ? maskKey(apiKey) : undefined,
  };
}

/** Verifica se il workspace ha una config AI (per orchestrator, senza leggere la key). */
export async function isWorkspaceAiConfigured(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId }, { projection: { _id: 1 } });
  return !!doc;
}

/** Solo server-side: provider + API key per chiamate LLM. Mai esporre via HTTP. */
export async function getWorkspaceAiConfigInternal(
  workspaceId: string
): Promise<{ provider: AiProviderId; apiKey: string } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  if (!doc) return null;
  const apiKey = typeof doc.apiKey === "string" ? doc.apiKey.trim() : "";
  const providerRaw = String(doc.provider ?? "");
  const provider = AI_PROVIDERS.includes(providerRaw as AiProviderId) ? (providerRaw as AiProviderId) : null;
  if (!apiKey || !provider) return null;
  return { provider, apiKey };
}

/**
 * PUT: salva o aggiorna config. Se apiKey è vuota, rimuove la config.
 * Solo configured/provider/apiKeyMasked in risposta.
 */
export async function putWorkspaceAiConfig(
  workspaceId: string,
  rawBody: unknown
): Promise<WorkspaceAiConfigPublic> {
  const body = PutBodySchema.safeParse(rawBody);
  if (!body.success) throw new HttpError("Invalid body: provider and apiKey required", 400);

  const db = getDb();
  const apiKeyTrimmed = body.data.apiKey.trim();

  if (!apiKeyTrimmed) {
    await db.collection(COLLECTION).deleteOne({ workspaceId });
    return { configured: false };
  }

  const now = new Date().toISOString();
  await db.collection(COLLECTION).updateOne(
    { workspaceId },
    {
      $set: {
        provider: body.data.provider,
        apiKey: apiKeyTrimmed,
        apiKeyMasked: maskKey(apiKeyTrimmed),
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  return getWorkspaceAiConfig(workspaceId);
}
