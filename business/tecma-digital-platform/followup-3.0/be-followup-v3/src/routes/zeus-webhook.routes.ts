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
import { SIP_VOICE_GATEWAY_NOT_IMPLEMENTED } from "../core/zeus/sip-voice-ingress.stub.js";
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

zeusWebhookRouter.post("/twilio/voice", async (req: Request, res: Response) => {
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

/** Stub Track B: stesso workspace, contratto HTTP da definire con il Voice Gateway SIP. */
zeusWebhookRouter.post("/sip/voice", async (req: Request, res: Response) => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ error: "Missing workspaceId" });
    return;
  }
  logger.warn({ workspaceId }, "[zeus] SIP voice webhook called but not implemented");
  res.status(501).json({
    error: "Not Implemented",
    message: SIP_VOICE_GATEWAY_NOT_IMPLEMENTED
  });
});

zeusWebhookRouter.get("/twilio/voice-audio/:audioId", async (req: Request, res: Response) => {
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
});

zeusWebhookRouter.post("/twilio/whatsapp", async (req: Request, res: Response) => {
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
