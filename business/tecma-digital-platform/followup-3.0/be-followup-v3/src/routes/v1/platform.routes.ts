import { Router } from "express";
import { z } from "zod";
import { queryApartments } from "../../core/apartments/apartments.service.js";
import { queryClientsLite } from "../../core/future/future.service.js";
import { runKpiSummaryReport } from "../../core/reports/reports.service.js";
import { HttpError } from "../../types/http.js";
import { enforcePlatformQuota, platformApiKeyMiddleware, requirePlatformScope } from "../platformApiKeyMiddleware.js";
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
platformRoutes.use((req, res, next) => {
  void enforcePlatformQuota(req, res, next);
});

platformRoutes.get("/capabilities", requirePlatformScope("platform.capabilities.read"), (req, res) => {
  const access = req.platformAccess!;
  res.json({
    ok: true,
    consumer: access.label,
    workspaceId: access.workspaceId,
    projectIds: access.projectIds,
    scopes: access.scopes,
    quotaPerDay: access.quotaPerDay,
    endpoints: [
      "GET /platform/capabilities",
      "POST /platform/listings/query",
      "POST /platform/clients/lite/query",
      "POST /platform/reports/kpi-summary",
    ],
  });
});

platformRoutes.post("/listings/query", requirePlatformScope("platform.listings.read"), handleAsync(async (req) => {
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

const ClientsLitePlatformSchema = z.object({
  projectIds: z.array(z.string().min(1)).optional(),
});

platformRoutes.post("/clients/lite/query", requirePlatformScope("platform.clients.read"), handleAsync(async (req) => {
  const access = req.platformAccess!;
  const parsed = ClientsLitePlatformSchema.parse(req.body ?? {});
  const requestedProjectIds = parsed.projectIds ?? access.projectIds;
  const allowedProjectIds =
    access.projectIds.length === 0
      ? requestedProjectIds
      : requestedProjectIds.filter((id) => access.projectIds.includes(id));
  if (allowedProjectIds.length === 0) {
    throw new HttpError("No allowed projectIds for this API key", 403);
  }
  const data = await queryClientsLite(access.workspaceId, allowedProjectIds);
  return { data };
}));

platformRoutes.post("/reports/kpi-summary", requirePlatformScope("platform.reports.read"), handleAsync(async (req) => {
  const access = req.platformAccess!;
  const parsed = DateRangeSchema.parse(req.body ?? {});
  return runKpiSummaryReport({
    workspaceId: access.workspaceId,
    projectIds: access.projectIds,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
  });
}));
