/**
 * Dispatch eventi per regole e webhook (Wave 4). Esegue regole e accoda invii webhook.
 */
import { createNotification } from "../notifications/notifications.service.js";
import type { NotificationType } from "../notifications/notifications.service.js";
import { listByWorkspace as listRules } from "./automation-rules.service.js";
import type { AutomationRuleRow, AutomationRuleAction, CreateNotificationAction } from "./automation-rules.service.js";
import { listByWorkspace as listWebhookConfigs } from "./webhook-configs.service.js";
import { deliverWebhook } from "./webhook-delivery.service.js";

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
      (w) => w.enabled && w.events.includes(eventType as "request.created" | "request.status_changed" | "client.created")
    );
    for (const config of matchingWebhooks) {
      deliverWebhook(config, eventType, payload).catch((err) => {
        console.error("[automation-events] Webhook delivery failed:", config._id, err);
      });
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
      link: a.link,
      entityType: payload.entityType,
      entityId: payload.entityId,
    });
  }
  if (action.type === "webhook_call") {
    // I webhook vengono già inviati in dispatchEvent per tutti i config con l'evento abilitato; qui non ripetiamo.
  }
}
