/**
 * Sync contatti verso Mailchimp Marketing API e ActiveCampaign API (usa API key salvate in tz_connector_configs).
 */
import { createHash } from "node:crypto";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";
import { getMarketingConnectorSecrets } from "../connectors/marketing-api-key-config.service.js";

function extractMailchimpDc(apiKey: string): string {
  const i = apiKey.lastIndexOf("-");
  if (i < 0 || i >= apiKey.length - 1) {
    throw new HttpError("API key Mailchimp non valida: atteso formato …-usX (datacenter)", 400);
  }
  return apiKey.slice(i + 1).trim();
}

function subscriberHash(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export type MailchimpMemberStatus = "subscribed" | "pending";

/**
 * UPSERT iscritto su audience Mailchimp (PUT /lists/{id}/members/{hash}).
 */
export async function upsertMailchimpListMember(
  workspaceId: string,
  listId: string,
  contact: { email: string; firstName?: string; lastName?: string },
  status: MailchimpMemberStatus = "subscribed"
): Promise<void> {
  const secrets = await getMarketingConnectorSecrets(workspaceId, "mailchimp");
  if (!secrets) {
    throw new HttpError("Connettore Mailchimp non configurato per questo workspace", 400);
  }
  const dc = extractMailchimpDc(secrets.apiKey);
  const hash = subscriberHash(contact.email);
  const auth = Buffer.from(`user:${secrets.apiKey}`, "utf8").toString("base64");
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(listId)}/members/${hash}`;
  const body = {
    email_address: contact.email.trim(),
    status_if_new: status,
    merge_fields: {
      FNAME: (contact.firstName ?? "").slice(0, 255),
      LNAME: (contact.lastName ?? "").slice(0, 255),
    },
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ workspaceId, listId, status: res.status, text: text.slice(0, 500) }, "[marketing] Mailchimp API error");
    throw new HttpError(`Mailchimp API: ${res.status} ${text.slice(0, 200)}`, res.status >= 500 ? 502 : 400);
  }
}

/**
 * Crea/aggiorna contatto ActiveCampaign e opzionalmente iscrive a lista (contact/sync + contactLists).
 */
export async function upsertActiveCampaignContact(
  workspaceId: string,
  contact: { email: string; firstName?: string; lastName?: string },
  listId?: string
): Promise<void> {
  const secrets = await getMarketingConnectorSecrets(workspaceId, "activecampaign");
  if (!secrets) {
    throw new HttpError("Connettore ActiveCampaign non configurato per questo workspace", 400);
  }
  const base = secrets.apiBaseUrl?.replace(/\/$/, "");
  if (!base) {
    throw new HttpError("ActiveCampaign: manca apiBaseUrl in configurazione (salva URL API dal pannello AC)", 400);
  }
  const syncUrl = `${base}/api/3/contact/sync`;
  const syncRes = await fetch(syncUrl, {
    method: "POST",
    headers: {
      "Api-Token": secrets.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contact: {
        email: contact.email.trim(),
        firstName: (contact.firstName ?? "").slice(0, 255) || undefined,
        lastName: (contact.lastName ?? "").slice(0, 255) || undefined,
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!syncRes.ok) {
    const text = await syncRes.text().catch(() => "");
    logger.warn(
      { workspaceId, status: syncRes.status, text: text.slice(0, 500) },
      "[marketing] ActiveCampaign contact/sync error"
    );
    throw new HttpError(
      `ActiveCampaign API: ${syncRes.status} ${text.slice(0, 200)}`,
      syncRes.status >= 500 ? 502 : 400
    );
  }
  const syncJson = (await syncRes.json()) as { contact?: { id?: string } };
  const contactAcId = syncJson.contact?.id;
  const list = (listId ?? "").trim();
  if (!list || !contactAcId) return;

  const clUrl = `${base}/api/3/contactLists`;
  const clRes = await fetch(clUrl, {
    method: "POST",
    headers: {
      "Api-Token": secrets.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contactList: {
        list,
        contact: contactAcId,
        status: 1,
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!clRes.ok) {
    const text = await clRes.text().catch(() => "");
    logger.warn(
      { workspaceId, listId: list, status: clRes.status, text: text.slice(0, 500) },
      "[marketing] ActiveCampaign contactLists error"
    );
    throw new HttpError(
      `ActiveCampaign list subscribe: ${clRes.status} ${text.slice(0, 200)}`,
      clRes.status >= 500 ? 502 : 400
    );
  }
}
