/**
 * Etichette CTA condivise nel tab Integrazioni (tone-of-voice coerente: verbi chiari, italiano uniforme).
 */
export const INTEGRATION_LABELS = {
  connectNow: "Connetti ora",
  verifyAfterProvider: "Ho completato, verifica",
  openAdvanced: "Apri modalità avanzata",
  /** Scollegamento connettore dalla card catalogo */
  disconnect: "Scollega",
  disconnectLoading: "Scollegamento…",
  disconnectGoogle: "Scollega Google",
  disconnectMeta: "Scollega Meta",
  /** Rimuove credenziali salvate nel drawer (variant outline) */
  removeSavedConfig: "Rimuovi configurazione",
  sendTestMessage: "Invia messaggio di prova",
  sendTestWhatsapp: "Invia messaggio di prova (WhatsApp)",
  sendTestMeta: "Invia messaggio di prova (Meta)",
  sendLoading: "Invio in corso…",
  verifyConnection: "Verifica connessione",
  verifyConnectionLoading: "Verifica in corso…",
  verifyShortLoading: "Verifica in corso…",
  /** Controllo rapido stato connettore (card) */
  healthStatus: "Verifica stato",
  /** n8n: invio evento di test al workflow */
  n8nTrialRun: "Esegui prova",
  n8nTrialLoading: "Prova in corso…",
  disconnectAiProvider: "Scollega provider",
} as const;
