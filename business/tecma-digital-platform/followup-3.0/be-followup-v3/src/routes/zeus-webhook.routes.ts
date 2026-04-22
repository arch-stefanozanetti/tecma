/**
 * Webhook pubblici ZEUS — senza JWT.
 * Canali: email inbound, HTTP ingest nativo (JSON), Twilio Voice/WhatsApp (connettore opzionale).
 */
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { ENV } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { runZeusTurn } from "../core/zeus/zeus-orchestrator.service.js";
import { insertZeusTurn } from "../core/zeus/zeus-turns.service.js";
import { handleTwilioVoiceWebhook } from "../core/zeus/twilio-voice-ingress.service.js";
import { handleSipVoiceWebhook, parseSipVoiceBody } from "../core/zeus/sip-voice-ingress.service.js";
import {
  getTwilioCredentialsForWorkspace,
  getEmailWebhookSecret,
  getIngestWebhookSecret,
  isZeusChannelEnabled
} from "../core/zeus/zeus-poc-config.service.js";
import { validateTwilioRequest, flattenTwilioBody } from "../core/zeus/twilio-signature.util.js";
import { sendTwilioWhatsAppReply } from "../core/zeus/zeus-twilio-outbound.service.js";
import { sendZeusReplyEmail } from "../core/email/email.service.js";
import { getCachedZeusAudio } from "../core/zeus/zeus-voice-tts.service.js";
import { zeusWebhookRateLimiter } from "./rateLimitMiddleware.js";
import { getClientIp } from "./requestMeta.js";

export const zeusWebhookRouter = Router({ mergeParams: true });

function getRequestUrl(req: Request): string {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  return `${proto}://${host}${req.originalUrl.split("?")[0]}`;
}

async function verifyTwilio(req: Request, workspaceId: string): Promise<boolean> {
  if (ENV.ZEUS_TWILIO_SKIP_SIGNATURE) {
    logger.warn({ workspaceId }, "[zeus] Twilio signature verification skipped");
    return true;
  }
  const creds = await getTwilioCredentialsForWorkspace(workspaceId);
  if (!creds) {
    logger.error({ workspaceId }, "[zeus] Twilio credentials missing");
    return false;
  }
  const sig = req.get("X-Twilio-Signature");
  const flat = flattenTwilioBody(req.body as Record<string, unknown>);
  const url = getRequestUrl(req);
  return validateTwilioRequest(creds.authToken, sig, url, flat);
}

function normalizeClientIp(req: Request): string {
  const raw = (req.ip && String(req.ip).trim()) || getClientIp(req) || "";
  return raw.replace(/^::ffff:/i, "").trim();
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0) as number;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [net, bitsStr] = cidr.split("/").map((s) => s.trim());
  if (!net || !bitsStr) return false;
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipN = ipv4ToUint32(ip);
  const netN = ipv4ToUint32(net);
  if (ipN === null || netN === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

function isClientIpAllowed(clientIpNorm: string, allowlistEntries: string[]): boolean {
  if (allowlistEntries.length === 0) return true;
  if (!clientIpNorm) return false;
  return allowlistEntries.some((entry) => {
    if (entry.includes("/")) {
      if (!clientIpNorm.includes(":")) return ipv4InCidr(clientIpNorm, entry);
      return false;
    }
    return clientIpNorm === entry;
  });
}

function parseSipAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function verifySipWebhook(req: Request, workspaceId: string): Promise<boolean> {
  if (ENV.ZEUS_SIP_SKIP_SIGNATURE) {
    logger.warn({ workspaceId }, "[zeus] SIP signature verification skipped");
    return true;
  }
  const allowlist = parseSipAllowlist((ENV.ZEUS_SIP_ALLOWED_CIDRS ?? "").trim());
  const clientIp = normalizeClientIp(req);
  if (!isClientIpAllowed(clientIp, allowlist)) {
    logger.warn({ workspaceId, clientIp }, "[zeus] SIP webhook forbidden by IP allowlist");
    return false;
  }
  const expectedSecret = (ENV.ZEUS_SIP_WEBHOOK_SECRET ?? "").trim();
  if (!expectedSecret) {
    logger.error({ workspaceId }, "[zeus] SIP webhook secret missing");
    return false;
  }
  const authHeader = req.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : "";
  const headerSecret = req.get("x-zeus-sip-secret")?.trim() || "";
  const querySecret = typeof req.query.secret === "string" ? req.query.secret.trim() : "";
  const provided = bearer || headerSecret || querySecret;
  return Boolean(provided) && timingSafeEqualString(expectedSecret, provided);
}

zeusWebhookRouter.post("/twilio/voice", zeusWebhookRateLimiter, async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).send("Missing workspaceId");
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "voice"))) {
    res.status(403).send("Channel disabled");
    return;
  }
  if (!(await verifyTwilio(req, workspaceId))) {
    res.status(403).send("Forbidden");
    return;
  }

  const body = req.body as Record<string, string>;
  const voiceWebhookUrl = getRequestUrl(req).split("?")[0];
  const { twiml } = await handleTwilioVoiceWebhook({
    workspaceId,
    body,
    voiceWebhookUrl
  });
  res.type("text/xml").send(twiml);
});

