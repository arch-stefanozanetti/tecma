import { Router } from "express";
import { z } from "zod";
import { queryApartments } from "../../core/apartments/apartments.service.js";
import { runKpiSummaryReport } from "../../core/reports/reports.service.js";
import { HttpError } from "../../types/http.js";
import { platformApiKeyMiddleware } from "../platformApiKeyMiddleware.js";
import { platformApiKeyRateLimiter } from "../rateLimitMiddleware.js";
import { handleAsync } from "../asyncHandler.js";

const ListingsQuerySchema = z.object({
  projectIds: z.array(z.string().min(1)).optional(),
  page: z.number().int().min(1).default(1).optional(),
  perPage: z.number().int().min(1).max(200).default(25).optional(),
  searchText: z.string().optional(),
  status: z.string().optional(),
  mode: z.enum(["rent", "sell"]).optional(),
});

const DateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const platformRoutes = Router();

platformRoutes.use(platformApiKeyRateLimiter);
platformRoutes.use(platformApiKeyMiddleware);

platformRoutes.get("/capabilities", (req, res) => {
  const access = req.platformAccess!;
  res.json({
    ok: true,
    consumer: access.label,
    workspaceId: access.workspaceId,
    projectIds: access.projectIds,
    endpoints: ["POST /platform/listings/query", "POST /platform/reports/kpi-summary", "GET /platform/capabilities"],
  });
});

platformRoutes.post("/listings/query", handleAsync(async (req) => {
  const access = req.platformAccess!;
  const parsed = ListingsQuerySchema.parse(req.body);
  const requestedProjectIds = parsed.projectIds ?? access.projectIds;
  const allowedProjectIds = access.projectIds.length === 0
    ? requestedProjectIds
    : requestedProjectIds.filter((id) => access.projectIds.includes(id));
  if (allowedProjectIds.length === 0) {
    throw new HttpError("No allowed projectIds for this API key", 403);
  }
  const body = {
    workspaceId: access.workspaceId,
    projectIds: allowedProjectIds,
    page: parsed.page ?? 1,
    perPage: parsed.perPage ?? 25,
    searchText: parsed.searchText,
    filters:
      parsed.status || parsed.mode
        ? {
            ...(parsed.status ? { status: parsed.status } : {}),
            ...(parsed.mode ? { mode: parsed.mode } : {}),
          }
        : undefined,
  };
  return queryApartments(body);
}));

platformRoutes.post("/reports/kpi-summary", handleAsync(async (req) => {
  const access = req.platformAccess!;
  const parsed = DateRangeSchema.parse(req.body ?? {});
  return runKpiSummaryReport({
    workspaceId: access.workspaceId,
    projectIds: access.projectIds,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
  });
}));
