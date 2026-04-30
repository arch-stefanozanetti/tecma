/**
 * Dispatch eventi per regole, webhook e communication rules (invio email/WhatsApp/notifiche).
 */
import { createNotification } from "../notifications/notifications.service.js";
import type { NotificationType } from "../notifications/notifications.service.js";
import { listByWorkspace as listRules } from "./automation-rules.service.js";
import type { AutomationRuleRow, AutomationRuleAction, CreateNotificationAction } from "./automation-rules.service.js";
import type { AutomationEventType } from "./automation-rules.service.js";
import { listByWorkspace as listWebhookConfigs } from "./webhook-configs.service.js";
import { deliverWebhook } from "./webhook-delivery.service.js";
import { getN8nConfig, triggerN8nWorkflow } from "../connectors/n8n.service.js";
import { listByWorkspace as listCommunicationRules } from "../communications/communication-rules.service.js";
import type { CommunicationRuleAction } from "../communications/communication-rules.service.js";
import { dispatchCommunicationJob } from "../communications/channel-dispatcher.service.js";
import { createScheduledForRule } from "../communications/scheduled-communications.service.js";
import { logger } from "../../observability/logger.js";
import { claimDispatchEvent, markDispatchCompleted, markDispatchFailed } from "./automation-dispatch-guard.service.js";
import { enqueueMarketingEvent } from "./marketing-automation.service.js";

export interface DispatchEventPayload {
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  /** Per request.status_changed: nuovo stato. */
  toStatus?: string;
  [key: string]: unknown;
}

/**
 * Esegue le regole e i webhook per l'evento. Non lancia eccezioni (log e continua).
 */
export const dispatchEvent = async (
  workspaceId: string,
  eventType: string,
  payload: DispatchEventPayload
): Promise<void> => {
  let dispatchKeyHash = "";
  try {
    const claim = await claimDispatchEvent(workspaceId, eventType, payload);
    dispatchKeyHash = claim.keyHash;
    if (!claim.shouldProcess) {
      logger.info({ workspaceId, eventType, keyHash: claim.keyHash }, "[automation-events] skipped duplicate dispatch");
      return;
    }

    const [rules, webhookConfigs] = await Promise.all([
      listRules(workspaceId),
      listWebhookConfigs(workspaceId),
    ]);

    const matchingRules = rules.filter(
      (r) => r.enabled && r.trigger.event_type === eventType && matchTriggerConditions(r.trigger, payload)
    );

    for (const rule of matchingRules) {
      for (const action of rule.actions) {
        try {
          await executeAction(action, workspaceId, payload);
        } catch (err) {
          logger.error({ err, ruleId: rule._id, actionType: action.type }, "[automation-events] action failed");
        }
      }
    }

    const matchingWebhooks = webhookConfigs.filter(
      (w) => w.enabled && w.events.includes(eventType as AutomationEventType)
    );
    for (const config of matchingWebhooks) {
      withRetry(
        () => deliverWebhook(config, eventType, payload),
        3,
        150,
      ).catch((err) => {
        logger.error({ err, webhookId: config._id }, "[automation-events] webhook delivery failed");
      });
    }

    const n8nConfig = await getN8nConfig(workspaceId);
    if (n8nConfig?.config?.baseUrl && (n8nConfig.config.defaultWorkflowId ?? "").trim()) {
      withRetry(
        () => triggerN8nWorkflow(workspaceId, n8nConfig.config.defaultWorkflowId ?? undefined, {
          eventType,
          ...payload,
        }),
        3,
        200,
      ).catch((err) => {
        logger.error({ err, workspaceId }, "[automation-events] n8n trigger failed");
      });
    }

    const commRules = await listCommunicationRules(workspaceId);
    const matchingCommRules = commRules.filter((r) => {
      const projectMatches =
        r.projectId == null ||
        String(r.projectId).trim() === "" ||
        (payload.projectId != null && String(r.projectId) === String(payload.projectId));
      return (
        r.enabled &&
        projectMatches &&
        r.trigger.eventType === eventType &&
        (r.trigger.toStatus == null || r.trigger.toStatus === "" || payload.toStatus === r.trigger.toStatus)
      );
    });
    for (const rule of matchingCommRules) {
      for (const action of rule.actions) {
        try {
          await withRetry(() => executeCommunicationAction(action, workspaceId, rule.projectId, payload), 3, 120);
        } catch (err) {
          logger.error(
            { err, ruleId: rule._id, actionType: action.type },
            "[automation-events] communication action failed"
          );
        }
      }
      if (rule.schedules?.length && typeof payload.startsAt === "string" && payload.startsAt) {
        try {
          await createScheduledForRule(rule._id, workspaceId, rule.projectId, payload, rule.schedules);
        } catch (err) {
          logger.error({ err, ruleId: rule._id }, "[automation-events] createScheduledForRule failed");
        }
      }
    }
    await enqueueMarketingEvent(workspaceId, eventType, payload).catch((err) => {
      logger.error({ err, workspaceId, eventType }, "[automation-events] enqueue marketing event failed");
    });
    if (dispatchKeyHash) await markDispatchCompleted(dispatchKeyHash);
  } catch (err) {
    if (dispatchKeyHash) {
      await markDispatchFailed(dispatchKeyHash, err instanceof Error ? err.message : "unknown_error");
    }
    logger.error({ err, workspaceId, eventType }, "[automation-events] dispatchEvent failed");
  }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
): Promise<T> => {
  let lastError: unknown;
  for (let idx = 0; idx < attempts; idx += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (idx < attempts - 1) {
        await sleep(baseDelayMs * (idx + 1));
      }
    }
  }
  throw lastError;
};

function matchTriggerConditions(
  trigger: AutomationRuleRow["trigger"],
  payload: DispatchEventPayload
): boolean {
  if (trigger.toStatus != null && trigger.toStatus !== "" && payload.toStatus !== trigger.toStatus) {
    return false;
  }
  return true;
}

async function executeAction(
  action: AutomationRuleAction,
  workspaceId: string,
  payload: DispatchEventPayload
): Promise<void> {
  if (action.type === "create_notification") {
    const a = action as CreateNotificationAction;
    await createNotification({
      workspaceId,
      type: "other" as NotificationType,
      title: a.title,
      body: a.body,
      link: typeof a.link === "string" ? a.link : undefined,
      entityType: payload.entityType,
      entityId: payload.entityId,
    });
  }
  if (action.type === "webhook_call") {
    // I webhook vengono già inviati in dispatchEvent per tutti i config con l'evento abilitato; qui non ripetiamo.
  }
}

async function executeCommunicationAction(
  action: CommunicationRuleAction,
  workspaceId: string,
  projectId: string | undefined,
  payload: DispatchEventPayload
): Promise<void> {
  if (action.type === "create_notification") {
    await createNotification({
      workspaceId,
      type: "other" as NotificationType,
      title: action.title,
      body: action.body,
      link: action.link,
      entityType: payload.entityType,
      entityId: payload.entityId,
    });
    return;
  }
  const channel =
    action.type === "send_email" ? "email" : action.type === "send_whatsapp" ? "whatsapp" : action.type === "send_sms" ? "sms" : "in_app";
  if (channel === "in_app") return;
  await dispatchCommunicationJob({
    workspaceId,
    projectId,
    channel,
    templateId: action.templateId,
    recipientType: action.recipientType,
    payload,
  });
}
