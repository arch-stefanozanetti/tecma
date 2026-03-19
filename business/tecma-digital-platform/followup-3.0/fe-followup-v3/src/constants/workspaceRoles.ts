/**
 * Ruoli workspace: unica fonte per valore + label e ordinamento.
 * Allineato allo spec: solo owner, admin, collaborator, viewer.
 */
import type { WorkspaceUserRole } from "../types/domain";

export const WORKSPACE_ROLES: ReadonlyArray<{ value: WorkspaceUserRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "collaborator", label: "Collaborator" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_ORDER: Record<WorkspaceUserRole, number> = {
  owner: 4,
  admin: 3,
  collaborator: 2,
  viewer: 1,
};

export function getWorkspaceRoleLabel(role: WorkspaceUserRole): string {
  return WORKSPACE_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** Restituisce il ruolo "massimo" tra una lista (owner > admin > collaborator > viewer). */
export function getMaxWorkspaceRole(roles: string[]): string {
  if (roles.length === 0) return "viewer";
  let best: string = "viewer";
  let bestOrder = 0;
  for (const r of roles) {
    const order = ROLE_ORDER[r as WorkspaceUserRole] ?? 0;
    if (order > bestOrder) {
      bestOrder = order;
      best = r;
    }
  }
  return best;
}
