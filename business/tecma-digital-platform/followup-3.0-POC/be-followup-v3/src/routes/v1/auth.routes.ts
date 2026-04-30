import { Router } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { logAuthEvent } from "../../core/auth/authAudit.service.js";
import {
  confirmMfaSetup,
  disableMfa,
  getUserSecurity,
  startMfaSetup
} from "../../core/auth/mfa.service.js";
import { recordSecurityEvent } from "../../core/compliance/security-audit.service.js";
import { mfaSetupRateLimiter } from "../rateLimitMiddleware.js";
import { getClientIp } from "../requestMeta.js";

export const authRoutes = Router();

authRoutes.get(
  "/auth/me",
  handleAsync(async (req) => {
    const payload = req.user!;
    const sec = await getUserSecurity(payload.sub);
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isAdmin: payload.isAdmin,
      permissions: payload.permissions,
      projectId: payload.projectId,
      system_role: payload.system_role ?? undefined,
      isTecmaAdmin: payload.isTecmaAdmin === true,
      mfaEnabled: Boolean(sec?.totpEnabled)
    };
  })
);

authRoutes.post(
  "/auth/mfa/setup/start",
  mfaSetupRateLimiter,
  handleAsync(async (req) => {
    const u = req.user!;
    const out = await startMfaSetup(u.sub, u.email);
    void recordSecurityEvent({
      action: "mfa.setup_started",
      entityType: "user",
      entityId: u.sub,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined
    });
    return out;
  })
);

authRoutes.post(
  "/auth/mfa/setup/confirm",
  mfaSetupRateLimiter,
  handleAsync(async (req) => {
    const body = z.object({ code: z.string().min(6).max(16) }).parse(req.body);
    const u = req.user!;
    const result = await confirmMfaSetup(u.sub, body.code);
    void recordSecurityEvent({
      action: "mfa.setup_completed",
      entityType: "user",
      entityId: u.sub,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined,
      metadata: { backupCodesIssued: result.backupCodes.length }
    });
    return result;
  })
);

authRoutes.post(
  "/auth/mfa/disable",
  mfaSetupRateLimiter,
  handleAsync(async (req) => {
    const body = z.object({ code: z.string().min(6).max(32) }).parse(req.body);
    const u = req.user!;
    await disableMfa(u.sub, body.code);
    await logAuthEvent("mfa_disabled", {
      userId: u.sub,
      email: u.email,
      success: true
    });
    void recordSecurityEvent({
      action: "mfa.disabled",
      entityType: "user",
      entityId: u.sub,
      userId: u.sub,
      ip: getClientIp(req) ?? undefined,
      userAgent: req.get("user-agent") ?? undefined
    });
    return { ok: true as const };
  })
);
