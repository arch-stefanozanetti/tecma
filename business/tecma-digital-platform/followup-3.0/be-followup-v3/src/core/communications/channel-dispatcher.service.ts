/**
 * Dispatcher: dato un job (canale, templateId, recipientType, payload) invia via email, WhatsApp o crea notifica in-app.
 */
import type { DispatchEventPayload } from "../automations/automation-events.service.js";
import { createNotification } from "../notifications/notifications.service.js";
import type { NotificationType } from "../notifications/notifications.service.js";
import { getById as getTemplateById, resolveTemplate } from "./templates.service.js";
import { buildCommunicationContext } from "./resolve-context.service.js";
import { sendEmail } from "./email.service.js";
import { sendWhatsAppMessage } from "./whatsapp.service.js";
import type { CommunicationRecipientType } from "./communication-rules.service.js";
import { getClientById } from "../clients/clients.service.js";
import { getProjectDetail, getProjectBrandingInternal } from "../projects/project-config.service.js";
import { logDelivery } from "./communication-deliveries.service.js";
import { logger } from "../../observability/logger.js";

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
  if (recipientType === "client" && payload.clientId) {
    const { client } = await getClientById(payload.clientId);
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
        { recipientType: job.recipientType, clientId: job.payload.clientId },
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
    await logDelivery({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "email",
      templateId: job.templateId,
      recipient: email,
      status: "sent",
    }).catch(() => {});
    return;
  }

  if (job.channel === "whatsapp") {
    const phone = recipient.phone;
    if (!phone) {
      logger.warn({ clientId: job.payload.clientId }, "[channel-dispatcher] missing recipient phone");
      return;
    }
    await sendWhatsAppMessage(job.workspaceId, phone, resolved.bodyText);
    await logDelivery({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      channel: "whatsapp",
      templateId: job.templateId,
      recipient: phone,
      status: "sent",
    }).catch(() => {});
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
    logger.warn("[channel-dispatcher] SMS not implemented yet");
    return;
  }
}
