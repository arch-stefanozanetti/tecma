import { Router } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { recordSecurityEvent } from "../../core/compliance/security-audit.service.js";
import {
  createUserGdprRequest,
  getExportPayloadForUser,
  listGdprRequestsForUser,
  listUserConsents,
  upsertUserConsent
} from "../../core/gdpr/user-gdpr.service.js";
import { getClientIp } from "../requestMeta.js";

export const gdprUserRoutes = Router();

gdprUserRoutes.post(
  "/me/gdpr/export-request",
  handleAsync(async (req) => {
    const u = req.user!;
    const r = await createUserGdprRequest({ userId: u.sub, email: u.email, type: "export" });
    void recordSecurityEvent({
      action: "gdpr.export_served",
      entityType: "gdpr_request",
      entityId: r.requestId,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { type: "export", status: r.status }
    });
    return r;
  })
);

gdprUserRoutes.post(
  "/me/gdpr/erasure-request",
  handleAsync(async (req) => {
    const u = req.user!;
    const r = await createUserGdprRequest({ userId: u.sub, email: u.email, type: "erasure" });
    void recordSecurityEvent({
      action: "gdpr.erasure_requested",
      entityType: "gdpr_request",
      entityId: r.requestId,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { type: "erasure", status: r.status }
    });
    return r;
  })
);

gdprUserRoutes.get(
  "/me/gdpr/requests",
  handleAsync(async (req) => {
    const u = req.user!;
    const data = await listGdprRequestsForUser(u.sub);
    return { data };
  })
);

gdprUserRoutes.get(
  "/me/gdpr/export/:requestId",
  handleAsync(async (req) => {
    const u = req.user!;
    const data = await getExportPayloadForUser(u.sub, req.params.requestId ?? "");
    return { data };
  })
);

gdprUserRoutes.post(
  "/me/gdpr/consents",
  handleAsync(async (req) => {
    const u = req.user!;
    const body = z
      .object({
        consentType: z.string().min(1).max(120),
        version: z.string().min(1).max(64),
        accepted: z.boolean()
      })
      .parse(req.body);
    await upsertUserConsent({
      userId: u.sub,
      consentType: body.consentType,
      version: body.version,
      accepted: body.accepted
    });
    void recordSecurityEvent({
      action: "gdpr.consent_updated",
      entityType: "user_consent",
      entityId: `${u.sub}:${body.consentType}`,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { consentType: body.consentType, version: body.version, accepted: body.accepted }
    });
    return { ok: true as const };
  })
);

gdprUserRoutes.get(
  "/me/gdpr/consents",
  handleAsync(async (req) => {
    const u = req.user!;
    const data = await listUserConsents(u.sub);
    return { data };
  })
);
