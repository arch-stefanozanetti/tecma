/**
 * Template email transazionali da DB (tz_email_flows). Solo admin in scrittura via API.
 */
import { getDb } from "../../config/db.js";
import { assertOnlyAllowedPlaceholders, composeLayoutToHtml } from "./emailLayout.compose.js";
import type { EmailLayoutV1 } from "./emailLayout.schema.js";
import { logger } from "../../observability/logger.js";

import {
  EMAIL_FLOW_KEYS,
  EMAIL_FLOW_METADATA,
  type EmailFlowKey,
  type EmailFlowMeta
} from "./emailFlows.meta.js";

export { EMAIL_FLOW_KEYS, EMAIL_FLOW_METADATA, type EmailFlowKey, type EmailFlowMeta };

const COLLECTION = "tz_email_flows";

export type EmailFlowDoc = {
  flowKey: EmailFlowKey;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  editorMode?: "html" | "blocks";
  layout?: EmailLayoutV1;
  updatedAt?: Date;
  updatedBy?: string;
};

export type EmailFlowListItem = EmailFlowMeta & {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  hasCustomTemplate: boolean;
  editorMode: "html" | "blocks";
  layout: EmailLayoutV1 | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function coll() {
  return getDb().collection<EmailFlowDoc>(COLLECTION);
}

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v !== undefined && v !== null ? v : `{{${key}}}`;
  });
}

/** true se dopo il replace restano {{...}} non risolti */
function hasUnresolvedPlaceholders(s: string): boolean {
  return /\{\{\w+\}\}/.test(s);
}

/**
 * Se il flusso è abilitato in DB e il template è valido, ritorna subject+html renderizzati.
 * Altrimenti null (il chiamante usa il default da codice).
 */
export async function resolveCustomEmail(
  flowKey: EmailFlowKey,
  vars: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  try {
    const doc = await coll().findOne({ flowKey });
    if (!doc || !doc.enabled) return null;
    const subject = (doc.subject || "").trim();
    const bodyHtml = (doc.bodyHtml || "").trim();
    if (!subject || !bodyHtml) return null;

    const subj = applyPlaceholders(subject, vars);
    const html = applyPlaceholders(bodyHtml, vars);
    if (hasUnresolvedPlaceholders(subj) || hasUnresolvedPlaceholders(html)) {
      logger.warn({ flowKey }, "[email-flows] unresolved placeholders, using default template");
      return null;
    }
    return { subject: subj, html };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not initialized")) return null;
    logger.warn({ err: e }, "[email-flows] read failed, using default template");
    return null;
  }
}

export async function listEmailFlows(): Promise<EmailFlowListItem[]> {
  const out: EmailFlowListItem[] = [];
  for (const flowKey of EMAIL_FLOW_KEYS) {
    const meta = EMAIL_FLOW_METADATA[flowKey];
    const doc = await coll().findOne({ flowKey });
    const hasCustom = Boolean(doc?.bodyHtml?.trim() && doc?.subject?.trim());
    out.push({
      flowKey,
      ...meta,
      enabled: Boolean(doc?.enabled),
      subject: doc?.subject?.trim() || defaultSubject(flowKey),
      bodyHtml: doc?.bodyHtml?.trim() || "",
      hasCustomTemplate: hasCustom,
      editorMode: doc?.editorMode === "blocks" ? "blocks" : "html",
      layout: doc?.layout && doc.editorMode === "blocks" ? doc.layout : null,
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      updatedBy: doc?.updatedBy ?? null
    });
  }
  return out;
}

