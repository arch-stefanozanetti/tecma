import { beforeEach, describe, expect, it, vi } from "vitest";

const runVoiceIngressPipeline = vi.fn();
const synthesizeZeusVoiceAudio = vi.fn();

vi.mock("./zeus-voice-turn.service.js", () => ({
  runVoiceIngressPipeline,
  voiceIngressProviderForTwilio: () => "twilio"
}));

vi.mock("./zeus-voice-tts.service.js", () => ({
  synthesizeZeusVoiceAudio
}));

describe("twilio-voice-ingress.service", () => {
  beforeEach(() => {
    runVoiceIngressPipeline.mockReset();
    synthesizeZeusVoiceAudio.mockReset();
  });

  it("ritorna Gather TwiML quando manca SpeechResult", async () => {
    const { handleTwilioVoiceWebhook } = await import("./twilio-voice-ingress.service.js");
    const out = await handleTwilioVoiceWebhook({
      workspaceId: "ws1",
      body: {},
      voiceWebhookUrl: "https://api.example.test/v1/workspaces/ws1/zeus/webhooks/twilio/voice"
    });
    expect(out.twiml).toContain("<Gather");
    expect(runVoiceIngressPipeline).not.toHaveBeenCalled();
  });

  it("usa pipeline voce e genera URL audio quando TTS disponibile", async () => {
    runVoiceIngressPipeline.mockResolvedValue({ replyText: "Risposta Zeus", llmFailed: false });
    synthesizeZeusVoiceAudio.mockResolvedValue("aud_1");
    const { handleTwilioVoiceWebhook } = await import("./twilio-voice-ingress.service.js");
    const out = await handleTwilioVoiceWebhook({
      workspaceId: "ws1",
      body: { SpeechResult: "ciao", CallSid: "CA123", From: "+39001234" },
      voiceWebhookUrl: "https://api.example.test/v1/workspaces/ws1/zeus/webhooks/twilio/voice"
    });
    expect(runVoiceIngressPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws1",
        provider: "twilio",
        externalCallId: "CA123",
        callerLabel: "+39001234",
        transcript: "ciao"
      })
    );
    expect(out.twiml).toContain("<Play>");
    expect(out.twiml).toContain("/v1/workspaces/ws1/zeus/webhooks/twilio/voice-audio/aud_1");
  });
});
