import type { AccessTokenPayload } from "../auth/token.service.js";
import { getProjectAccessByEmail } from "../auth/projectAccess.service.js";
import { resolveProjectEffectiveAccess } from "./projectEffectiveAccess.service.js";
import type { AccessScope } from "../../types/models.js";
import type { EntityAssignmentListViewer } from "../workspaces/entity-assignment-query.util.js";
import { ListQuerySchema, type ListQueryInput } from "../shared/list-query.js";
import { getDb } from "../../config/db.js";

const WORKSPACE_USERS_COLLECTION = "tz_user_workspaces";

export type ListQueryContext = {
  email: string;
  workspaceId: string;
  isAdmin: boolean;
  isTecmaAdmin: boolean;
  accessScope: AccessScope;
  membershipRole: string | null;
  allowedProjectIds: string[];
};

export function normalizeProjectId(id: string): string {
  return id.trim();
}

/**
 * Interseca projectIds richiesti con quelli consentiti.
 * Admin / unrestricted: mantiene la richiesta.
 * Non-admin: solo overlap; nessun overlap → [] (lista vuota).
 */
export function clampProjectIds(
  requested: string[],
  allowed: string[],
  unrestricted: boolean
): string[] {
  if (unrestricted) {
    return [...new Set(requested.map(normalizeProjectId).filter(Boolean))];
  }
  const allowedSet = new Set(allowed.map(normalizeProjectId).filter(Boolean));
  if (allowedSet.size === 0) return [];
  const requestedNorm = [...new Set(requested.map(normalizeProjectId).filter(Boolean))];
  if (requestedNorm.length === 0) return [...allowedSet];
  return requestedNorm.filter((id) => allowedSet.has(id));
}

async function loadMembershipForWorkspace(
  workspaceId: string,
  email: string
): Promise<{ role: string; access_scope: AccessScope } | null> {
  const db = getDb();
  const row = await db.collection(WORKSPACE_USERS_COLLECTION).findOne({
    workspaceId,
    userId: email.trim().toLowerCase(),
  });
  if (!row) return null;
  const access_scope =
    (row as { access_scope?: string }).access_scope === "assigned" ? "assigned" : "all";
  return {
    role: String((row as { role?: string }).role ?? "collaborator"),
    access_scope,
  };
}

export async function buildListQueryContext(
  user: AccessTokenPayload | undefined,
  workspaceId: string
): Promise<ListQueryContext | null> {
  if (!user?.email?.trim() || !workspaceId?.trim()) return null;
  const email = user.email.trim().toLowerCase();
  const wid = workspaceId.trim();
  const isTecmaAdmin = user.isTecmaAdmin === true;

  const [access, membership] = await Promise.all([
    getProjectAccessByEmail({ email, workspaceId: wid }),
    loadMembershipForWorkspace(wid, email),
  ]);

  const isAdmin = isTecmaAdmin || user.isAdmin === true || access.isAdmin === true;
  let allowedProjectIds = access.projects.map((p) => String(p.id ?? "")).filter(Boolean);

  let accessScope: AccessScope = membership?.access_scope ?? "all";
  if (!isAdmin && allowedProjectIds.length === 1) {
    const effective = await resolveProjectEffectiveAccess(email, wid, allowedProjectIds[0]!, {
      isAdmin,
      isTecmaAdmin,
    });
    accessScope = effective.accessScope;
    if (!effective.inScope) allowedProjectIds = [];
  }

  return {
    email,
    workspaceId: wid,
    isAdmin,
    isTecmaAdmin,
    accessScope,
    membershipRole: membership?.role ?? null,
    allowedProjectIds,
  };
}

export function toEntityAssignmentViewer(ctx: ListQueryContext | undefined): EntityAssignmentListViewer | undefined {
  if (!ctx) return undefined;
  return {
    email: ctx.email,
    isAdmin: ctx.isAdmin,
    isTecmaAdmin: ctx.isTecmaAdmin,
    accessScope: ctx.accessScope,
    membershipRole: ctx.membershipRole ?? undefined,
  };
}

export function applyListQueryContext(
  rawInput: unknown,
  ctx: ListQueryContext | undefined
): ListQueryInput {
  const input = ListQuerySchema.parse(rawInput);
  if (!ctx) return input;
  const unrestricted = ctx.isAdmin || ctx.isTecmaAdmin;
  const projectIds = clampProjectIds(input.projectIds, ctx.allowedProjectIds, unrestricted);
  return {
    ...input,
    projectIds: projectIds.length > 0 ? projectIds : ["__no_access__"],
  };
}

export function emptyListResult<T>(page: number, perPage: number): {
  data: T[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
} {
  return {
    data: [],
    pagination: { page, perPage, total: 0, totalPages: 0 },
  };
}

export function isNoAccessProjectIds(projectIds: string[]): boolean {
  return projectIds.length === 1 && projectIds[0] === "__no_access__";
}
