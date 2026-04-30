/**
 * Adapter Track B: Voice Gateway SIP (HTTP webhook JSON) → dominio ZEUS.
 */
import { z } from "zod";
import { synthesizeZeusVoiceAudio } from "./zeus-voice-tts.service.js";
import { runVoiceIngressPipeline } from "./zeus-voice-turn.service.js";

const SipVoiceBodySchema = z
  .object({
    transcript: z.string().optional(),
    text: z.string().optional(),
    speechResult: z.string().optional(),
    callerLabel: z.string().optional(),
    from: z.string().optional(),
    caller: z.string().optional(),
    externalCallId: z.string().optional(),
    callId: z.string().optional(),
    callSid: z.string().optional(),
    sessionId: z.string().optional()
  })
  .passthrough();

export function parseSipVoiceBody(body: unknown): {
  transcript: string;
  externalCallId: string | null;
  callerLabel: string;
} {
  const parsed = SipVoiceBodySchema.parse(body);
  const transcript =
    parsed.transcript?.trim() || parsed.text?.trim() || parsed.speechResult?.trim() || "";
  const externalCallId =
    parsed.externalCallId?.trim() ||
    parsed.callId?.trim() ||
    parsed.callSid?.trim() ||
    parsed.sessionId?.trim() ||
    null;
  const callerLabel =
    parsed.callerLabel?.trim() || parsed.from?.trim() || parsed.caller?.trim() || "sconosciuto";
  return { transcript, externalCallId, callerLabel };
}

export async function handleSipVoiceWebhook(input: {
  workspaceId: string;
  body: unknown;
  /** URL assoluto del POST /sip/voice (senza query), per comporre eventuale URL audio */
  voiceWebhookUrl: string;
}): Promise<{ replyText: string; llmFailed: boolean; playUrl: string | null; externalCallId: string | null }> {
  const { workspaceId, body, voiceWebhookUrl } = input;
  const { transcript, externalCallId, callerLabel } = parseSipVoiceBody(body);
  const baseUrl = voiceWebhookUrl.replace(/\/sip\/voice$/, "");
  const { replyText, llmFailed } = await runVoiceIngressPipeline({
    workspaceId,
    provider: "sip_gateway",
    externalCallId,
    callerLabel,
    transcript
  });
  const audioId = await synthesizeZeusVoiceAudio(replyText);
  const playUrl = audioId ? `${baseUrl}/voice-audio/${audioId}` : null;
  return { replyText, llmFailed, playUrl, externalCallId };
}
