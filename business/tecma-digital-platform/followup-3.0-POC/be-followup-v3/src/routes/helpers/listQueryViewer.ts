import type { AccessTokenPayload } from "../../core/auth/token.service.js";
import type { EntityAssignmentListViewer } from "../../core/workspaces/entity-assignment-query.util.js";
import {
  buildListQueryContext,
  toEntityAssignmentViewer,
  applyListQueryContext,
  type ListQueryContext,
} from "../../core/access/listQueryContext.js";
import type { ListQueryInput } from "../../core/shared/list-query.js";

export { toEntityAssignmentViewer };

export function toEntityAssignmentListViewer(user: AccessTokenPayload | undefined): EntityAssignmentListViewer | undefined {
  if (!user?.email) return undefined;
  return {
    email: user.email,
    isAdmin: user.isAdmin,
    isTecmaAdmin: user.isTecmaAdmin === true,
  };
}

export async function resolveListQueryFromRequest(
  user: AccessTokenPayload | undefined,
  rawInput: unknown
): Promise<{ input: ListQueryInput; ctx: ListQueryContext | null; viewer: EntityAssignmentListViewer | undefined }> {
  const workspaceId =
    typeof rawInput === "object" && rawInput !== null && "workspaceId" in rawInput
      ? String((rawInput as { workspaceId?: unknown }).workspaceId ?? "")
      : "";
  const ctx = workspaceId ? await buildListQueryContext(user, workspaceId) : null;
  const input = applyListQueryContext(rawInput, ctx ?? undefined);
  const viewer = ctx ? toEntityAssignmentViewer(ctx) : toEntityAssignmentListViewer(user);
  return { input, ctx, viewer };
}
