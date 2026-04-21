import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { generateProactiveMessage } from "./proactive-message.service.js";
import { logOutreach } from "./proactive-outreach-log.service.js";
import { sendZeusReplyEmail } from "../email/email.service.js";

const COLLECTION = "tz_proactive_opportunities";

export type ProactiveTriggerType = "lead_silent" | "hot_lead";
export type ProactiveStatus = "pending_review" | "sent" | "dismissed" | "expired";

export interface ProactiveOpportunityDoc {
  _id?: ObjectId;
  workspaceId: string;
  clientId: string;
  projectId: string;
  triggerType: ProactiveTriggerType;
  score: number;
  status: ProactiveStatus;
  facts: Record<string, unknown>;
  suggestedSubject: string | null;
  suggestedBody: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  dismissedAt?: string;
}

export type ProactiveOpportunityPublic = Omit<ProactiveOpportunityDoc, "_id"> & { id: string };

function toPublic(doc: Record<string, unknown>): ProactiveOpportunityPublic {
  const _id = doc._id instanceof ObjectId ? doc._id : null;
  const rest = { ...doc };
  delete rest._id;
  return {
    ...(rest as Omit<ProactiveOpportunityDoc, "_id">),
    id: _id ? _id.toHexString() : ""
  };
}

export async function listProactiveOpportunities(
  workspaceId: string,
  opts: { status?: ProactiveStatus; limit?: number }
): Promise<ProactiveOpportunityPublic[]> {
  const db = getDb();
  const q: Record<string, unknown> = { workspaceId };
  if (opts.status) q.status = opts.status;
  const limit = Math.min(opts.limit ?? 50, 100);
  const rows = await db
    .collection(COLLECTION)
    .find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((d) => toPublic(d as Record<string, unknown>));
}

/** Una sola opportunità in pending_review per cliente (ultima sovrascrive trigger/copy). */
export async function upsertPendingOpportunityForClient(
  input: Omit<ProactiveOpportunityDoc, "_id" | "sentAt" | "dismissedAt">
): Promise<void> {
  const db = getDb();
  const now = input.updatedAt;
  await db.collection(COLLECTION).updateOne(
    { workspaceId: input.workspaceId, clientId: input.clientId, status: "pending_review" },
    {
      $set: {
        workspaceId: input.workspaceId,
        clientId: input.clientId,
        projectId: input.projectId,
        triggerType: input.triggerType,
        score: input.score,
        status: "pending_review" as const,
        facts: input.facts,
        suggestedSubject: input.suggestedSubject,
        suggestedBody: input.suggestedBody,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );
}

export async function dismissOpportunity(workspaceId: string, opportunityId: string): Promise<ProactiveOpportunityPublic> {
  const db = getDb();
  if (!ObjectId.isValid(opportunityId)) throw new HttpError("Opportunità non trovata", 404);
  const res = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(opportunityId), workspaceId },
    {
      $set: {
        status: "dismissed" as const,
        dismissedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: "after" }
  );
  if (!res) throw new HttpError("Opportunità non trovata", 404);
  return toPublic(res as Record<string, unknown>);
}

export async function sendProactiveOpportunity(
  workspaceId: string,
  opportunityId: string,
  body: { channel?: "email" | "whatsapp"; subject?: string; body?: string }
): Promise<ProactiveOpportunityPublic> {
  const db = getDb();
  if (!ObjectId.isValid(opportunityId)) throw new HttpError("Opportunità non trovata", 404);
  const doc = await db.collection(COLLECTION).findOne({
    _id: new ObjectId(opportunityId),
    workspaceId
  });
  if (!doc) throw new HttpError("Opportunità non trovata", 404);
  const opp = doc as unknown as ProactiveOpportunityDoc;

  if (opp.status !== "pending_review") throw new HttpError("Opportunità non inviabile in questo stato", 400);

  const channel = body.channel ?? "email";
  const text = typeof body.body === "string" && body.body.trim() ? body.body.trim() : opp.suggestedBody;
  const subject =
    channel === "email"
      ? typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : opp.suggestedSubject ?? "Messaggio dal team"
      : null;

  if (channel === "email") {
    const clientDoc = await db.collection("tz_clients").findOne({
      _id: new ObjectId(opp.clientId),
      workspaceId
    });
    const email = typeof clientDoc?.email === "string" ? clientDoc.email.trim() : "";
    if (!email) throw new HttpError("Email cliente mancante: aggiorna la scheda cliente", 400);
    await sendZeusReplyEmail(email, subject ?? "Messaggio dal team", text);
  } else {
    throw new HttpError("Invio WhatsApp proactive non ancora collegato (usa email)", 501);
  }

  const now = new Date().toISOString();
  await logOutreach({
    workspaceId,
    clientId: opp.clientId,
    channel: "email",
    opportunityId,
    triggerType: opp.triggerType
  });

  const res = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(opportunityId), workspaceId },
    { $set: { status: "sent" as const, sentAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!res) throw new HttpError("Aggiornamento fallito", 500);
  return toPublic(res as Record<string, unknown>);
}

export async function refreshSuggestedCopy(workspaceId: string, opportunityId: string): Promise<ProactiveOpportunityPublic> {
  const db = getDb();
  if (!ObjectId.isValid(opportunityId)) throw new HttpError("Opportunità non trovata", 404);
  const doc = await db.collection(COLLECTION).findOne({
    _id: new ObjectId(opportunityId),
    workspaceId
  });
  if (!doc) throw new HttpError("Opportunità non trovata", 404);
  const opp = doc as unknown as ProactiveOpportunityDoc;
  const gen = await generateProactiveMessage({
    workspaceId,
    channel: "email",
    facts: opp.facts
  });
  const now = new Date().toISOString();
  const res = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(opportunityId), workspaceId },
    {
      $set: {
        suggestedSubject: gen.subject,
        suggestedBody: gen.body,
        updatedAt: now
      }
    },
    { returnDocument: "after" }
  );
  if (!res) throw new HttpError("Aggiornamento fallito", 500);
  return toPublic(res as Record<string, unknown>);
}
