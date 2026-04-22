import express from "express";
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
    process.env.ZEUS_SIP_WEBHOOK_SECRET = "sip-secret-123456";
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
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .send({ transcript: "ciao" });
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
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("x-zeus-sip-secret", "sip-secret-123456")
        .send({ transcript: "" });
      expect(res.status).toBe(400);
    } finally {
      await closeStable(server);
    }
  });

  it("risponde 200 con payload verify quando SIP valido", async () => {
    const { zeusWebhookRouter } = await import("./zeus-webhook.routes.js");
    const app = express();
    app.use(express.json());
    app.use("/v1/workspaces/:workspaceId/zeus/webhooks", zeusWebhookRouter);
    const { server, origin } = await listenStable(app);
    try {
      const res = await stableRequest(origin)
        .post("/v1/workspaces/ws1/zeus/webhooks/sip/voice")
        .set("authorization", "Bearer sip-secret-123456")
        .send({ transcript: "ciao da sip" });
      expect(res.status).toBe(200);
      expect(res.body?.data?.provider).toBe("sip_gateway");
      expect(handleSipVoiceWebhook).toHaveBeenCalled();
    } finally {
      await closeStable(server);
    }
  });
});
