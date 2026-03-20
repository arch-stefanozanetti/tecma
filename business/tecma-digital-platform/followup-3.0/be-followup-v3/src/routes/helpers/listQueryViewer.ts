import type { AccessTokenPayload } from "../../core/auth/token.service.js";
import type { EntityAssignmentListViewer } from "../../core/workspaces/entity-assignment-query.util.js";

export function toEntityAssignmentListViewer(user: AccessTokenPayload | undefined): EntityAssignmentListViewer | undefined {
  if (!user?.email) return undefined;
  return {
    email: user.email,
    isAdmin: user.isAdmin,
    isTecmaAdmin: user.isTecmaAdmin === true,
  };
}
