/**
 * Pipeline voce lato dominio: stessi passi per Twilio (Track A) e per SIP gateway (Track B).
 */
import { logger } from "../../observability/logger.js";
import { runZeusTurn } from "./zeus-orchestrator.service.js";
import { insertZeusTurn } from "./zeus-turns.service.js";
import type {
  VoiceIngressEvent,
  VoiceIngressPipelineResult,
  VoiceIngressProviderId
} from "./zeus-voice-ingress.types.js";

const FALLBACK_REPLY = "Al momento non posso elaborare la richiesta. Un consulente ti ricontatterà.";

export async function runVoiceIngressPipeline(event: VoiceIngressEvent): Promise<VoiceIngressPipelineResult> {
  const { workspaceId, externalCallId, callerLabel, transcript, provider } = event;
  const trimmed = transcript.trim();
  const userLine = `Trascrizione voce dal numero ${callerLabel}:\n${trimmed}`;

  await insertZeusTurn({
    workspaceId,
    channel: "voice",
    direction: "in",
    text: trimmed || "(vuoto)",
    externalId: externalCallId ?? undefined,
    ingressProvider: provider
  });

  let replyText: string;
  let llmFailed = false;
  try {
    replyText = await runZeusTurn({
      workspaceId,
      channel: "voice",
      userText: userLine
    });
  } catch (err) {
    logger.error({ err, workspaceId, externalCallId, provider }, "[zeus] voice LLM failed");
    llmFailed = true;
    replyText = FALLBACK_REPLY;
  }

  await insertZeusTurn({
    workspaceId,
    channel: "voice",
    direction: "out",
    text: replyText,
    externalId: externalCallId ?? undefined,
    ingressProvider: provider
  });

  logger.info(
    {
      event: "zeus_voice_turn",
      workspaceId,
      voiceIngressProvider: provider,
      externalCallId: externalCallId ?? undefined,
      llmFailed,
      inboundWords: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
      replyChars: replyText.length
    },
    "[zeus] voice ingress turn completed"
  );

  return { replyText, llmFailed };
}

export function voiceIngressProviderForTwilio(): VoiceIngressProviderId {
  return "twilio";
}
