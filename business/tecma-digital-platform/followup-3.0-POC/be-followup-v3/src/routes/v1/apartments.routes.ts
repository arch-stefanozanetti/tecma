import { Router } from "express";
import {
  queryApartments,
  getApartmentById,
  createApartment,
  updateApartment,
} from "../../core/apartments/apartments.service.js";
import { queryRequests } from "../../core/requests/requests.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { auditAndDispatchEntityEvent } from "../helpers/auditAndDispatch.js";
import { requireAdmin } from "../authMiddleware.js";
import { getCurrentPriceForUnit } from "../../core/unit-pricing/unit-pricing.service.js";
import { listSalePricesByUnitId, createSalePrice, updateSalePrice } from "../../core/sale-prices/sale-prices.service.js";
import { listMonthlyRentsByUnitId, createMonthlyRent, updateMonthlyRent } from "../../core/monthly-rents/monthly-rents.service.js";
import { getInventoryByUnitId, setInventoryStatus } from "../../core/inventory/inventory.service.js";
import { getActiveLockForApartment } from "../../core/workflow/apartment-lock.service.js";
import { listPriceCalendarByUnitAndRange, upsertPriceCalendarEntry } from "../../core/price-calendar/price-calendar.service.js";
import {
  parseExcelBuffer,
  validateRows,
  executeImport,
  type OnDuplicate,
} from "../../core/units-import/units-import.service.js";
import { previewTecmaCatalogImport, executeTecmaCatalogImport } from "../../core/catalog/tecma-catalog-import.service.js";
import { resolveListQueryFromRequest, toEntityAssignmentListViewer } from "../helpers/listQueryViewer.js";
import { buildListQueryContext, clampProjectIds, toEntityAssignmentViewer } from "../../core/access/listQueryContext.js";
import { resolveListQueryFromRequestQuery } from "../helpers/parseListQuery.js";
export const apartmentsRoutes = Router();

apartmentsRoutes.post(
  "/apartments/query",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { input, viewer } = await resolveListQueryFromRequest(req.user, req.body);
    return queryApartments(input, viewer);
  })
);

apartmentsRoutes.post(
  "/apartments",
  requirePermission(PERMISSIONS.APARTMENTS_CREATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync(async (req) => {
  const result = await createApartment(req.body);
  if (result?.apartmentId && req.body.workspaceId) {
    auditAndDispatchEntityEvent({
      action: "apartment.created",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "apartment",
      entityId: result.apartmentId,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { code: result.apartment?.code },
      userId: req.user?.sub,
    });
  }
  return result;
  })
);

apartmentsRoutes.patch(
  "/apartments/:id",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync(async (req) => {
  const result = await updateApartment({ ...req.body, apartmentId: req.params.id });
  if (req.body.workspaceId) {
    auditAndDispatchEntityEvent({
      action: "apartment.updated",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "apartment",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: req.body,
      userId: req.user?.sub,
    });
  }
  return result;
  })
);

apartmentsRoutes.get(
  "/apartments/:id",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    const ctx = workspaceId ? await buildListQueryContext(req.user, workspaceId) : null;
    const viewer = ctx ? toEntityAssignmentViewer(ctx) : toEntityAssignmentListViewer(req.user);
    const result = await getApartmentById(req.params.id, viewer);
    if (ctx && !ctx.isAdmin && !ctx.isTecmaAdmin && result.apartment.projectId) {
      const allowed = clampProjectIds([String(result.apartment.projectId)], ctx.allowedProjectIds, false);
      if (allowed.length === 0) throw new HttpError("Apartment not found", 404);
    }
    return result;
  })
);

apartmentsRoutes.get(
  "/apartments/:id/prices",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const [current, salePrices, monthlyRents] = await Promise.all([
    getCurrentPriceForUnit(unitId),
    listSalePricesByUnitId(unitId),
    listMonthlyRentsByUnitId(unitId),
  ]);
  return { current, salePrices, monthlyRents };
  })
);

apartmentsRoutes.get(
  "/apartments/:id/inventory",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const [inventory, lock] = await Promise.all([
    getInventoryByUnitId(unitId),
    getActiveLockForApartment(unitId),
  ]);
  const effectiveStatus = lock ? "locked" : (inventory?.inventoryStatus ?? "available");
  return {
    inventory: inventory ?? null,
    lock: lock ? { requestId: lock.requestId, type: lock.type } : null,
    effectiveStatus,
  };
  })
);

apartmentsRoutes.patch(
  "/apartments/:id/inventory",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId?: string; inventoryStatus?: "available" | "locked" | "reserved" | "sold" };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  const status = body.inventoryStatus ?? "available";
  return setInventoryStatus(unitId, body.workspaceId, status);
  })
);

