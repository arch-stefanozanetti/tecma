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
  try {
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
          console.error("[automation-events] Action failed:", rule._id, action.type, err);
        }
      }
    }

    const matchingWebhooks = webhookConfigs.filter(
      (w) => w.enabled && w.events.includes(eventType as AutomationEventType)
    );
    for (const config of matchingWebhooks) {
      deliverWebhook(config, eventType, payload).catch((err) => {
        console.error("[automation-events] Webhook delivery failed:", config._id, err);
      });
    }

    const n8nConfig = await getN8nConfig(workspaceId);
    if (n8nConfig?.config?.baseUrl && (n8nConfig.config.defaultWorkflowId ?? "").trim()) {
      triggerN8nWorkflow(workspaceId, n8nConfig.config.defaultWorkflowId ?? undefined, {
        eventType,
        ...payload,
      }).catch((err) => {
        console.error("[automation-events] n8n trigger failed:", workspaceId, err);
      });
    }

    const commRules = await listCommunicationRules(workspaceId);
    const matchingCommRules = commRules.filter(
      (r) =>
        r.enabled &&
        r.trigger.eventType === eventType &&
        (r.trigger.toStatus == null || r.trigger.toStatus === "" || payload.toStatus === r.trigger.toStatus)
    );
    for (const rule of matchingCommRules) {
      for (const action of rule.actions) {
        try {
          await executeCommunicationAction(action, workspaceId, rule.projectId, payload);
        } catch (err) {
          console.error("[automation-events] Communication action failed:", rule._id, action.type, err);
        }
      }
      if (rule.schedules?.length && typeof payload.startsAt === "string" && payload.startsAt) {
        try {
          await createScheduledForRule(rule._id, workspaceId, rule.projectId, payload, rule.schedules);
        } catch (err) {
          console.error("[automation-events] createScheduledForRule failed:", rule._id, err);
        }
      }
    }
  } catch (err) {
    console.error("[automation-events] dispatchEvent failed:", workspaceId, eventType, err);
  }
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
