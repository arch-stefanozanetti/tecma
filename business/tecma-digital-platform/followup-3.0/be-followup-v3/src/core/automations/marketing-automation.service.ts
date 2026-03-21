import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";
import { deliverWebhook } from "./webhook-delivery.service.js";
import { sendGenericEmail } from "../email/email.service.js";
import { resolveMarketingContactFromPayload } from "./marketing-contact-from-payload.service.js";
import {
  upsertActiveCampaignContact,
  upsertMailchimpListMember,
} from "./marketing-external-lists.service.js";

const WORKFLOWS_COLLECTION = "tz_marketing_workflows";
const ENROLLMENTS_COLLECTION = "tz_marketing_enrollments";
const EXECUTIONS_COLLECTION = "tz_marketing_step_executions";

const nowIso = (): string => new Date().toISOString();

const MarketingStepSchema = z
  .object({
    order: z.number().int().min(1),
    delayMinutes: z.number().int().min(0).default(0),
    channel: z.enum(["email", "webhook", "mailchimp", "activecampaign"]),
    templateSubject: z.string().optional(),
    templateBody: z.string().optional(),
    webhookUrl: z.string().url().optional(),
    /** Audience / List ID Mailchimp (Marketing API). */
    mailchimpListId: z.string().optional(),
    mailchimpStatus: z.enum(["subscribed", "pending"]).optional(),
    /** List ID ActiveCampaign (opzionale: solo sync contatto se assente). */
    activecampaignListId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.channel === "email") {
      if (!val.templateBody?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "templateBody obbligatorio per channel email",
          path: ["templateBody"],
        });
      }
    }
    if (val.channel === "webhook") {
      if (!val.webhookUrl) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "webhookUrl obbligatorio", path: ["webhookUrl"] });
      }
      if (!val.templateBody?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "templateBody obbligatorio (corpo payload webhook)",
          path: ["templateBody"],
        });
      }
    }
    if (val.channel === "mailchimp" && !val.mailchimpListId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mailchimpListId obbligatorio (ID audience Mailchimp)",
        path: ["mailchimpListId"],
      });
    }
  });

const WorkflowSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  triggerEventType: z.string().min(1),
  steps: z.array(MarketingStepSchema).min(1),
});

const interpolate = (template: string, payload: Record<string, unknown>): string =>
  template.replace(/\{\{([\w.]+)\}\}/g, (_all, key: string) => {
    const value = payload[key];
    return value == null ? "" : String(value);
  });

async function isMarketingCommercialEntitled(workspaceId: string): Promise<boolean> {
  const [m, a] = await Promise.all([
    isWorkspaceEntitledToFeature(workspaceId, "mailchimp"),
    isWorkspaceEntitledToFeature(workspaceId, "activecampaign"),
  ]);
  return m || a;
}

async function assertMarketingCommercialEntitled(workspaceId: string): Promise<void> {
  if (!(await isMarketingCommercialEntitled(workspaceId))) {
    throw new HttpError(
      "Automazioni marketing non abilitate: serve almeno un modulo Mailchimp o ActiveCampaign attivo sul workspace. Contatta Tecma.",
      403,
    );
  }
}

export const createMarketingWorkflow = async (rawInput: unknown): Promise<Record<string, unknown>> => {
  const input = WorkflowSchema.parse(rawInput);
  await assertMarketingCommercialEntitled(input.workspaceId);
  const db = getDb();
  const createdAt = nowIso();
  const result = await db.collection(WORKFLOWS_COLLECTION).insertOne({
    ...input,
    createdAt,
    updatedAt: createdAt,
  });
  return {
    _id: result.insertedId.toHexString(),
    ...input,
    createdAt,
    updatedAt: createdAt,
  };
};

export const listMarketingWorkflows = async (workspaceId: string): Promise<{ data: Record<string, unknown>[] }> => {
  const db = getDb();
  const docs = await db.collection(WORKFLOWS_COLLECTION).find({ workspaceId }).sort({ updatedAt: -1 }).toArray();
  return {
    data: docs.map((doc) => ({
      _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
      workspaceId: String(doc.workspaceId ?? ""),
      name: String(doc.name ?? ""),
      enabled: doc.enabled !== false,
      triggerEventType: String(doc.triggerEventType ?? ""),
      steps: Array.isArray(doc.steps) ? doc.steps : [],
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : nowIso(),
      updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : nowIso(),
    })),
  };
};

