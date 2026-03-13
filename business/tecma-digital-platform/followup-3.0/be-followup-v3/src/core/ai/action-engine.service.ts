import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { emitDomainEvent } from "../events/event-log.service.js";
import { ListQuerySchema, buildPagination } from "../shared/list-query.js";

const ActionTypeSchema = z.enum(["create_task", "send_reminder"]);

const CreateDraftSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  suggestionId: z.string().min(1),
  actionType: ActionTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  target: z.object({
    clientId: z.string().optional(),
    apartmentId: z.string().optional()
  }),
  dueAt: z.string().optional()
});

const DecideDraftSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  actorEmail: z.string().email(),
  note: z.string().optional().default("")
});

const toObjectId = (value: string) => {
  if (!ObjectId.isValid(value)) {
    const error = new Error(`Invalid ObjectId: ${value}`);
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  return new ObjectId(value);
};

export const createAiActionDraft = async (rawInput: unknown) => {
  const input = CreateDraftSchema.parse(rawInput);
  const now = new Date().toISOString();
  const db = getDb();

  const doc = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    suggestionId: input.suggestionId,
    actionType: input.actionType,
    title: input.title,
    message: input.message,
    target: input.target,
    dueAt: input.dueAt ?? null,
    status: "pending_approval" as const,
    createdAt: now,
    updatedAt: now
  };
  const inserted = await db.collection("tz_ai_action_drafts").insertOne(doc);

  await emitDomainEvent({
    type: "ai.action_draft.created",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: inserted.insertedId.toHexString(),
    payload: {
      suggestionId: input.suggestionId,
      actionType: input.actionType,
      title: input.title
    }
  });

  return { id: inserted.insertedId.toHexString(), draft: { ...doc, _id: inserted.insertedId.toHexString() } };
};

export const queryAiActionDrafts = async (rawInput: unknown) => {
  const input = ListQuerySchema.parse(rawInput);
  const { skip, limit } = buildPagination(input.page, input.perPage);
  const db = getDb();

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds }
  };
  if (input.searchText?.trim()) {
    const text = input.searchText.trim();
    match.$or = [
      { title: { $regex: text, $options: "i" } },
      { message: { $regex: text, $options: "i" } },
      { actionType: { $regex: text, $options: "i" } },
      { status: { $regex: text, $options: "i" } }
    ];
  }

  const [data, total] = await Promise.all([
    db.collection("tz_ai_action_drafts").find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("tz_ai_action_drafts").countDocuments(match)
  ]);

  return {
    data: data.map((row) => ({
      ...row,
      _id: row._id instanceof ObjectId ? row._id.toHexString() : String(row._id ?? "")
    })),
    pagination: {
      page: input.page,
      perPage: input.perPage,
      total,
      totalPages: Math.ceil(total / input.perPage)
    }
  };
};

export const decideAiActionDraft = async (rawDraftId: unknown, rawInput: unknown) => {
  const draftId = toObjectId(z.string().parse(rawDraftId));
  const input = DecideDraftSchema.parse(rawInput);
  const now = new Date().toISOString();
  const db = getDb();

  const existing = await db.collection("tz_ai_action_drafts").findOne({ _id: draftId });
  if (!existing) {
    const error = new Error("AI action draft not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const nextStatus = input.decision === "approved" ? "approved" : "rejected";
  await db.collection("tz_ai_action_drafts").updateOne(
    { _id: draftId },
    {
      $set: {
        status: nextStatus,
        decidedBy: input.actorEmail,
        decisionNote: input.note,
        decidedAt: now,
        updatedAt: now
      }
    }
  );

  let executionResult: Record<string, unknown> = { status: nextStatus };

  if (input.decision === "approved") {
    if (existing.actionType === "create_task") {
      const taskDoc = {
        workspaceId: existing.workspaceId,
        projectId: existing.projectId,
        title: existing.title,
        description: existing.message,
        target: existing.target ?? {},
        source: "ai_action_draft",
        sourceDraftId: draftId.toHexString(),
        status: "open",
        dueAt: existing.dueAt ?? null,
        createdAt: now,
        updatedAt: now
      };
      const insertedTask = await db.collection("tz_tasks").insertOne(taskDoc);
      executionResult = { taskId: insertedTask.insertedId.toHexString() };
    } else if (existing.actionType === "send_reminder") {
      const reminderDoc = {
        workspaceId: existing.workspaceId,
        projectId: existing.projectId,
        title: existing.title,
        body: existing.message,
        target: existing.target ?? {},
        source: "ai_action_draft",
        sourceDraftId: draftId.toHexString(),
        status: "queued",
        createdAt: now
      };
      const insertedReminder = await db.collection("tz_reminders_queue").insertOne(reminderDoc);
      executionResult = { reminderId: insertedReminder.insertedId.toHexString() };
    }
  }

  await emitDomainEvent({
    type: "ai.action_draft.decided",
    workspaceId: String(existing.workspaceId ?? ""),
    projectId: String(existing.projectId ?? ""),
    entityId: draftId.toHexString(),
    payload: {
      decision: input.decision,
      actorEmail: input.actorEmail,
      result: executionResult
    }
  });

  return { draftId: draftId.toHexString(), decision: input.decision, executionResult };
};

