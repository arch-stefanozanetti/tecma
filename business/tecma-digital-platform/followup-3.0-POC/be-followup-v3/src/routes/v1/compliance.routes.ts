import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { sendError } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import {
  exportSecurityAuditJsonl,
  querySecurityAudit
} from "../../core/compliance/security-audit.service.js";

export const complianceRoutes = Router();

complianceRoutes.get(
  "/compliance/security-audit",
  requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ),
  handleAsync(async (req) => {
    const q = z
      .object({
        workspaceId: z.string().optional(),
        userId: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.coerce.number().optional(),
        perPage: z.coerce.number().optional()
      })
      .parse(req.query);
    return querySecurityAudit({
      workspaceId: q.workspaceId,
      userId: q.userId,
      action: q.action,
      entityType: q.entityType,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      page: q.page,
      perPage: q.perPage
    });
  })
);

complianceRoutes.get(
  "/compliance/security-audit/export.jsonl",
  requirePermission(PERMISSIONS.COMPLIANCE_AUDIT_READ),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const q = z
          .object({
            workspaceId: z.string().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            maxDocs: z.coerce.number().min(1).max(50_000).optional(),
            sortOrder: z.enum(["asc", "desc"]).optional()
          })
          .parse(req.query);
        const body = await exportSecurityAuditJsonl({
          workspaceId: q.workspaceId,
          dateFrom: q.dateFrom,
          dateTo: q.dateTo,
          maxDocs: q.maxDocs,
          sortOrder: q.sortOrder
        });
        res.type("application/x-ndjson; charset=utf-8");
        res.send(body);
      } catch (err) {
        sendError(res, err);
      }
    })().catch(next);
  }
);
