/**
 * Microsoft Teams: webhook in entrata (connector URL) per notifiche canale.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "teams_incoming";

const ConfigSchema = z.object({
  /** URL completo del connettore Incoming Webhook creato in Teams */
  incomingWebhookUrl: z.string().url(),
  /** Etichetta opzionale (es. nome canale) */
  label: z.string().max(200).optional(),
});

export interface TeamsIncomingConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    incomingWebhookUrl: string;
    label?: string;
  };
  updatedAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export async function getTeamsIncomingConfig(workspaceId: string): Promise<TeamsIncomingConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: CONNECTOR_ID,
    config: {
      incomingWebhookUrl: String(config?.incomingWebhookUrl ?? ""),
      label: config?.label != null ? String(config.label) : undefined,
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function saveTeamsIncomingConfig(
  workspaceId: string,
  input: { incomingWebhookUrl: string; label?: string }
): Promise<TeamsIncomingConfigRow> {
  const parsed = ConfigSchema.parse({
    incomingWebhookUrl: input.incomingWebhookUrl.trim(),
    label: input.label?.trim() || undefined,
  });
  const db = getDb();
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: CONNECTOR_ID,
        config: {
          incomingWebhookUrl: parsed.incomingWebhookUrl,
          ...(parsed.label && { label: parsed.label }),
        },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getTeamsIncomingConfig(workspaceId);
  if (!row) throw new HttpError("Errore salvataggio Teams", 500);
  return row;
}

export async function deleteTeamsIncomingConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

/** Invia messaggio Adaptive Card semplice (test o automazioni). */
export async function postTeamsIncomingMessage(
  workspaceId: string,
  payload: { title: string; text: string }
): Promise<{ ok: boolean }> {
  const row = await getTeamsIncomingConfig(workspaceId);
  if (!row?.config.incomingWebhookUrl) throw new HttpError("Teams webhook non configurato", 400);
  const body = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: payload.title,
    themeColor: "0078D4",
    title: payload.title,
    text: payload.text,
  };
  const res = await fetch(row.config.incomingWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new HttpError(`Teams webhook error: ${res.status} ${t.slice(0, 200)}`, 502);
  }
  return { ok: true };
}
