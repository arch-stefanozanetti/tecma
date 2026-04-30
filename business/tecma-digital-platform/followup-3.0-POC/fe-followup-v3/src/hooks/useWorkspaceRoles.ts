import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../api/followupApi";
import { getWorkspaceRoleLabel, WORKSPACE_ROLES } from "../constants/workspaceRoles";
import type { WorkspaceUserRole } from "../types/domain";

export interface WorkspaceRoleOption {
  roleKey: WorkspaceUserRole;
  label: string;
}

export function useWorkspaceRoles(): {
  roles: WorkspaceRoleOption[];
  loading: boolean;
  error: unknown;
  getRoleLabel: (role: string) => string;
} {
  const [roles, setRoles] = useState<WorkspaceRoleOption[]>(() =>
    WORKSPACE_ROLES.map((r) => ({ roleKey: r.value, label: r.label }))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    followupApi
      .getWorkspaceRoles()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setRoles(
            data.map((r) => ({
              roleKey: r.roleKey as WorkspaceUserRole,
              label: r.label?.trim() || r.roleKey
            }))
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setRoles(WORKSPACE_ROLES.map((r) => ({ roleKey: r.value, label: r.label })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getRoleLabel = useCallback(
    (role: string) => roles.find((r) => r.roleKey === role)?.label ?? getWorkspaceRoleLabel(role as WorkspaceUserRole),
    [roles]
  );

  return { roles, loading, error, getRoleLabel };
}