zeusWebhookRouter.post("/sip/voice", zeusWebhookRateLimiter, async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "Missing workspaceId" });
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "voice"))) {
    res.status(403).json({ error: "Channel disabled" });
    return;
  }
  if (!(await verifySipWebhook(req, workspaceId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  let parsed: ReturnType<typeof parseSipVoiceBody>;
  try {
    parsed = parseSipVoiceBody(req.body);
  } catch {
    res.status(400).json({ error: "Invalid SIP payload" });
    return;
  }
  if (!parsed.transcript.trim()) {
    res.status(400).json({ error: "transcript required" });
    return;
  }
  const voiceWebhookUrl = getRequestUrl(req).split("?")[0];
  const { replyText, llmFailed, playUrl, externalCallId } = await handleSipVoiceWebhook({
    workspaceId,
    body: req.body,
    voiceWebhookUrl
  });
  res.json({
    data: {
      provider: "sip_gateway",
      externalCallId,
      replyText,
      llmFailed,
      playUrl
    }
  });
});

async function handleVoiceAudio(req: Request, res: Response): Promise<void> {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  const audioId = String(req.params.audioId ?? "").trim();
  if (!workspaceId || !audioId) {
    res.status(400).send("Missing params");
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "voice"))) {
    res.status(403).send("Channel disabled");
    return;
  }
  const cached = getCachedZeusAudio(audioId);
  if (!cached) {
    res.status(404).send("Audio not found");
    return;
  }
  res.setHeader("Cache-Control", "private, max-age=120");
  res.type(cached.contentType).send(cached.data);
}

zeusWebhookRouter.get("/twilio/voice-audio/:audioId", async (req: Request, res: Response) => {
  await handleVoiceAudio(req, res);
});
zeusWebhookRouter.get("/voice-audio/:audioId", async (req: Request, res: Response) => {
  await handleVoiceAudio(req, res);
});

