import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { decryptUtf8, encryptUtf8 } from "../security/fieldCrypto.js";
import { getInboxMessages } from "../connectors/outlook.service.js";
import { hasZeusTurnExternalId, insertZeusTurn } from "./zeus-turns.service.js";
import { runZeusTurn } from "./zeus-orchestrator.service.js";
import { sendZeusReplyEmail } from "../email/email.service.js";
import { logger } from "../../observability/logger.js";

const COLLECTION = "tz_zeus_email_inbox_config";

const PatchSchema = z
  .object({
    provider: z.enum(["outlook", "imap"]).optional(),
    enabled: z.boolean().optional(),
    imapHost: z.string().optional(),
    imapPort: z.number().int().min(1).max(65535).optional(),
    imapSecure: z.boolean().optional(),
    imapUser: z.string().optional(),
    imapPassword: z.string().optional(),
    imapFolder: z.string().optional()
  })
  .strict();

type InboxProvider = "outlook" | "imap";

interface InboxConfigDoc {
  workspaceId: string;
  provider: InboxProvider;
  enabled: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPasswordEnc?: string;
  imapFolder?: string;
  updatedAt: string;
}

export interface ZeusEmailInboxConfigPublic {
  provider: InboxProvider;
  enabled: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  imapPasswordMasked: string | null;
  imapFolder: string | null;
}

export interface ZeusInboxSyncResult {
  provider: InboxProvider;
  scanned: number;
  imported: number;
  skippedDuplicates: number;
  replied: number;
}

function mapPublic(doc: InboxConfigDoc | null): ZeusEmailInboxConfigPublic {
  if (!doc) {
    return {
      provider: "outlook",
      enabled: false,
      imapHost: null,
      imapPort: 993,
      imapSecure: true,
      imapUser: null,
      imapPasswordMasked: null,
      imapFolder: "INBOX"
    };
  }
  return {
    provider: doc.provider,
    enabled: doc.enabled !== false,
    imapHost: doc.imapHost ?? null,
    imapPort: doc.imapPort ?? 993,
    imapSecure: doc.imapSecure !== false,
    imapUser: doc.imapUser ?? null,
    imapPasswordMasked: doc.imapPasswordEnc ? "********" : null,
    imapFolder: doc.imapFolder ?? "INBOX"
  };
}

export async function getZeusEmailInboxConfig(workspaceId: string): Promise<ZeusEmailInboxConfigPublic> {
  const db = getDb();
  const doc = (await db.collection(COLLECTION).findOne({ workspaceId })) as InboxConfigDoc | null;
  return mapPublic(doc);
}

export async function patchZeusEmailInboxConfig(
  workspaceId: string,
  raw: unknown
): Promise<ZeusEmailInboxConfigPublic> {
  const body = PatchSchema.safeParse(raw);
  if (!body.success) throw new HttpError("Validazione configurazione inbox non valida", 400);
  const db = getDb();
  const current = (await db.collection(COLLECTION).findOne({ workspaceId })) as InboxConfigDoc | null;
  const nowIso = new Date().toISOString();
  const setDoc: Partial<InboxConfigDoc> = {
    workspaceId,
    updatedAt: nowIso
  };

  if (!current) {
    setDoc.provider = "outlook";
    setDoc.enabled = false;
    setDoc.imapPort = 993;
    setDoc.imapSecure = true;
    setDoc.imapFolder = "INBOX";
  }
  if (body.data.provider !== undefined) setDoc.provider = body.data.provider;
  if (body.data.enabled !== undefined) setDoc.enabled = body.data.enabled;
  if (body.data.imapHost !== undefined) setDoc.imapHost = body.data.imapHost.trim();
  if (body.data.imapPort !== undefined) setDoc.imapPort = body.data.imapPort;
  if (body.data.imapSecure !== undefined) setDoc.imapSecure = body.data.imapSecure;
  if (body.data.imapUser !== undefined) setDoc.imapUser = body.data.imapUser.trim();
  if (body.data.imapFolder !== undefined) setDoc.imapFolder = body.data.imapFolder.trim() || "INBOX";
  if (body.data.imapPassword !== undefined) {
    const plain = body.data.imapPassword.trim();
    setDoc.imapPasswordEnc = plain ? encryptUtf8(plain) : "";
  }

  await db.collection(COLLECTION).updateOne({ workspaceId }, { $set: setDoc }, { upsert: true });
  return getZeusEmailInboxConfig(workspaceId);
}

