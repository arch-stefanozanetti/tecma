import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { writeAuditLog } from "../../core/audit/audit.service.js";
import { requirePermission } from "../permissionMiddleware.js";
import {
  listEmailFlows,
  getEmailFlow,
  upsertEmailFlow,
  previewEmailFlow,
  previewEmailFlowFromLayout,
} from "../../core/email/emailFlows.service.js";
import { emailLayoutSchema } from "../../core/email/emailLayout.schema.js";
import { uploadEmailFlowAsset } from "../../core/email/emailFlowAssetUpload.service.js";
import { getSuggestedEmailTemplate } from "../../core/email/email.service.js";

const EmailFlowKeySchema = z.enum(["user_invite", "password_reset", "email_verification"]);
const emailFlowUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

export const emailFlowsRoutes = Router();

emailFlowsRoutes.get(
  "/admin/email-flows",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(() => listEmailFlows())
);

emailFlowsRoutes.get(
  "/admin/email-flows/:flowKey/suggested",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    return getSuggestedEmailTemplate(flowKey);
  })
);

emailFlowsRoutes.get(
  "/admin/email-flows/:flowKey",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const item = await getEmailFlow(flowKey);
    if (!item) throw new HttpError("Flusso non trovato", 404);
    return item;
  })
);

emailFlowsRoutes.put(
  "/admin/email-flows/:flowKey",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const raw = req.body as Record<string, unknown>;
    const enabled = z.boolean().parse(raw.enabled);
    const subject = z.string().max(500).parse(raw.subject);
    const editorMode = raw.editorMode === "blocks" ? ("blocks" as const) : ("html" as const);

    let payload:
      | { editorMode: "html"; enabled: boolean; subject: string; bodyHtml: string }
      | { editorMode: "blocks"; enabled: boolean; subject: string; layout: z.infer<typeof emailLayoutSchema> };

    if (editorMode === "blocks") {
      const layout = emailLayoutSchema.parse(raw.layout);
      payload = { editorMode: "blocks", enabled, subject, layout };
    } else {
      const bodyHtml = z.string().max(200_000).parse(raw.bodyHtml ?? "");
      payload = { editorMode: "html", enabled, subject, bodyHtml };
    }

    if (payload.enabled && !subject.trim()) {
      throw new HttpError("Con template attivo serve un oggetto non vuoto", 400);
    }

    const updatedBy = req.user!.email || req.user!.sub;
    let item;
    try {
      item = await upsertEmailFlow(flowKey, payload, updatedBy);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpError(msg, 400);
    }

    await writeAuditLog({
      userId: req.user!.sub,
      action: "email_flow.update",
      entityType: "email_flow",
      entityId: flowKey,
      changes: { after: { enabled: payload.enabled, editorMode: payload.editorMode } },
      projectId: req.user!.projectId,
    });

    return item;
  })
);

emailFlowsRoutes.post(
  "/admin/email-flows/upload-asset",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  emailFlowUpload.single("file"),
  handleAsync(async (req) => {
    const f = req.file;
    if (!f?.buffer) throw new HttpError("Nessun file (campo: file)", 400);
    try {
      const url = await uploadEmailFlowAsset(f.buffer, f.mimetype);
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpError(msg, 400);
    }
  })
);

emailFlowsRoutes.post(
  "/admin/email-flows/:flowKey/preview",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const body = z
      .object({
        subject: z.string(),
        bodyHtml: z.string().optional(),
        layout: emailLayoutSchema.optional(),
        sampleVars: z.record(z.string()).optional(),
      })
      .parse(req.body);

    if (body.layout) {
      return previewEmailFlowFromLayout(flowKey, body.subject, body.layout, body.sampleVars ?? {});
    }

    const html = body.bodyHtml ?? "";
    return previewEmailFlow(flowKey, body.subject, html, body.sampleVars ?? {});
  })
);
