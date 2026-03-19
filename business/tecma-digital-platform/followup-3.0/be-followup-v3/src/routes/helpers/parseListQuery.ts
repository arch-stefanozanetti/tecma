/**
 * Helper per estrarre workspaceId, projectIds, page, perPage da req.query.
 * Usato nelle route che espongono liste paginate (es. GET /clients/:id/requests).
 */
import type { Request } from "express";
import { HttpError } from "../../types/http.js";

export interface ParsedListQuery {
  workspaceId: string;
  projectIds: string[];
  page: number;
  perPage: number;
}

const defaultPage = 1;
const defaultPerPage = 25;

/**
 * Estrae e valida i parametri di lista da req.query.
 * @throws HttpError 400 se workspaceId o projectIds mancanti/invalidi
 */
export function parseListQueryFromRequest(req: Request): ParsedListQuery {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
  const projectIds = projectIdsRaw
    ? projectIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!workspaceId || projectIds.length === 0) {
    throw new HttpError("Missing workspaceId or projectIds query params", 400);
  }

  const pageRaw = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : defaultPage;
  const perPageRaw = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : defaultPerPage;
  const page = Number.isNaN(pageRaw) ? defaultPage : Math.max(1, pageRaw);
  const perPage = Number.isNaN(perPageRaw) ? defaultPerPage : Math.max(1, Math.min(100, perPageRaw));

  return { workspaceId, projectIds, page, perPage };
}
