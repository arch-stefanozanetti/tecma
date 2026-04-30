import { logger } from "../../observability/logger.js";

/**
 * Invia messaggio WhatsApp via API REST Twilio.
 */
export async function sendTwilioWhatsAppReply(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<void> {
  const { accountSid, authToken, from, to, body } = params;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`, "utf-8").toString("base64");
  const form = new URLSearchParams();
  form.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:${from}`);
  form.set("To", to.startsWith("whatsapp:") ? to : `whatsapp:${to}`);
  form.set("Body", body.slice(0, 1600));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  if (!res.ok) {
    const t = await res.text();
    logger.error({ status: res.status, body: t.slice(0, 500) }, "[zeus] Twilio WhatsApp send failed");
    throw new Error(`Twilio: ${res.status}`);
  }
}
