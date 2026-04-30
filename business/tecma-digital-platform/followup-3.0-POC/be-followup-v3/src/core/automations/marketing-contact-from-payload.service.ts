/**
 * Ricava email/nome contatto dal payload evento automazione (per sync Mailchimp / ActiveCampaign).
 */
import { getClientById } from "../clients/clients.service.js";
import { getRequestById } from "../requests/requests.service.js";

export interface MarketingContactResolved {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Usa clientEmail esplicito se presente; altrimenti per entityType request carica cliente dalla trattativa.
 */
export async function resolveMarketingContactFromPayload(
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<MarketingContactResolved | null> {
  const direct = typeof payload.clientEmail === "string" ? payload.clientEmail.trim() : "";
  if (direct.includes("@")) {
    return {
      email: direct,
      firstName: String(payload.clientFirstName ?? payload.firstName ?? "").trim(),
      lastName: String(payload.clientLastName ?? payload.lastName ?? "").trim(),
    };
  }

  const entityType = String(payload.entityType ?? "");
  const entityId = String(payload.entityId ?? "").trim();
  if (entityType !== "request" || !entityId) return null;

  try {
    const { request } = await getRequestById(entityId);
    if (String(request.workspaceId ?? "") !== workspaceId) return null;
    const clientId = String(request.clientId ?? "").trim();
    if (!clientId) return null;
    const { client } = await getClientById(clientId, undefined);
    const email = (client.email ?? "").trim();
    if (!email.includes("@")) return null;
    return {
      email,
      firstName: (client.firstName ?? "").trim(),
      lastName: (client.lastName ?? "").trim(),
    };
  } catch {
    return null;
  }
}
