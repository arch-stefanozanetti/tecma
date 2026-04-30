import { getDb } from "../../config/db.js";

const COLLECTION = "tz_proactive_outreach_log";

export async function countOutreachInWindow(
  workspaceId: string,
  clientId: string,
  sinceIso: string
): Promise<number> {
  const db = getDb();
  return db.collection(COLLECTION).countDocuments({
    workspaceId,
    clientId,
    sentAt: { $gte: sinceIso }
  });
}

export async function logOutreach(input: {
  workspaceId: string;
  clientId: string;
  channel: "email" | "whatsapp";
  opportunityId: string;
  triggerType: string;
}): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).insertOne({
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    channel: input.channel,
    opportunityId: input.opportunityId,
    triggerType: input.triggerType,
    sentAt: new Date().toISOString()
  });
}
