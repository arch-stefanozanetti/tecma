/**
 * Track B (futuro): Voice Gateway SIP → stesso contratto di {@link ../zeus-voice-ingress.types.ts}.
 * Nessun traffico reale: endpoint HTTP risponde 501 finché il gateway non è implementato.
 *
 * Quando il gateway sarà pronto:
 * 1. Ricevere eventi (es. WebSocket) con transcript + session id + caller.
 * 2. Chiamare `runVoiceIngressPipeline` con `provider: "sip_gateway"`.
 * 3. Inviare audio di risposta al gateway (stream o URL) invece di TwiML.
 */
import type { VoiceIngressEvent } from "./zeus-voice-ingress.types.js";

export const SIP_VOICE_GATEWAY_NOT_IMPLEMENTED =
  "SIP voice gateway (Track B) is not deployed. Use Twilio webhooks (Track A) or implement the gateway adapter.";

/** Placeholder per test di tipo: stesso ingresso dominio, uscita non TwiML. */
export async function runSipVoiceIngressPlaceholder(_event: VoiceIngressEvent): Promise<never> {
  throw new Error(SIP_VOICE_GATEWAY_NOT_IMPLEMENTED);
}
