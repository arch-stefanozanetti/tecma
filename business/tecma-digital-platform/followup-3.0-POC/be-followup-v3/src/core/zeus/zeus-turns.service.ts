import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { escapeRegex } from "../../utils/escapeRegex.js";
import type { VoiceIngressProviderId } from "./zeus-voice-ingress.types.js";

const COLLECTION = "tz_zeus_turns";
const MAX_TEXT_LEN = 32_000;

export type ZeusChannel = "voice" | "email" | "whatsapp" | "chat";

function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export async function insertZeusTurn(input: {
  workspaceId: string;
  channel: ZeusChannel;
  direction: "in" | "out";
  /** Testo completo messaggio (troncato a 32k in persistenza). */
  text: string;
  externalId?: string;
  /** Track A vs B: solo voce tipicamente; opzionale per analisi e migrazione. */
  ingressProvider?: VoiceIngressProviderId;
}): Promise<void> {
  const db = getDb();
  const full = input.text.slice(0, MAX_TEXT_LEN);
  const doc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    channel: input.channel,
    direction: input.direction,
    content: full,
    rawPreview: full.slice(0, 500),
    charCount: full.length,
    wordCount: wordCount(full),
    externalId: input.externalId ?? null,
    createdAt: new Date().toISOString()
  };
  if (input.ingressProvider) doc.ingressProvider = input.ingressProvider;
  try {
    await db.collection(COLLECTION).insertOne(doc);
  } catch (err) {
    logger.warn({ err }, "[zeus] insert turn failed");
  }
}

export async function hasZeusTurnExternalId(
  workspaceId: string,
  channel: ZeusChannel,
  externalId: string
): Promise<boolean> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne(
    { workspaceId, channel, externalId },
    { projection: { _id: 1 } }
  );
  return !!doc;
}

function turnText(doc: Record<string, unknown>): string {
  if (typeof doc.content === "string" && doc.content.length > 0) return doc.content;
  return String(doc.rawPreview ?? "");
}

export type ZeusTurnRow = {
  id: string;
  channel: ZeusChannel;
  direction: "in" | "out";
  text: string;
  externalId: string | null;
  createdAt: string;
  charCount: number;
  wordCount: number;
};

function mapDoc(r: Record<string, unknown>): ZeusTurnRow {
  const text = turnText(r);
  const cc = typeof r.charCount === "number" ? r.charCount : text.length;
  const wc = typeof r.wordCount === "number" ? r.wordCount : wordCount(text);
  const _id = r._id instanceof ObjectId ? r._id.toHexString() : String(r._id ?? "");
  return {
    id: _id,
    channel: r.channel as ZeusChannel,
    direction: r.direction as "in" | "out",
    text,
    externalId: r.externalId != null ? String(r.externalId) : null,
    createdAt: String(r.createdAt ?? ""),
    charCount: cc,
    wordCount: wc
  };
}

/** @deprecated Usare searchZeusTurns */
export async function listZeusTurns(workspaceId: string, limit = 50): Promise<ZeusTurnRow[]> {
  const { data } = await searchZeusTurns(workspaceId, { page: 1, perPage: Math.min(100, limit) });
  return data;
}

export interface ZeusTurnsSearchParams {
  page?: number;
  perPage?: number;
  /** Ricerca testuale su contenuto (case insensitive). */
  q?: string;
  channel?: ZeusChannel | "all";
  direction?: "in" | "out" | "all";
  /** ISO date (inizio giorno UTC) */
  dateFrom?: string;
  /** ISO date (fine giorno UTC) */
  dateTo?: string;
  sortOrder?: 1 | -1;
}

