/**
 * Adapter Track A: webhook Twilio → dominio ZEUS → TwiML.
 */
import { synthesizeZeusVoiceAudio } from "./zeus-voice-tts.service.js";
import { runVoiceIngressPipeline, voiceIngressProviderForTwilio } from "./zeus-voice-turn.service.js";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function parseTwilioVoiceBody(body: Record<string, string>): {
  speechResult: string;
  callSid: string;
  from: string;
} {
  return {
    speechResult: typeof body.SpeechResult === "string" ? body.SpeechResult.trim() : "",
    callSid: typeof body.CallSid === "string" ? body.CallSid : "",
    from: typeof body.From === "string" ? body.From : ""
  };
}

/** TwiML: primo contatto, Gather verso la stessa URL dell’action. actionUrl deve essere già escapato per XML attribute dove serve. */
export function buildTwilioVoiceGatherTwiML(actionUrlXmlEscaped: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" action="${actionUrlXmlEscaped}" method="POST" language="it-IT" speechTimeout="auto"><Say language="it-IT" voice="alice">Pronto, sono Zeus. Come posso aiutarti?</Say></Gather><Say language="it-IT" voice="alice">Non ho ricevuto audio. Riaggancia e richiama.</Say></Response>`;
}

export function buildTwilioVoiceReplyTwiML(opts: {
  replyText: string;
  playUrl: string | null;
}): string {
  const { replyText, playUrl } = opts;
  if (playUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${xmlEscape(playUrl)}</Play></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="it-IT" voice="alice">${xmlEscape(replyText)}</Say></Response>`;
}

export async function handleTwilioVoiceWebhook(input: {
  workspaceId: string;
  body: Record<string, string>;
  /** URL assoluto del POST /twilio/voice (senza query), per costruire action Gather e URL audio */
  voiceWebhookUrl: string;
}): Promise<{ twiml: string }> {
  const { workspaceId, body, voiceWebhookUrl } = input;
  const { speechResult, callSid, from } = parseTwilioVoiceBody(body);
  const provider = voiceIngressProviderForTwilio();
  const baseUrl = voiceWebhookUrl.replace(/\/twilio\/voice$/, "");

  if (!speechResult) {
    const actionUrl = voiceWebhookUrl.replace(/&/g, "&amp;");
    return { twiml: buildTwilioVoiceGatherTwiML(actionUrl) };
  }

  const { replyText } = await runVoiceIngressPipeline({
    workspaceId,
    provider,
    externalCallId: callSid || null,
    callerLabel: from || "sconosciuto",
    transcript: speechResult
  });

  const audioId = await synthesizeZeusVoiceAudio(replyText);
  const playUrl = audioId ? `${baseUrl}/twilio/voice-audio/${audioId}` : null;
  return { twiml: buildTwilioVoiceReplyTwiML({ replyText, playUrl }) };
}
