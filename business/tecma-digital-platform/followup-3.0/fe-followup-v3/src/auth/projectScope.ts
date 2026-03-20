import { createContext, useContext } from "react";
import { z } from "zod";
import type { ProjectAccessProject } from "../types/domain";

const ProjectAccessProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
});

const ProjectScopeSchema = z.object({
  email: z.string(),
  role: z.string().nullable(),
  isAdmin: z.boolean(),
  workspaceId: z.string(),
  apiEnvironment: z.enum(["dev-1", "demo", "prod"]).optional(),
  projects: z.array(ProjectAccessProjectSchema),
  selectedProjectIds: z.array(z.string()),
  /** Snapshot permessi JWT (allineare con refresh/login). */
  permissions: z.array(z.string()).optional(),
});

/** Override per workspace/progetti filtrati (da App/PageTemplate). Usato da ClientsPage, ApartmentsPage, ecc. */
export interface WorkspaceOverride {
  workspaceId: string;
  selectedProjectIds: string[];
  projects: ProjectAccessProject[];
}

const WorkspaceOverrideContext = createContext<WorkspaceOverride | null>(null);

export const WorkspaceOverrideProvider = WorkspaceOverrideContext.Provider;

export const useWorkspaceOverride = () => useContext(WorkspaceOverrideContext);

export interface ProjectScopeState {
  email: string;
  role: string | null;
  isAdmin: boolean;
  workspaceId: string;
  /** Ambiente API (dev-1/demo/prod) per banner; da login o = workspaceId se legacy */
  apiEnvironment?: "dev-1" | "demo" | "prod";
  projects: ProjectAccessProject[];
  selectedProjectIds: string[];
  /** Permessi effettivi (da JWT /me); usati per nav e CTA. */
  permissions?: string[];
}

const STORAGE_KEY = "followup3.projectScope";

const getStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    if (window.localStorage) return window.localStorage;
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  } catch {
    // ignore
  }
  return null;
};

export const saveProjectScope = (state: ProjectScopeState): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadProjectScope = (): ProjectScopeState | null => {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = ProjectScopeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const data = parsed.data;
    return {
      ...data,
      permissions: data.permissions ?? [],
      projects: data.projects.map((p: { id: string; name: string; displayName?: string }) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName ?? p.name,
      })),
    };
  } catch {
    return null;
  }
};

export const clearProjectScope = (): void => {
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.removeItem(STORAGE_KEY);
      window.sessionStorage?.removeItem(STORAGE_KEY);
      window.sessionStorage?.removeItem("followup3.permLastSync");
    }
  } catch {
    // ignore
  }
};

export const updateSelectedProjectIds = (ids: string[]): void => {
  const current = loadProjectScope();
  if (!current) return;
  saveProjectScope({ ...current, selectedProjectIds: ids });
};

export const updateWorkspaceId = (workspaceId: string): void => {
  const current = loadProjectScope();
  if (!current) return;
  saveProjectScope({ ...current, workspaceId });
};

export const useWorkspace = () => {
  const override = useWorkspaceOverride();
  const scope = loadProjectScope();
  const isAdmin = scope?.isAdmin ?? false;
  const permissions = scope?.permissions ?? [];
  const hasPermission = (perm: string): boolean => {
    if (isAdmin) return true;
    if (permissions.includes("*")) return true;
    return permissions.includes(perm);
  };
  return {
    workspaceId: override?.workspaceId ?? scope?.workspaceId ?? "",
    selectedProjectIds: override?.selectedProjectIds ?? scope?.selectedProjectIds ?? [],
    projects: override?.projects ?? scope?.projects ?? [],
    email: scope?.email ?? "",
    isAdmin,
    permissions,
    hasPermission,
  };
};
