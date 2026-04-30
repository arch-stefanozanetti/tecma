/**
 * Dispatcher: dato un job (canale, templateId, recipientType, payload) invia via email, WhatsApp o crea notifica in-app.
 */
import type { DispatchEventPayload } from "../automations/automation-events.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import type { NotificationType } from "../notifications/notifications.service.js";
import {
  getById as getTemplateById,
  resolveTemplate,
  buildMetaWhatsAppTemplatePayload,
} from "./templates.service.js";
import { buildCommunicationContext } from "./resolve-context.service.js";
import { sendEmail } from "./email.service.js";
import type { CommunicationRecipientType } from "./communication-rules.service.js";
import { resolveClientIdFromDispatchPayload } from "./resolve-client-id-from-payload.js";
import { getClientById } from "../clients/clients.service.js";
import { getProjectDetail, getProjectBrandingInternal } from "../projects/project-config.service.js";
import { logDelivery } from "./communication-deliveries.service.js";
import { logger } from "../../observability/logger.js";
import { safeAsync } from "../shared/safeAsync.js";
import { sendWithMessagingGateway } from "../messaging/messaging-gateway.service.js";
import { resolveWhatsAppRoute } from "../messaging/whatsapp-route-resolver.js";

export interface DispatchJob {
  workspaceId: string;
  projectId?: string;
  channel: "email" | "whatsapp" | "sms" | "in_app";
  templateId: string;
  recipientType: CommunicationRecipientType;
  payload: DispatchEventPayload;
}

/**
 * Risolve il destinatario (email o telefono) in base a recipientType e payload.
 */
async function resolveRecipient(
  recipientType: CommunicationRecipientType,
  payload: DispatchEventPayload
): Promise<{ email?: string; phone?: string; userId?: string }> {
  const clientId = resolveClientIdFromDispatchPayload(payload);
  if (recipientType === "client" && clientId) {
    const { client } = await getClientById(clientId);
    return {
      email: client?.email ?? undefined,
      phone: (client as { phone?: string })?.phone ?? undefined,
    };
  }
  if ((recipientType === "vendor" || recipientType === "assignee") && payload.projectId && payload.workspaceId) {
    try {
      const project = await getProjectDetail(payload.projectId, payload.workspaceId, false);
      const vendorEmail = (project as { vendorEmail?: string })?.vendorEmail;
      if (vendorEmail) return { email: vendorEmail };
    } catch (err) {
      logger.warn({ err, projectId: payload.projectId }, "[channel-dispatcher] unable to resolve vendor email");
    }
  }
  return {};
}

/**
 * Esegue un singolo job: risolve template, destinatario e invia sul canale.
 */
export async function dispatchCommunicationJob(job: DispatchJob): Promise<void> {
  const template = await getTemplateById(job.templateId);
  if (!template) {
    logger.error({ templateId: job.templateId }, "[channel-dispatcher] template not found");
    return;
  }
  if (template.channel !== job.channel) {
    logger.error(
      { templateChannel: template.channel, jobChannel: job.channel, templateId: job.templateId },
      "[channel-dispatcher] template channel mismatch"
    );
    return;
  }
  const context = await buildCommunicationContext(job.payload);
  const contextStr: Record<string, string | undefined> = { ...context };
  const resolved = resolveTemplate(template, contextStr);
  const recipient = await resolveRecipient(job.recipientType, job.payload);

  if (job.channel === "email") {
    const email = recipient.email;
    if (!email) {
      logger.warn(
        { recipientType: job.recipientType, clientId: resolveClientIdFromDispatchPayload(job.payload) },
        "[channel-dispatcher] missing recipient email"
      );
      return;
    }
    const branding = job.projectId ? await getProjectBrandingInternal(job.projectId) : null;
    await sendEmail({
      to: email,
      subject: resolved.subject ?? "(Nessun oggetto)",
      text: resolved.bodyText,
      html: resolved.bodyHtml,
      branding: branding
        ? {
            logoUrl: branding.logoUrl,
            primaryColor: branding.primaryColor,
            footerText: branding.footerText,
          }
        : undefined,
    });
    safeAsync(logDelivery({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "email",
      templateId: job.templateId,
      recipient: email,
      status: "sent",
    }), {
      operation: "communications.delivery.email",
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      entityType: job.payload.entityType,
      entityId: job.payload.entityId,
    });
    return;
  }

  if (job.channel === "whatsapp") {
    const phone = recipient.phone;
    if (!phone) {
      logger.warn(
        { clientId: resolveClientIdFromDispatchPayload(job.payload) },
        "[channel-dispatcher] missing recipient phone"
      );
      return;
    }
    const waRoute = await resolveWhatsAppRoute(job.workspaceId);
    const baseReq = {
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "whatsapp" as const,
      to: phone,
      body: resolved.bodyText,
    };
    const gatewayReq =
      waRoute.primary === "meta_whatsapp"
        ? (() => {
            const tplPayload = buildMetaWhatsAppTemplatePayload(template, contextStr);
            if (!tplPayload) {
              throw new Error(
                "WhatsApp Meta: il template CRM deve avere metaTemplateName e metaTemplateLanguage allineati al template approvato in Meta."
              );
            }
            return { ...baseReq, whatsappTemplate: tplPayload };
          })()
        : baseReq;
    const result = await sendWithMessagingGateway(gatewayReq);
    if (!result.ok) {
      throw new Error(`WhatsApp delivery failed (${result.errorCode ?? "unknown"})`);
    }
    safeAsync(logDelivery({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "whatsapp",
      templateId: job.templateId,
      recipient: phone,
      status: "sent",
    }), {
      operation: "communications.delivery.whatsapp",
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      entityType: job.payload.entityType,
      entityId: job.payload.entityId,
    });
    return;
  }

  if (job.channel === "in_app") {
    await createNotification({
      workspaceId: job.workspaceId,
      type: "other" as NotificationType,
      title: resolved.subject ?? resolved.bodyText.slice(0, 80),
      body: resolved.bodyText,
      entityType: job.payload.entityType,
      entityId: job.payload.entityId,
    });
    return;
  }

  if (job.channel === "sms") {
    const phone = recipient.phone;
    if (!phone) {
      logger.warn(
        { clientId: resolveClientIdFromDispatchPayload(job.payload) },
        "[channel-dispatcher] missing recipient phone for sms"
      );
      return;
    }
    const result = await sendWithMessagingGateway({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "sms",
      to: phone,
      body: resolved.bodyText,
    });
    if (!result.ok) {
      throw new Error(`SMS delivery failed (${result.errorCode ?? "unknown"})`);
    }
    safeAsync(logDelivery({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "sms",
      templateId: job.templateId,
      recipient: phone,
      status: "sent",
    }), {
      operation: "communications.delivery.sms",
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      entityType: job.payload.entityType,
      entityId: job.payload.entityId,
    });
    return;
  }
}
