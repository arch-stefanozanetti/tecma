/**
 * Versioning documenti legali (privacy policy, ecc.) in tz_legal_documents.
 */
import { createHash } from "node:crypto";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";

const COLLECTION = "tz_legal_documents";

export interface LegalDocumentRow {
  id: string;
  kind: string;
  version: string;
  title: string;
  content: string;
  contentSha256: string;
  effectiveAt: string;
  createdAt: string;
}

function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Seed minimo se collection vuota (test/dev). */
export async function ensureDefaultPrivacyPolicy(): Promise<void> {
  try {
    const coll = getDb().collection(COLLECTION);
    const count = await coll.countDocuments({ kind: "privacy_policy" });
    if (count > 0) return;
    const content = [
      "# Informativa privacy (placeholder)",
      "",
      "Questo testo è un segnaposto generato automaticamente. Sostituire con la privacy policy approvata dal legale.",
      "Versione iniziale per tracciamento consensi utente (GDPR)."
    ].join("\n");
    const version = "1.0.0";
    const now = new Date();
    await coll.insertOne({
      kind: "privacy_policy",
      version,
      title: "Privacy Policy FollowUp",
      content,
      contentSha256: contentHash(content),
      effectiveAt: now,
      createdAt: now
    });
    logger.info({ version }, "[legal] seeded default privacy_policy");
  } catch (err) {
    logger.error({ err }, "[legal] ensureDefaultPrivacyPolicy failed");
  }
}

export async function getCurrentPrivacyPolicy(): Promise<LegalDocumentRow | null> {
  const arr = await getDb()
    .collection(COLLECTION)
    .find({ kind: "privacy_policy" })
    .sort({ effectiveAt: -1 })
    .limit(1)
    .toArray();
  const doc = arr[0];
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  return {
    id: String(d._id ?? ""),
    kind: String(d.kind ?? "privacy_policy"),
    version: String(d.version ?? ""),
    title: String(d.title ?? ""),
    content: String(d.content ?? ""),
    contentSha256: String(d.contentSha256 ?? ""),
    effectiveAt: d.effectiveAt instanceof Date ? d.effectiveAt.toISOString() : String(d.effectiveAt ?? ""),
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? "")
  };
}
