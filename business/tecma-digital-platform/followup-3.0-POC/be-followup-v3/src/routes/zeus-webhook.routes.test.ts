import express from "express";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeStable, listenStable, stableRequest } from "../test/stableHttpServer.js";

const isZeusChannelEnabled = vi.fn();
const getTwilioCredentialsForWorkspace = vi.fn();
const getEmailWebhookSecret = vi.fn();
const getIngestWebhookSecret = vi.fn();
const handleSipVoiceWebhook = vi.fn();
const parseSipVoiceBody = vi.fn();
const handleTwilioVoiceWebhook = vi.fn();
const getCachedZeusAudio = vi.fn();
const SIP_SECRET = "sip-secret-123456";

function signSipBody(body: unknown, secret = SIP_SECRET, tsMs = Date.now()): { ts: string; signature: string } {
  const canonical = JSON.stringify(body ?? {});
  const ts = String(tsMs);
  const signature = crypto.createHmac("sha256", secret).update(`${ts}.${canonical}`).digest("hex");
  return { ts, signature };
}

vi.mock("../core/zeus/zeus-poc-config.service.js", () => ({
  isZeusChannelEnabled,
  getTwilioCredentialsForWorkspace,
  getEmailWebhookSecret,
  getIngestWebhookSecret
}));

vi.mock("../core/zeus/sip-voice-ingress.service.js", () => ({
  handleSipVoiceWebhook,
  parseSipVoiceBody
}));

vi.mock("../core/zeus/twilio-voice-ingress.service.js", () => ({
  handleTwilioVoiceWebhook
}));

vi.mock("../core/zeus/twilio-signature.util.js", () => ({
  flattenTwilioBody: () => ({}),
  validateTwilioRequest: () => true
}));

vi.mock("../core/zeus/zeus-orchestrator.service.js", () => ({
  runZeusTurn: vi.fn()
}));

vi.mock("../core/zeus/zeus-turns.service.js", () => ({
  insertZeusTurn: vi.fn()
}));

vi.mock("../core/zeus/zeus-twilio-outbound.service.js", () => ({
  sendTwilioWhatsAppReply: vi.fn()
}));

vi.mock("../core/email/email.service.js", () => ({
  sendZeusReplyEmail: vi.fn()
}));

vi.mock("../core/zeus/zeus-voice-tts.service.js", () => ({
  getCachedZeusAudio
}));

describe("zeus-webhook.routes /sip/voice", () => {
  beforeEach(() => {
    vi.resetModules();
    isZeusChannelEnabled.mockResolvedValue(true);
    getTwilioCredentialsForWorkspace.mockResolvedValue({ accountSid: "AC123", authToken: "token" });
    getEmailWebhookSecret.mockResolvedValue("email-secret");
    getIngestWebhookSecret.mockResolvedValue("ingest-secret");
    parseSipVoiceBody.mockReturnValue({
      transcript: "ciao da sip",
      externalCallId: "SIP-1",
      callerLabel: "+390000"
    });
    handleSipVoiceWebhook.mockResolvedValue({
      replyText: "ok",
      llmFailed: false,
      playUrl: "https://api.example.test/audio/a1",
      externalCallId: "SIP-1"
    });

    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "dev-1";
    process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/test";
    process.env.MONGO_DB_NAME ??= "test";
    process.env.AUTH_JWT_SECRET ??= "x".repeat(32);
    process.env.ZEUS_SIP_WEBHOOK_SECRET = SIP_SECRET;
    process.env.ZEUS_SIP_SKIP_SIGNATURE = "false";
    process.env.ZEUS_SIP_ALLOWED_CIDRS = "";
    process.env.ZEUS_TWILIO_SKIP_SIGNATURE = "true";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("risponde 403 con secret SIP non valido", async () => {
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const body = { transcript: "ciao" };
      const signed = signSipBody(body);
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("x-zeus-sip-secret", "wrong-secret")
        .set("x-zeus-sip-ts", signed.ts)
        .set("x-zeus-sip-signature", signed.signature)
        .send(body);
      expect(res.status).toBe(403);
    } finally {
      await closeStable(server);
    }
  });

  it("risponde 400 quando transcript manca", async () => {
    parseSipVoiceBody.mockReturnValue({
      transcript: "",
      externalCallId: "SIP-2",
      callerLabel: "+390001"
    });
    const body = { transcript: "" };
    const signed = signSipBody(body);
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("x-zeus-sip-secret", SIP_SECRET)
        .set("x-zeus-sip-ts", signed.ts)
        .set("x-zeus-sip-signature", signed.signature)
        .send(body);
      expect(res.status).toBe(400);
    } finally {
      await closeStable(server);
    }
  });

  it("risponde 200 con payload verify quando SIP valido", async () => {
    const body = { transcript: "ciao da sip" };
    const signed = signSipBody(body);
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("authorization", `Bearer ${SIP_SECRET}`)
        .set("x-zeus-sip-ts", signed.ts)
        .set("x-zeus-sip-signature", signed.signature)
        .send(body);
      expect(res.status).toBe(200);
      expect(res.body?.data?.provider).toBe("sip_gateway");
      expect(handleSipVoiceWebhook).toHaveBeenCalled();
    } finally {
      await closeStable(server);
    }
  });

  it("risponde 403 con timestamp SIP scaduto (anti-replay)", async () => {
    const body = { transcript: "ciao da sip" };
    const signed = signSipBody(body, SIP_SECRET, Date.now() - 10 * 60 * 1000);
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("x-zeus-sip-secret", SIP_SECRET)
        .set("x-zeus-sip-ts", signed.ts)
        .set("x-zeus-sip-signature", signed.signature)
        .send(body);
      expect(res.status).toBe(403);
    } finally {
      await closeStable(server);
    }
  });
});
