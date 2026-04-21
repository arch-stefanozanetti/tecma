/**
 * Contratto ingresso voce condiviso tra Track A (Twilio) e Track B (SIP / Voice Gateway).
 * Il dominio ZEUS lavora su testo: STT e riproduzione audio restano negli adapter.
 */

/** Identificativo storage/config; l’adapter SIP userà lo stesso valore quando sarà pronto. */
export type VoiceIngressProviderId = "twilio" | "sip_gateway";

/**
 * Evento normalizzato dopo STT (o equivalente): un turno utente sul canale voce.
 * externalCallId sostituisce il concetto Twilio CallSid nel dominio.
 */
export interface VoiceIngressEvent {
  workspaceId: string;
  provider: VoiceIngressProviderId;
  externalCallId: string | null;
  /** E.164 o etichetta mostrabile (es. numero chiamante). */
  callerLabel: string;
  /** Testo utente; stringa vuota = nessun contenuto utile. */
  transcript: string;
}

/** Esito pipeline dominio (LLM + persistenza turni) prima dell’output verso provider telefonico. */
export interface VoiceIngressPipelineResult {
  replyText: string;
  llmFailed: boolean;
}
