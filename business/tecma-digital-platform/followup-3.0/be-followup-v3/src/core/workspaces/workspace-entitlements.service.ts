/**
 * Fase 0.2 — Entitlement commerciale per workspace (tz_workspace_entitlements).
 * Regola: canUseFeature = isEntitled(workspace, feature) AND hasPermission(user, action).
 * Assenza di riga DB per (workspaceId, feature) ⇒ considerato attivo (compatibilità deploy esistenti).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

export const WORKSPACE_ENTITLEMENT_FEATURES = ["publicApi", "twilio", "mailchimp", "activecampaign"] as const;
export type WorkspaceEntitlementFeature = (typeof WORKSPACE_ENTITLEMENT_FEATURES)[number];

const STATUSES = ["inactive", "pending_approval", "active", "suspended"] as const;
export type EntitlementStatus = (typeof STATUSES)[number];

const COLLECTION = "tz_workspace_entitlements";

export interface WorkspaceEntitlementRow {
  _id: string;
  workspaceId: string;
  feature: WorkspaceEntitlementFeature;
  status: EntitlementStatus;
  billingMode: "manual_invoice";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveEntitlementItem {
  feature: WorkspaceEntitlementFeature;
  /** true se l’uso della capability è consentito (implicito attivo o riga active). */
  entitled: boolean;
  /** Stato persistito; null se nessuna riga. */
  recordedStatus: EntitlementStatus | null;
  implicit: boolean;
}

function toRow(doc: Record<string, unknown>): WorkspaceEntitlementRow {
  const _id = doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "");
  return {
    _id,
    workspaceId: String(doc.workspaceId ?? ""),
    feature: doc.feature as WorkspaceEntitlementFeature,
    status: doc.status as EntitlementStatus,
    billingMode: "manual_invoice",
    notes: typeof doc.notes === "string" ? doc.notes : "",
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : "",
  };
}

export function parseWorkspaceEntitlementFeature(raw: string): WorkspaceEntitlementFeature | null {
  const f = raw.trim();
  return (WORKSPACE_ENTITLEMENT_FEATURES as readonly string[]).includes(f) ? (f as WorkspaceEntitlementFeature) : null;
}

export async function listWorkspaceEntitlements(workspaceId: string): Promise<WorkspaceEntitlementRow[]> {
  if (!workspaceId.trim()) return [];
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ workspaceId }).toArray();
  return docs.map((d) => toRow(d as Record<string, unknown>));
}

/** Presenza riga + status === active ⇒ entitled; nessuna riga ⇒ entitled (grandfathered). */
export async function isWorkspaceEntitledToFeature(
  workspaceId: string,
  feature: WorkspaceEntitlementFeature
): Promise<boolean> {
  if (!workspaceId.trim()) return false;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, feature });
  if (!doc) return true;
  return (doc as { status?: string }).status === "active";
}

export async function listEffectiveWorkspaceEntitlements(workspaceId: string): Promise<EffectiveEntitlementItem[]> {
  const rows = await listWorkspaceEntitlements(workspaceId);
  const byFeature = new Map(rows.map((r) => [r.feature, r]));
  return WORKSPACE_ENTITLEMENT_FEATURES.map((feature) => {
    const row = byFeature.get(feature);
    if (!row) {
      return { feature, entitled: true, recordedStatus: null, implicit: true };
    }
    const entitled = row.status === "active";
    return { feature, entitled, recordedStatus: row.status, implicit: false };
  });
}

const UpsertSchema = z.object({
  status: z.enum(STATUSES),
  notes: z.string().max(4000).optional().default(""),
  billingMode: z.literal("manual_invoice").default("manual_invoice"),
});

export async function upsertWorkspaceEntitlement(
  workspaceId: string,
  feature: WorkspaceEntitlementFeature,
  raw: unknown
): Promise<WorkspaceEntitlementRow> {
  const input = UpsertSchema.parse(raw ?? {});
  const db = getDb();
  const now = new Date().toISOString();
  const newId = new ObjectId();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, feature },
    {
      $set: {
        workspaceId,
        feature,
        status: input.status,
        billingMode: input.billingMode,
        notes: input.notes,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: newId,
        createdAt: now,
      },
    },
    { upsert: true }
  );
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, feature });
  if (!doc) throw new Error("workspace entitlement upsert failed");
  return toRow(doc as Record<string, unknown>);
}