apartmentsRoutes.post(
  "/apartments/:id/prices/sale",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId: string; price: number; currency?: string; validFrom?: string; validTo?: string };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  return createSalePrice({
    unitId,
    workspaceId: body.workspaceId,
    price: body.price,
    currency: body.currency,
    validFrom: body.validFrom,
    validTo: body.validTo,
  });
  })
);

apartmentsRoutes.post(
  "/apartments/:id/prices/monthly-rent",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId: string; pricePerMonth: number; deposit?: number; currency?: string; validFrom?: string; validTo?: string };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  return createMonthlyRent({
    unitId,
    workspaceId: body.workspaceId,
    pricePerMonth: body.pricePerMonth,
    deposit: body.deposit,
    currency: body.currency,
    validFrom: body.validFrom,
    validTo: body.validTo,
  });
  })
);

apartmentsRoutes.patch(
  "/apartments/:id/prices/sale/:priceId",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const priceId = req.params.priceId;
  const body = req.body as { validTo?: string; price?: number };
  return updateSalePrice(unitId, priceId, { validTo: body.validTo, price: body.price });
  })
);

apartmentsRoutes.patch(
  "/apartments/:id/prices/monthly-rent/:rentId",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const rentId = req.params.rentId;
  const body = req.body as { validTo?: string; pricePerMonth?: number; deposit?: number };
  return updateMonthlyRent(unitId, rentId, {
    validTo: body.validTo,
    pricePerMonth: body.pricePerMonth,
    deposit: body.deposit,
  });
  })
);

apartmentsRoutes.get(
  "/apartments/:id/prices/calendar",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const from = (req.query.from as string) ?? "";
  const to = (req.query.to as string) ?? "";
  if (!from || !to) throw new HttpError("query from and to (YYYY-MM-DD) required", 400);
  return listPriceCalendarByUnitAndRange(unitId, from, to);
  })
);

apartmentsRoutes.put(
  "/apartments/:id/prices/calendar",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { date: string; price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" };
  if (!body.date || typeof body.price !== "number") throw new HttpError("date and price required", 400);
  await upsertPriceCalendarEntry({
    unitId,
    date: body.date,
    price: body.price,
    minStay: body.minStay,
    availability: body.availability,
  });
  return { ok: true };
  })
);

apartmentsRoutes.post("/workspaces/:workspaceId/projects/:projectId/units/import/preview", requireCanAccessProject("workspaceId", "projectId"), requireAdmin, handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectId = req.params.projectId;
  const body = req.body as { fileBase64?: string; fileName?: string };
  const b64 = body.fileBase64;
  if (typeof b64 !== "string" || !b64) throw new HttpError("fileBase64 obbligatorio", 400);
  const buffer = Buffer.from(b64, "base64");
  const rows = await parseExcelBuffer(buffer);
  return validateRows(rows, workspaceId, projectId);
}));

apartmentsRoutes.post("/workspaces/:workspaceId/projects/:projectId/units/import/execute", requireCanAccessProject("workspaceId", "projectId"), requireAdmin, handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectId = req.params.projectId;
  const body = req.body as { validRows?: unknown[]; onDuplicate?: OnDuplicate };
  const validRows = Array.isArray(body.validRows) ? body.validRows as Parameters<typeof executeImport>[2] : [];
  const onDuplicate = (body.onDuplicate === "overwrite" || body.onDuplicate === "fail" ? body.onDuplicate : "skip") as OnDuplicate;
  return executeImport(workspaceId, projectId, validRows, onDuplicate);
}));

apartmentsRoutes.post(
  "/workspaces/:workspaceId/projects/:projectId/catalog/tecma-import/preview",
  requireCanAccessProject("workspaceId", "projectId"),
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const projectId = req.params.projectId;
    const body = req.body as { fileBase64?: string };
    const b64 = body.fileBase64;
    if (typeof b64 !== "string" || !b64) throw new HttpError("fileBase64 obbligatorio", 400);
    const buffer = Buffer.from(b64, "base64");
    return previewTecmaCatalogImport(buffer, workspaceId, projectId);
  })
);

apartmentsRoutes.post(
  "/workspaces/:workspaceId/projects/:projectId/catalog/tecma-import/execute",
  requireCanAccessProject("workspaceId", "projectId"),
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const projectId = req.params.projectId;
    const body = req.body as { fileBase64?: string };
    const b64 = body.fileBase64;
    if (typeof b64 !== "string" || !b64) throw new HttpError("fileBase64 obbligatorio", 400);
    const buffer = Buffer.from(b64, "base64");
    return executeTecmaCatalogImport(buffer, workspaceId, projectId);
  })
);

apartmentsRoutes.get(
  "/apartments/:id/requests",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { input, viewer } = await resolveListQueryFromRequestQuery(req.user, req);
    return queryRequests(
      {
        ...input,
        filters: { apartmentId: req.params.id },
      },
      viewer
    );
  })
);
