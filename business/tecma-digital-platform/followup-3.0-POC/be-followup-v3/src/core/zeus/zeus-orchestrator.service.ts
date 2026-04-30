import { ENV } from "../../config/env.js";
import { completeChatText } from "../ai/llm.client.js";
import { getWorkspaceAiConfigInternal } from "../workspaces/workspace-ai-config.service.js";
import type { ZeusChannel } from "./zeus-turns.service.js";

const ZEUS_SYSTEM = `Sei ZEUS, assistente commerciale per un CRM immobiliare B2B.
Rispondi in italiano, tono professionale e breve (max 8 frasi salvo richieste di dettaglio).
Canale: {{channel}}.
Non inventare prezzi, disponibilità o dati di immobili: se non li hai, invita a essere ricontattati da un consulente umano.
Non dare consigli legali o fiscali.`;

export async function runZeusTurn(input: {
  workspaceId: string;
  channel: ZeusChannel;
  userText: string;
}): Promise<string> {
  if (ENV.AI_LLM_DISABLED) {
    return `[ZEUS — LLM disattivato] Messaggio ricevuto sul canale ${input.channel}. Configura AI workspace o imposta AI_LLM_DISABLED=false.`;
  }

  const ai = await getWorkspaceAiConfigInternal(input.workspaceId);
  if (!ai) {
    return "ZEUS non è ancora configurato: imposta provider e API key nelle integrazioni (configurazione AI workspace).";
  }

  const channelLabel =
    input.channel === "voice"
      ? "telefono"
      : input.channel === "whatsapp"
        ? "WhatsApp"
        : input.channel === "chat"
          ? "chat nativa Followup (API o webhook HTTP)"
          : "email";

  const system = ZEUS_SYSTEM.replace("{{channel}}", channelLabel);
  const reply = await completeChatText({
    provider: ai.provider,
    apiKey: ai.apiKey,
    system,
    user: input.userText.trim() || "(messaggio vuoto)"
  });
  return reply;
}