export async function getEmailFlow(flowKey: EmailFlowKey): Promise<EmailFlowListItem | null> {
  if (!EMAIL_FLOW_KEYS.includes(flowKey)) return null;
  const meta = EMAIL_FLOW_METADATA[flowKey];
  const doc = await coll().findOne({ flowKey });
  const hasCustom = Boolean(doc?.bodyHtml?.trim() && doc?.subject?.trim());
  return {
    flowKey,
    ...meta,
    enabled: Boolean(doc?.enabled),
    subject: doc?.subject?.trim() || defaultSubject(flowKey),
    bodyHtml: doc?.bodyHtml?.trim() || "",
    hasCustomTemplate: hasCustom,
    editorMode: doc?.editorMode === "blocks" ? "blocks" : "html",
    layout: doc?.layout && doc.editorMode === "blocks" ? doc.layout : null,
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    updatedBy: doc?.updatedBy ?? null
  };
}

function defaultSubject(flowKey: EmailFlowKey): string {
  switch (flowKey) {
    case "user_invite":
      return "Invito Followup — {{projectName}}";
    case "password_reset":
      return "Reimposta password Followup";
    case "email_verification":
      return "Verifica email Followup";
    default:
      return "Followup";
  }
}

function subjectPlaceholdersOk(flowKey: EmailFlowKey, subject: string): void {
  const allowed = new Set(EMAIL_FLOW_METADATA[flowKey].placeholders);
  const r = assertOnlyAllowedPlaceholders(subject, allowed);
  if (!r.ok) {
    throw new Error(`Placeholder non ammessi nell'oggetto: ${r.unknown.join(", ")}`);
  }
}

export type UpsertEmailFlowPayload =
  | { editorMode: "html"; enabled: boolean; subject: string; bodyHtml: string }
  | { editorMode: "blocks"; enabled: boolean; subject: string; layout: EmailLayoutV1 };

export async function upsertEmailFlow(
  flowKey: EmailFlowKey,
  payload: UpsertEmailFlowPayload,
  updatedBy: string
): Promise<EmailFlowListItem> {
  const now = new Date();
  subjectPlaceholdersOk(flowKey, payload.subject);

  let bodyHtml: string;
  let layout: EmailLayoutV1 | undefined;
  let editorMode: "html" | "blocks";

  if (payload.editorMode === "blocks") {
    editorMode = "blocks";
    layout = payload.layout;
    try {
      bodyHtml = composeLayoutToHtml(flowKey, layout);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg);
    }
  } else {
    editorMode = "html";
    layout = undefined;
    bodyHtml = payload.bodyHtml.trim();
  }

  if (payload.enabled && (!payload.subject.trim() || !bodyHtml.trim())) {
    throw new Error("Con template attivo servono oggetto e corpo non vuoti");
  }

  const $set: Record<string, unknown> = {
    flowKey,
    enabled: payload.enabled,
    subject: payload.subject.trim(),
    bodyHtml: bodyHtml.trim(),
    editorMode,
    updatedAt: now,
    updatedBy
  };
  if (editorMode === "blocks" && layout) {
    $set.layout = layout;
  } else {
    $set.layout = null;
  }

  await coll().updateOne({ flowKey }, { $set }, { upsert: true });
  const item = await getEmailFlow(flowKey);
  if (!item) throw new Error("upsert failed");
  return item;
}

export function previewEmailFlow(
  flowKey: EmailFlowKey,
  subject: string,
  bodyHtml: string,
  sampleVars: Record<string, string>
): { subject: string; html: string } {
  const vars = { ...sampleVars };
  const meta = EMAIL_FLOW_METADATA[flowKey];
  for (const p of meta.placeholders) {
    if (vars[p] === undefined) {
      vars[p] = `[${p}]`;
    }
  }
  return {
    subject: applyPlaceholders(subject, vars),
    html: applyPlaceholders(bodyHtml, vars)
  };
}

export function previewEmailFlowFromLayout(
  flowKey: EmailFlowKey,
  subject: string,
  layout: EmailLayoutV1,
  sampleVars: Record<string, string>
): { subject: string; html: string } {
  const html = composeLayoutToHtml(flowKey, layout);
  return previewEmailFlow(flowKey, subject, html, sampleVars);
}