export async function searchZeusTurns(
  workspaceId: string,
  params: ZeusTurnsSearchParams
): Promise<{
  data: ZeusTurnRow[];
  paginationInfo: {
    totalDocs: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage: number | null;
    nextPage: number | null;
  };
}> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 50));
  const skip = (page - 1) * perPage;

  const filter: Record<string, unknown> = { workspaceId };

  if (params.channel && params.channel !== "all") {
    filter.channel = params.channel;
  }
  if (params.direction && params.direction !== "all") {
    filter.direction = params.direction;
  }

  const createdAtRange: Record<string, string> = {};
  if (params.dateFrom?.trim()) {
    const d = new Date(params.dateFrom);
    if (!Number.isNaN(d.getTime())) createdAtRange.$gte = d.toISOString();
  }
  if (params.dateTo?.trim()) {
    const d = new Date(params.dateTo);
    if (!Number.isNaN(d.getTime())) {
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      createdAtRange.$lte = end.toISOString();
    }
  }
  if (Object.keys(createdAtRange).length > 0) {
    filter.createdAt = createdAtRange;
  }

  const q = params.q?.trim();
  if (q) {
    const safe = escapeRegex(q.slice(0, 200));
    filter.$or = [
      { content: { $regex: safe, $options: "i" } },
      { rawPreview: { $regex: safe, $options: "i" } }
    ];
  }

  const db = getDb();
  const coll = db.collection(COLLECTION);
  const sortOrder = params.sortOrder === 1 ? 1 : -1;

  const [totalDocs, rows] = await Promise.all([
    coll.countDocuments(filter),
    coll.find(filter).sort({ createdAt: sortOrder }).skip(skip).limit(perPage).toArray()
  ]);

  const totalPages = Math.max(1, Math.ceil(totalDocs / perPage));
  const data = rows.map((r) => mapDoc(r as Record<string, unknown>));

  return {
    data,
    paginationInfo: {
      totalDocs,
      page,
      perPage,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < totalPages ? page + 1 : null
    }
  };
}

export interface ZeusTurnsStats {
  totalTurns: number;
  byChannel: Partial<Record<ZeusChannel, number>>;
  inbound: { count: number; avgChars: number; avgWords: number };
  outbound: { count: number; avgChars: number; avgWords: number };
  /** Coppie stimata user→assistant (in/out consecutivi, stesso canale, finestra 10 min). */
  estimatedConversationPairs: number;
}

export async function getZeusTurnsStats(
  workspaceId: string,
  opts: { dateFrom?: string; dateTo?: string }
): Promise<ZeusTurnsStats> {
  const db = getDb();
  const match: Record<string, unknown> = { workspaceId };
  const createdAtRange: Record<string, string> = {};
  if (opts.dateFrom?.trim()) {
    const d = new Date(opts.dateFrom);
    if (!Number.isNaN(d.getTime())) createdAtRange.$gte = d.toISOString();
  }
  if (opts.dateTo?.trim()) {
    const d = new Date(opts.dateTo);
    if (!Number.isNaN(d.getTime())) {
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      createdAtRange.$lte = end.toISOString();
    }
  }
  if (Object.keys(createdAtRange).length > 0) {
    match.createdAt = createdAtRange;
  }

  const coll = db.collection(COLLECTION);
  const cursor = coll.find(match).sort({ createdAt: 1 });
  const docs = await cursor.toArray();

  const byChannel: Partial<Record<ZeusChannel, number>> = {};
  let inChars = 0;
  let inWords = 0;
  let inCount = 0;
  let outChars = 0;
  let outWords = 0;
  let outCount = 0;

  for (const raw of docs) {
    const d = raw as Record<string, unknown>;
    const ch = d.channel as ZeusChannel;
    byChannel[ch] = (byChannel[ch] ?? 0) + 1;
    const text = turnText(d);
    const cc = typeof d.charCount === "number" ? d.charCount : text.length;
    const wc = typeof d.wordCount === "number" ? d.wordCount : wordCount(text);
    if (d.direction === "in") {
      inCount += 1;
      inChars += cc;
      inWords += wc;
    } else {
      outCount += 1;
      outChars += cc;
      outWords += wc;
    }
  }

  let pairs = 0;
  const WINDOW_MS = 10 * 60 * 1000;
  for (let i = 0; i < docs.length - 1; i++) {
    const a = docs[i] as Record<string, unknown>;
    const b = docs[i + 1] as Record<string, unknown>;
    if (a.direction !== "in" || b.direction !== "out") continue;
    if (a.channel !== b.channel) continue;
    const ta = new Date(String(a.createdAt ?? 0)).getTime();
    const tb = new Date(String(b.createdAt ?? 0)).getTime();
    if (tb - ta >= 0 && tb - ta <= WINDOW_MS) pairs += 1;
  }

  return {
    totalTurns: docs.length,
    byChannel,
    inbound: {
      count: inCount,
      avgChars: inCount ? Math.round(inChars / inCount) : 0,
      avgWords: inCount ? Math.round((inWords / inCount) * 10) / 10 : 0
    },
    outbound: {
      count: outCount,
      avgChars: outCount ? Math.round(outChars / outCount) : 0,
      avgWords: outCount ? Math.round((outWords / outCount) * 10) / 10 : 0
    },
    estimatedConversationPairs: pairs
  };
}