export const enqueueMarketingEvent = async (
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<number> => {
  if (!(await isMarketingCommercialEntitled(workspaceId))) return 0;
  const db = getDb();
  const workflows = await db.collection(WORKFLOWS_COLLECTION).find({ workspaceId, enabled: true, triggerEventType: eventType }).toArray();
  if (workflows.length === 0) return 0;
  const createdAt = nowIso();
  const docs = workflows.map((workflow) => ({
    workspaceId,
    workflowId: workflow._id,
    triggerEventType: eventType,
    payload,
    stepCursor: 0,
    nextRunAt: createdAt,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  }));
  if (docs.length > 0) await db.collection(ENROLLMENTS_COLLECTION).insertMany(docs);
  return docs.length;
};

const runStep = async (workflow: Record<string, unknown>, step: Record<string, unknown>, payload: Record<string, unknown>): Promise<void> => {
  const channel = String(step.channel ?? "");
  const wsId = String(workflow.workspaceId ?? "");
  if (channel === "email") {
    const to = typeof payload.clientEmail === "string" ? payload.clientEmail : "";
    if (!to) return;
    await sendGenericEmail({
      to,
      subject: interpolate(String(step.templateSubject ?? "Aggiornamento Followup"), payload),
      text: interpolate(String(step.templateBody ?? ""), payload),
    });
    return;
  }
  if (channel === "webhook") {
    const webhookUrl = typeof step.webhookUrl === "string" ? step.webhookUrl : "";
    if (!webhookUrl) return;
    await deliverWebhook(
      {
        _id: "marketing-step",
        workspaceId: wsId,
        connectorId: "marketing",
        url: webhookUrl,
        secret: undefined,
        events: [String(workflow.triggerEventType ?? "request.created")] as unknown as Array<
          | "request.created"
          | "request.status_changed"
          | "client.created"
          | "visit.scheduled"
          | "visit.updated"
          | "visit.completed"
          | "proposal.sent"
          | "contract.signed"
        >,
        enabled: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      String(workflow.triggerEventType ?? "marketing.step"),
      payload,
    );
    return;
  }
  if (channel === "mailchimp") {
    if (!(await isWorkspaceEntitledToFeature(wsId, "mailchimp"))) {
      logger.warn({ wsId }, "[marketing-automation] skip mailchimp step: modulo non abilitato");
      return;
    }
    const listId = String(step.mailchimpListId ?? "").trim();
    if (!listId) return;
    const contact = await resolveMarketingContactFromPayload(wsId, payload);
    if (!contact) {
      logger.info({ wsId, entityId: payload.entityId }, "[marketing-automation] skip mailchimp: nessun email risolvibile");
      return;
    }
    const st = step.mailchimpStatus === "pending" ? "pending" : "subscribed";
    await upsertMailchimpListMember(wsId, listId, contact, st);
    return;
  }
  if (channel === "activecampaign") {
    if (!(await isWorkspaceEntitledToFeature(wsId, "activecampaign"))) {
      logger.warn({ wsId }, "[marketing-automation] skip activecampaign step: modulo non abilitato");
      return;
    }
    const contact = await resolveMarketingContactFromPayload(wsId, payload);
    if (!contact) {
      logger.info({ wsId, entityId: payload.entityId }, "[marketing-automation] skip AC: nessun email risolvibile");
      return;
    }
    const listOpt = String(step.activecampaignListId ?? "").trim() || undefined;
    await upsertActiveCampaignContact(wsId, contact, listOpt);
  }
};

export const runDueMarketingAutomations = async (): Promise<{ processed: number; failed: number }> => {
  const db = getDb();
  const now = nowIso();
  const due = await db
    .collection(ENROLLMENTS_COLLECTION)
    .find({ status: "pending", nextRunAt: { $lte: now } })
    .sort({ nextRunAt: 1 })
    .limit(100)
    .toArray();

  let failed = 0;
  for (const enrollment of due) {
    try {
      const wsId = String(enrollment.workspaceId ?? "");
      if (!(await isMarketingCommercialEntitled(wsId))) {
        await db.collection(ENROLLMENTS_COLLECTION).updateOne(
          { _id: enrollment._id },
          { $set: { status: "cancelled", updatedAt: nowIso() } },
        );
        continue;
      }
      const workflow = await db.collection(WORKFLOWS_COLLECTION).findOne({ _id: enrollment.workflowId, enabled: true });
      if (!workflow) {
        await db.collection(ENROLLMENTS_COLLECTION).updateOne(
          { _id: enrollment._id },
          { $set: { status: "cancelled", updatedAt: nowIso() } },
        );
        continue;
      }
      const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
      const stepCursor = typeof enrollment.stepCursor === "number" ? enrollment.stepCursor : 0;
      const step = steps[stepCursor] as Record<string, unknown> | undefined;
      if (!step) {
        await db.collection(ENROLLMENTS_COLLECTION).updateOne(
          { _id: enrollment._id },
          { $set: { status: "completed", updatedAt: nowIso() } },
        );
        continue;
      }

      const executionKey = `${String(enrollment._id)}:${stepCursor}`;
      const executionInsert = await db.collection(EXECUTIONS_COLLECTION).updateOne(
        { executionKey },
        {
          $setOnInsert: {
            executionKey,
            workspaceId: enrollment.workspaceId,
            enrollmentId: enrollment._id,
            workflowId: enrollment.workflowId,
            stepCursor,
            createdAt: nowIso(),
          },
        },
        { upsert: true },
      );
      if (executionInsert.upsertedCount === 0) {
        continue;
      }

      const payload = (enrollment.payload as Record<string, unknown>) ?? {};
      await runStep(workflow as Record<string, unknown>, step, payload);

      const delayMinutes = Math.max(0, Number(step.delayMinutes ?? 0));
      const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
      const hasNext = stepCursor + 1 < steps.length;
      await db.collection(ENROLLMENTS_COLLECTION).updateOne(
        { _id: enrollment._id },
        {
          $set: {
            stepCursor: stepCursor + 1,
            nextRunAt,
            status: hasNext ? "pending" : "completed",
            updatedAt: nowIso(),
            completedAt: hasNext ? null : nowIso(),
          },
        },
      );
    } catch (err) {
      failed += 1;
      logger.error({ err, enrollmentId: String(enrollment._id ?? "") }, "[marketing-automation] run due enrollment failed");
      await db.collection(ENROLLMENTS_COLLECTION).updateOne(
        { _id: enrollment._id },
        { $set: { status: "failed", updatedAt: nowIso(), failedAt: nowIso() } },
      );
    }
  }
  return { processed: due.length, failed };
};
