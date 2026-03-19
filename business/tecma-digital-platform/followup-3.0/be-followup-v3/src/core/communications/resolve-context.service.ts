/**
 * Costruisce il contesto variabili per i template (client_name, apartment_name, visit_date, ...).
 */
import type { DispatchEventPayload } from "../automations/automation-events.service.js";
import { resolveClientIdFromDispatchPayload } from "./resolve-client-id-from-payload.js";
import { getClientById } from "../clients/clients.service.js";
import { getApartmentById } from "../apartments/apartments.service.js";
import { getProjectDetail } from "../projects/project-config.service.js";

export type TemplateContext = Record<string, string | undefined>;

/**
 * Dato il payload di un evento, carica client/apartment/project e restituisce un contesto per i placeholder.
 */
export async function buildCommunicationContext(payload: DispatchEventPayload): Promise<TemplateContext> {
  const ctx: TemplateContext = {};
  const { workspaceId, projectId, apartmentId, startsAt, title, toStatus } = payload;
  const clientId = resolveClientIdFromDispatchPayload(payload);

  if (typeof toStatus === "string" && toStatus) ctx.request_status = toStatus;
  if (typeof title === "string" && title) ctx.visit_title = title;
  if (startsAt != null && typeof startsAt === "string") {
    try {
      const d = new Date(startsAt);
      const dateStr = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) as string;
      const timeStr = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) as string;
      ctx.visit_date = dateStr;
      ctx.visit_time = timeStr;
    } catch {
      ctx.visit_date = String(startsAt);
      ctx.visit_time = "";
    }
  }

  if (clientId) {
    try {
      const { client } = await getClientById(clientId);
      ctx.client_name = client?.fullName ?? "";
      ctx.client_email = client?.email ?? "";
      ctx.client_phone = (client as { phone?: string })?.phone ?? "";
    } catch {
      ctx.client_name = "";
      ctx.client_email = "";
      ctx.client_phone = "";
    }
  }

  if (apartmentId) {
    try {
      const apt = await getApartmentById(apartmentId);
      const a = apt?.apartment;
      ctx.apartment_name = a?.name ?? "";
      ctx.apartment_code = a?.code ?? "";
      ctx.apartment_address = (a as { address?: string })?.address ?? "";
      if (ctx.apartment_address) ctx.address = ctx.apartment_address;
    } catch {
      ctx.apartment_name = "";
      ctx.apartment_code = "";
      ctx.apartment_address = "";
    }
  }

  if (projectId && workspaceId) {
    try {
      const project = await getProjectDetail(projectId, workspaceId, false);
      ctx.project_name = project?.name ?? "";
      ctx.vendor_name = (project as { vendorName?: string })?.vendorName ?? "";
    } catch {
      ctx.project_name = "";
      ctx.vendor_name = "";
    }
  }

  return ctx;
}

/**
 * Sostituisce i placeholder {{key}} in una stringa con i valori del contesto.
 */
export function substituteVariables(text: string, context: TemplateContext): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}
