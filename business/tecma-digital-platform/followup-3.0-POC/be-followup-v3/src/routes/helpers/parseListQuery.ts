/**
 * Helper per estrarre workspaceId, projectIds, page, perPage da req.query.
 * Usato nelle route che espongono liste paginate (es. GET /clients/:id/requests).
 */
import type { Request } from "express";
import type { AccessTokenPayload } from "../../core/auth/token.service.js";
import { applyListQueryContext, buildListQueryContext, toEntityAssignmentViewer } from "../../core/access/listQueryContext.js";
import type { EntityAssignmentListViewer } from "../../core/workspaces/entity-assignment-query.util.js";
import type { ListQueryInput } from "../../core/shared/list-query.js";
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

export async function resolveListQueryFromRequestQuery(
  user: AccessTokenPayload | undefined,
  req: Request
): Promise<{ input: ListQueryInput; viewer: EntityAssignmentListViewer | undefined }> {
  const parsed = parseListQueryFromRequest(req);
  const ctx = await buildListQueryContext(user, parsed.workspaceId);
  const input = applyListQueryContext(
    {
      workspaceId: parsed.workspaceId,
      projectIds: parsed.projectIds,
      page: parsed.page,
      perPage: parsed.perPage,
    },
    ctx ?? undefined
  );
  const viewer = ctx ? toEntityAssignmentViewer(ctx) : undefined;
  return { input, viewer };
}
