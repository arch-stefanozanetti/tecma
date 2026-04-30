import crypto from "node:crypto";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_zeus_poc_config";

const PatchSchema = z.object({
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioWhatsAppFrom: z.string().optional(),
  emailWebhookSecret: z.string().optional(),
  /** Opzionale: se assente, il webhook `/ingest` usa lo stesso segreto dell'email. */
  ingestWebhookSecret: z.string().optional(),
  /** Preferenza futura Track B; oggi la voce PSTN passa da Twilio (Track A). */
  voiceIngressProvider: z.enum(["twilio", "sip_gateway"]).optional(),
  enabledChannels: z
    .object({
      voice: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      email: z.boolean().optional(),
      chat: z.boolean().optional()
    })
    .optional()
});

export interface ZeusPocConfigPublic {
  twilioAccountSidMasked: string | null;
  twilioAuthTokenMasked: string | null;
  twilioWhatsAppFrom: string | null;
  emailWebhookSecretMasked: string | null;
  ingestWebhookSecretMasked: string | null;
  /** twilio = Track A (default); sip_gateway = roadmap Track B (gateway dedicato). */
  voiceIngressProvider: "twilio" | "sip_gateway";
  enabledChannels: { voice: boolean; whatsapp: boolean; email: boolean; chat: boolean };
}

function mask(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function maskSid(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t.length <= 6) return "****";
  return `${t.slice(0, 2)}…${t.slice(-4)}`;
}

export async function getZeusPocConfig(workspaceId: string): Promise<ZeusPocConfigPublic> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  if (!doc) {
    return {
      twilioAccountSidMasked: null,
      twilioAuthTokenMasked: null,
      twilioWhatsAppFrom: null,
      emailWebhookSecretMasked: null,
      ingestWebhookSecretMasked: null,
      voiceIngressProvider: "twilio",
      enabledChannels: { voice: true, whatsapp: true, email: true, chat: true }
    };
  }
  const sid = typeof doc.twilioAccountSid === "string" ? doc.twilioAccountSid : "";
  const tok = typeof doc.twilioAuthToken === "string" ? doc.twilioAuthToken : "";
  const wh = typeof doc.twilioWhatsAppFrom === "string" ? doc.twilioWhatsAppFrom : "";
  const es = typeof doc.emailWebhookSecret === "string" ? doc.emailWebhookSecret : "";
  const is = typeof doc.ingestWebhookSecret === "string" ? doc.ingestWebhookSecret : "";
  const ec = doc.enabledChannels as Record<string, unknown> | undefined;
  const vip = doc.voiceIngressProvider;
  const voiceIngressProvider: "twilio" | "sip_gateway" =
    vip === "sip_gateway" ? "sip_gateway" : "twilio";
  return {
    twilioAccountSidMasked: sid ? maskSid(sid) : null,
    twilioAuthTokenMasked: tok ? mask(tok) : null,
    twilioWhatsAppFrom: wh || null,
    emailWebhookSecretMasked: es ? mask(es) : null,
    ingestWebhookSecretMasked: is ? mask(is) : null,
    voiceIngressProvider,
    enabledChannels: {
      voice: ec?.voice !== false,
      whatsapp: ec?.whatsapp !== false,
      email: ec?.email !== false,
      chat: ec?.chat !== false
    }
  };
}

/** Credenziali Twilio per firma e API (documento workspace o env). */
export async function getTwilioCredentialsForWorkspace(workspaceId: string): Promise<{ accountSid: string; authToken: string } | null> {
  const { ENV } = await import("../../config/env.js");
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  const accountSid = (typeof doc?.twilioAccountSid === "string" && doc.twilioAccountSid.trim()
    ? doc.twilioAccountSid.trim()
    : ENV.ZEUS_TWILIO_ACCOUNT_SID.trim()) || "";
  const authToken = (typeof doc?.twilioAuthToken === "string" && doc.twilioAuthToken.trim()
    ? doc.twilioAuthToken.trim()
    : ENV.ZEUS_TWILIO_AUTH_TOKEN.trim()) || "";
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

export async function isZeusChannelEnabled(
  workspaceId: string,
  channel: "voice" | "whatsapp" | "email" | "chat"
): Promise<boolean> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  const ec = doc?.enabledChannels as Record<string, boolean> | undefined;
  if (!ec) return true;
  return ec[channel] !== false;
}

export async function getEmailWebhookSecret(workspaceId: string): Promise<string | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  const s = doc && typeof doc.emailWebhookSecret === "string" ? doc.emailWebhookSecret.trim() : "";
  return s || null;
}

/** Segreto per `POST .../zeus/webhooks/ingest`: dedicato o, se assente, stesso dell'email inbound. */
export async function getIngestWebhookSecret(workspaceId: string): Promise<string | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  const ingest = doc && typeof doc.ingestWebhookSecret === "string" ? doc.ingestWebhookSecret.trim() : "";
  if (ingest) return ingest;
  return getEmailWebhookSecret(workspaceId);
}

export async function patchZeusPocConfig(workspaceId: string, raw: unknown): Promise<ZeusPocConfigPublic> {
  const body = PatchSchema.safeParse(raw);
  if (!body.success) throw new HttpError("Validazione fallita", 400);
  const db = getDb();
  const existing = await db.collection(COLLECTION).findOne({ workspaceId });
  const setDoc: Record<string, unknown> = { workspaceId, updatedAt: new Date().toISOString() };
  if (body.data.twilioAccountSid !== undefined) setDoc.twilioAccountSid = body.data.twilioAccountSid.trim();
  if (body.data.twilioAuthToken !== undefined) setDoc.twilioAuthToken = body.data.twilioAuthToken.trim();
  if (body.data.twilioWhatsAppFrom !== undefined) setDoc.twilioWhatsAppFrom = body.data.twilioWhatsAppFrom.trim();
  if (body.data.emailWebhookSecret !== undefined) {
    const t = body.data.emailWebhookSecret.trim();
    setDoc.emailWebhookSecret =
      t || (typeof existing?.emailWebhookSecret === "string" ? existing.emailWebhookSecret : crypto.randomBytes(24).toString("hex"));
  } else if (!existing) {
    setDoc.emailWebhookSecret = crypto.randomBytes(24).toString("hex");
  }
  if (body.data.ingestWebhookSecret !== undefined) {
    const t = body.data.ingestWebhookSecret.trim();
    if (t) setDoc.ingestWebhookSecret = t;
  }
  if (body.data.voiceIngressProvider !== undefined) {
    setDoc.voiceIngressProvider = body.data.voiceIngressProvider;
  }
  if (body.data.enabledChannels) {
    const prev = (existing?.enabledChannels as Record<string, boolean> | undefined) ?? {};
    setDoc.enabledChannels = {
      voice: body.data.enabledChannels.voice ?? prev.voice ?? true,
      whatsapp: body.data.enabledChannels.whatsapp ?? prev.whatsapp ?? true,
      email: body.data.enabledChannels.email ?? prev.email ?? true,
      chat: body.data.enabledChannels.chat ?? prev.chat ?? true
    };
  }
  await db.collection(COLLECTION).updateOne({ workspaceId }, { $set: setDoc }, { upsert: true });
  return getZeusPocConfig(workspaceId);
}