zeusWebhookRouter.post("/twilio/whatsapp", zeusWebhookRateLimiter, async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).send("Missing workspaceId");
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "whatsapp"))) {
    res.status(403).send("Channel disabled");
    return;
  }
  if (!(await verifyTwilio(req, workspaceId))) {
    res.status(403).send("Forbidden");
    return;
  }

  const body = req.body as Record<string, string>;
  const text = typeof body.Body === "string" ? body.Body.trim() : "";
  const from = typeof body.From === "string" ? body.From : "";
  const messageSid = typeof body.MessageSid === "string" ? body.MessageSid : "";

  await insertZeusTurn({
    workspaceId,
    channel: "whatsapp",
    direction: "in",
    text: text || "(vuoto)",
    externalId: messageSid || undefined
  });

  let reply: string;
  try {
    reply = await runZeusTurn({
      workspaceId,
      channel: "whatsapp",
      userText: `Messaggio WhatsApp da ${from}:\n${text || "(vuoto)"}`
    });
  } catch (err) {
    logger.error({ err, workspaceId }, "[zeus] whatsapp LLM failed");
    reply = "Ciao, al momento non posso rispondere. Ti contatterà un consulente.";
  }

  await insertZeusTurn({
    workspaceId,
    channel: "whatsapp",
    direction: "out",
    text: reply,
    externalId: messageSid || undefined
  });

  const creds = await getTwilioCredentialsForWorkspace(workspaceId);
  const rawDoc = await (async () => {
    const { getDb } = await import("../config/db.js");
    return getDb().collection("tz_zeus_poc_config").findOne({ workspaceId });
  })();
  const waFrom =
    (rawDoc && typeof rawDoc.twilioWhatsAppFrom === "string" && rawDoc.twilioWhatsAppFrom.trim()
      ? rawDoc.twilioWhatsAppFrom.trim()
      : "") || "";

  if (creds && waFrom && from) {
    try {
      await sendTwilioWhatsAppReply({
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        from: waFrom,
        to: from,
        body: reply
      });
    } catch (err) {
      logger.error({ err, workspaceId }, "[zeus] WhatsApp outbound failed");
    }
  } else {
    logger.warn({ workspaceId, hasCreds: !!creds, waFrom: !!waFrom }, "[zeus] WhatsApp reply not sent: configure twilioWhatsAppFrom + credentials");
  }

  res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf-8");
    const bb = Buffer.from(b, "utf-8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

zeusWebhookRouter.post("/email", async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "Missing workspaceId" });
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "email"))) {
    res.status(403).json({ error: "Channel disabled" });
    return;
  }

  const expectedSecret = await getEmailWebhookSecret(workspaceId);
  const qSecret = typeof req.query.secret === "string" ? req.query.secret : "";
  const hSecret = req.get("x-zeus-email-secret") || "";
  const secret = qSecret || hSecret;
  if (!expectedSecret || !secret || !timingSafeEqualString(expectedSecret, secret)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let from = "";
  let subject = "";
  let text = "";

  if (req.is("application/json")) {
    const j = req.body as Record<string, unknown>;
    from = typeof j.from === "string" ? j.from : typeof j.sender === "string" ? j.sender : "";
    subject = typeof j.subject === "string" ? j.subject : "";
    text =
      typeof j.text === "string"
        ? j.text
        : typeof j.body === "string"
          ? j.body
          : typeof j["text-plain"] === "string"
            ? (j["text-plain"] as string)
            : "";
  } else {
    const b = req.body as Record<string, string>;
    from = b.from || b.sender || b.envelope || "";
    subject = b.subject || "";
    text = b.text || b.body || b["body-plain"] || b.stripped_text || "";
  }

  await insertZeusTurn({
    workspaceId,
    channel: "email",
    direction: "in",
    text: `${subject}\n${text}`,
    externalId: undefined
  });

  let reply: string;
  try {
    reply = await runZeusTurn({
      workspaceId,
      channel: "email",
      userText: `Email da ${from}\nOggetto: ${subject}\n\n${text}`
    });
  } catch (err) {
    logger.error({ err, workspaceId }, "[zeus] email LLM failed");
    reply = "Grazie per il messaggio. Un consulente risponderà al più presto.";
  }

  await insertZeusTurn({
    workspaceId,
    channel: "email",
    direction: "out",
    text: reply,
    externalId: undefined
  });

  const replyTo = from.match(/<([^>]+)>/)?.[1]?.trim() || from.replace(/.*</, "").replace(">", "").trim();
  if (replyTo && replyTo.includes("@")) {
    try {
      await sendZeusReplyEmail(replyTo, `Re: ${subject || "Messaggio"}`.slice(0, 200), reply);
    } catch (err) {
      logger.error({ err, workspaceId }, "[zeus] email outbound failed");
    }
  }

  res.json({ ok: true });
});

/**
 * Ingest HTTP nativo ZEUS (JSON) — alternativa a Twilio: automation, CRM esterni, script.
 * Autenticazione: query `?secret=` o header `x-zeus-ingest-secret` (stesso valore di `ingestWebhookSecret`, o del segreto email se ingest non impostato).
 */
zeusWebhookRouter.post("/ingest", async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "Missing workspaceId" });
    return;
  }
  if (!(await isZeusChannelEnabled(workspaceId, "chat"))) {
    res.status(403).json({ error: "Channel disabled" });
    return;
  }

  const expectedSecret = await getIngestWebhookSecret(workspaceId);
  const qSecret = typeof req.query.secret === "string" ? req.query.secret : "";
  const hSecret = req.get("x-zeus-ingest-secret") || "";
  const secret = qSecret || hSecret;
  if (!expectedSecret || !secret || !timingSafeEqualString(expectedSecret, secret)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!req.is("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }

  const j = req.body as Record<string, unknown>;
  const text = typeof j.text === "string" ? j.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "text required" });
    return;
  }
  const senderLabel = typeof j.senderLabel === "string" && j.senderLabel.trim() ? j.senderLabel.trim() : "HTTP ingest";
  const externalId = typeof j.externalId === "string" && j.externalId.trim() ? j.externalId.trim() : undefined;

  await insertZeusTurn({
    workspaceId,
    channel: "chat",
    direction: "in",
    text,
    externalId
  });

  let reply: string;
  try {
    reply = await runZeusTurn({
      workspaceId,
      channel: "chat",
      userText: `Messaggio da ${senderLabel}:\n${text}`
    });
  } catch (err) {
    logger.error({ err, workspaceId }, "[zeus] ingest LLM failed");
    reply = "Al momento non posso elaborare la richiesta.";
  }

  await insertZeusTurn({
    workspaceId,
    channel: "chat",
    direction: "out",
    text: reply,
    externalId
  });

  res.json({ data: { reply } });
});
