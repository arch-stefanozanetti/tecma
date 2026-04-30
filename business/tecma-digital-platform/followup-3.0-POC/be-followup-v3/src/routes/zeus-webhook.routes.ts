/**
 * Webhook pubblici ZEUS — senza JWT.
 * Canali: email inbound, HTTP ingest nativo (JSON), Twilio Voice/WhatsApp (connettore opzionale).
 */
import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import net from "node:net";
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
const SIP_SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

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
  return raw.replace(/^\[|\]$/g, "").replace(/^::ffff:/i, "").trim();
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0) as number;
}

type ParsedIp = {
  family: "ipv4" | "ipv6";
  value: bigint;
};

function parseIpv6ToBigInt(ip: string): bigint | null {
  const normalized = ip.trim().toLowerCase();
  if (!net.isIPv6(normalized)) return null;
  const [headRaw, tailRaw] = normalized.includes("::") ? normalized.split("::", 2) : [normalized, ""];
  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const tokens = part.split(":").filter(Boolean);
    const out: number[] = [];
    for (const token of tokens) {
      if (token.length === 0) return null;
      if (token.includes(".")) {
        const v4 = ipv4ToUint32(token);
        if (v4 === null) return null;
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
        continue;
      }
      const n = Number.parseInt(token, 16);
      if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
      out.push(n);
    }
    return out;
  };
  const head = parsePart(headRaw);
  const tail = parsePart(tailRaw);
  if (!head || !tail) return null;
  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return null;
  const groups = normalized.includes("::") ? [...head, ...Array.from({ length: missing }, () => 0), ...tail] : [...head];
  if (groups.length !== 8) return null;
  return groups.reduce<bigint>((acc, part) => (acc << 16n) + BigInt(part), 0n);
}

function parseIpLiteral(ip: string): ParsedIp | null {
  const normalized = ip.trim().replace(/^\[|\]$/g, "");
  if (net.isIPv4(normalized)) {
    const v4 = ipv4ToUint32(normalized);
    return v4 === null ? null : { family: "ipv4", value: BigInt(v4) };
  }
  if (net.isIPv6(normalized)) {
    const v6 = parseIpv6ToBigInt(normalized);
    return v6 === null ? null : { family: "ipv6", value: v6 };
  }
  return null;
}

function ipInCidr(ip: ParsedIp, cidr: string): boolean {
  const [netIpRaw, bitsRaw] = cidr.split("/").map((s) => s.trim());
  if (!netIpRaw || !bitsRaw) return false;
  const networkIp = parseIpLiteral(netIpRaw);
  if (!networkIp || networkIp.family !== ip.family) return false;
  const bits = Number(bitsRaw);
  const totalBits = ip.family === "ipv4" ? 32 : 128;
  if (!Number.isInteger(bits) || bits < 0 || bits > totalBits) return false;
  if (bits === 0) return true;
  const shift = BigInt(totalBits - bits);
  return (ip.value >> shift) === (networkIp.value >> shift);
}

function stableSortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortJson);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableSortJson(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalSipPayloadBody(body: unknown): string {
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(stableSortJson(body ?? {}));
  } catch {
    return "";
  }
}

function signSipPayload(secret: string, timestampRaw: string, body: unknown): string {
  const payload = `${timestampRaw}.${canonicalSipPayloadBody(body)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function normalizeSipSignature(sigRaw: string): string {
  const trimmed = sigRaw.trim();
  return trimmed.toLowerCase().startsWith("sha256=") ? trimmed.slice("sha256=".length).trim() : trimmed;
}

function parseSipTimestampMs(tsRaw: string): number | null {
  if (!/^\d{10,13}$/.test(tsRaw.trim())) return null;
  const asNum = Number(tsRaw.trim());
  if (!Number.isFinite(asNum) || asNum <= 0) return null;
  return tsRaw.trim().length <= 10 ? asNum * 1000 : asNum;
}

function verifySipTimestampAndSignature(req: Request, secret: string): boolean {
  const tsHeader = req.get("x-zeus-sip-ts")?.trim() || "";
  const sigHeader = req.get("x-zeus-sip-signature")?.trim() || "";
  if (!tsHeader || !sigHeader) return false;
  const tsMs = parseSipTimestampMs(tsHeader);
  if (tsMs === null) return false;
  if (Math.abs(Date.now() - tsMs) > SIP_SIGNATURE_WINDOW_MS) return false;
  const expectedSig = signSipPayload(secret, tsHeader, req.body);
  const providedSig = normalizeSipSignature(sigHeader);
  return timingSafeEqualString(expectedSig, providedSig);
}

function extractSipProvidedSecret(req: Request): string {
  const authHeader = req.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : "";
  const headerSecret = req.get("x-zeus-sip-secret")?.trim() || "";
  const querySecret = typeof req.query.secret === "string" ? req.query.secret.trim() : "";
  return bearer || headerSecret || querySecret;
}

function isClientIpAllowed(clientIpNorm: string, allowlistEntries: string[]): boolean {
  if (allowlistEntries.length === 0) return true;
  const parsedClientIp = parseIpLiteral(clientIpNorm);
  if (!parsedClientIp) return false;
  return allowlistEntries.some((entry) => {
    if (entry.includes("/")) {
      return ipInCidr(parsedClientIp, entry);
    }
    const parsedExact = parseIpLiteral(entry);
    return parsedExact !== null && parsedExact.family === parsedClientIp.family && parsedExact.value === parsedClientIp.value;
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
  const provided = extractSipProvidedSecret(req);
  if (!provided || !timingSafeEqualString(expectedSecret, provided)) {
    logger.warn({ workspaceId }, "[zeus] SIP webhook secret mismatch");
    return false;
  }
  if (!verifySipTimestampAndSignature(req, expectedSecret)) {
    logger.warn({ workspaceId }, "[zeus] SIP webhook signature/timestamp invalid");
    return false;
  }
  return true;
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
