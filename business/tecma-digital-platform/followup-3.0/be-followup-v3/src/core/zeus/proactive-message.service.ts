import { ENV } from "../../config/env.js";
import { completeChatText } from "../ai/llm.client.js";
import { getWorkspaceAiConfigInternal } from "../workspaces/workspace-ai-config.service.js";

export async function generateProactiveMessage(input: {
  workspaceId: string;
  channel: "email" | "whatsapp";
  facts: Record<string, unknown>;
}): Promise<{ subject: string | null; body: string }> {
  if (ENV.AI_LLM_DISABLED) {
    return {
      subject: input.channel === "email" ? "Aggiornamento dal nostro team" : null,
      body: "Ti contattiamo in merito al tuo interesse. Un consulente può darti dettagli aggiornati."
    };
  }
  const ai = await getWorkspaceAiConfigInternal(input.workspaceId);
  if (!ai) {
    return {
      subject: input.channel === "email" ? "Follow-up" : null,
      body: "Grazie per l’interesse. Per informazioni aggiornate un consulente ti ricontatterà a breve."
    };
  }

  const system = `Sei ZEUS Proactive, assistente CRM immobiliare. Genera un messaggio breve (max 5 righe), tono umano e professionale, non aggressivo.
Usa SOLO i fatti nel JSON FACTS. Non inventare disponibilità, prezzi o urgenze non presenti nei fatti.
Output: primo rigo SOLO un JSON con chiavi subject (stringa o null se WhatsApp), body (stringa). Esempio:
{"subject":"...","body":"..."}`;

  const user = `FACTS:\n${JSON.stringify(input.facts, null, 0)}\nCHANNEL: ${input.channel}`;

  const raw = await completeChatText({
    provider: ai.provider,
    apiKey: ai.apiKey,
    system,
    user
  });

  let subject: string | null = null;
  let body = raw;
  try {
    const j = JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as {
      subject?: string;
      body?: string;
    };
    if (typeof j.body === "string" && j.body.trim()) body = j.body.trim();
    if (typeof j.subject === "string" && j.subject.trim()) subject = j.subject.trim();
  } catch {
    body = raw.slice(0, 2000);
  }

  return { subject: input.channel === "email" ? subject : null, body };
}