function normalizeReplyTo(rawFrom: string): string {
  const trimmed = rawFrom.trim();
  return trimmed.match(/<([^>]+)>/)?.[1]?.trim() || trimmed.replace(/.*</, "").replace(">", "").trim();
}

function sourceToText(raw: string): string {
  const body = raw.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim();
  return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchImapInboxMessages(doc: InboxConfigDoc, limit: number): Promise<Array<{
  id: string;
  from: string;
  subject: string;
  text: string;
}>> {
  const enc = doc.imapPasswordEnc ?? "";
  if (!doc.imapHost || !doc.imapUser || !enc) {
    throw new HttpError("Configurazione IMAP incompleta", 400);
  }
  const password = decryptUtf8(enc);
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: doc.imapHost,
    port: doc.imapPort ?? 993,
    secure: doc.imapSecure !== false,
    auth: { user: doc.imapUser, pass: password }
  });
  const out: Array<{ id: string; from: string; subject: string; text: string }> = [];
  try {
    await client.connect();
    const mailboxName = doc.imapFolder?.trim() || "INBOX";
    const lock = await client.getMailboxLock(mailboxName);
    try {
      const unseen = await client.search({ seen: false });
      const unseenList = Array.isArray(unseen) ? unseen : [];
      const selected = unseenList.slice(Math.max(0, unseenList.length - limit)).reverse();
      for (const uid of selected) {
        for await (const msg of client.fetch(String(uid), { envelope: true, source: true })) {
          const from = msg.envelope?.from?.[0]?.address ?? "";
          const subject = msg.envelope?.subject ?? "";
          const source = msg.source ? sourceToText(msg.source.toString("utf8")) : "";
          out.push({
            id: String(uid),
            from,
            subject,
            text: source.slice(0, 8000)
          });
          await client.messageFlagsAdd(String(uid), ["\\Seen"]);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return out;
}

async function getConfigDoc(workspaceId: string): Promise<InboxConfigDoc | null> {
  const db = getDb();
  return (await db.collection(COLLECTION).findOne({ workspaceId })) as InboxConfigDoc | null;
}

export async function syncZeusEmailFromInbox(params: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<ZeusInboxSyncResult> {
  const { workspaceId, userId } = params;
  const limit = Math.min(20, Math.max(1, params.limit ?? 10));
  const cfg = await getConfigDoc(workspaceId);
  if (!cfg || cfg.enabled === false) {
    throw new HttpError("Inbox email ZEUS non configurata o disabilitata", 400);
  }
  const provider: InboxProvider = cfg.provider ?? "outlook";
  const messages =
    provider === "outlook"
      ? await getInboxMessages(userId, workspaceId, limit).then((rows) =>
          rows.map((r) => ({ id: r.id, from: r.from, subject: r.subject, text: r.text }))
        )
      : await fetchImapInboxMessages(cfg, limit);

  let imported = 0;
  let skippedDuplicates = 0;
  let replied = 0;
  for (const m of messages) {
    const ext = `${provider}:${m.id}`;
    if (await hasZeusTurnExternalId(workspaceId, "email", ext)) {
      skippedDuplicates += 1;
      continue;
    }
    imported += 1;
    await insertZeusTurn({
      workspaceId,
      channel: "email",
      direction: "in",
      text: `${m.subject}\n${m.text}`.slice(0, 32000),
      externalId: ext
    });
    let reply = "Grazie per il messaggio. Un consulente risponderà al più presto.";
    try {
      reply = await runZeusTurn({
        workspaceId,
        channel: "email",
        userText: `Email da ${m.from}\nOggetto: ${m.subject}\n\n${m.text}`
      });
    } catch (err) {
      logger.error({ err, workspaceId, provider }, "[zeus] inbox email LLM failed");
    }
    await insertZeusTurn({
      workspaceId,
      channel: "email",
      direction: "out",
      text: reply,
      externalId: ext
    });
    const replyTo = normalizeReplyTo(m.from);
    if (replyTo && replyTo.includes("@")) {
      try {
        await sendZeusReplyEmail(replyTo, `Re: ${m.subject || "Messaggio"}`.slice(0, 200), reply);
        replied += 1;
      } catch (err) {
        logger.error({ err, workspaceId, provider }, "[zeus] inbox email outbound failed");
      }
    }
  }

  return {
    provider,
    scanned: messages.length,
    imported,
    skippedDuplicates,
    replied
  };
}
