import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { listWorkspaceUserProjects } from "../workspaces/workspace-user-projects.service.js";
import { listWorkspaceIdsForUser } from "../workspaces/workspace-users.service.js";
import type { AccessScope } from "../../types/models.js";

const InputSchema = z.object({
  email: z.string().email(),
  /** Se valorizzato, i progetti restituiti sono intersecati con quelli associati al workspace (tz_workspace_projects). */
  workspaceId: z.string().min(1).optional(),
});

type ProjectDoc = {
  _id?: ObjectId | string;
  legacyProjectId?: string;
  name?: string;
  displayName?: string;
  mode?: "rent" | "sell";
  broker?: unknown;
  isCommercialDemo?: boolean;
  archived?: boolean;
};

type UserDoc = {
  email?: string;
  role?: string;
  system_role?: string | null;
  project_ids?: Array<string | ObjectId>;
};

const normalizeId = (id: string | ObjectId): string => {
  if (typeof id === "string") return id;
  return id.toHexString();
};

/** Solo collection presenti in test-zanetti. */
const USERS_COLLECTION = "tz_users";
const PROJECTS_COLLECTION = "tz_projects";
const WORKSPACE_PROJECTS_COLLECTION = "tz_workspace_projects";

const WORKSPACE_USERS_COLLECTION = "tz_user_workspaces";

const loadMembershipForWorkspace = async (
  workspaceId: string,
  email: string
): Promise<{ role: string; access_scope: AccessScope } | null> => {
  const db = getDb();
  const row = await db.collection(WORKSPACE_USERS_COLLECTION).findOne({
    workspaceId,
    userId: email.trim().toLowerCase(),
  });
  if (!row) return null;
  const access_scope = (row as { access_scope?: string }).access_scope === "assigned" ? "assigned" : "all";
  return {
    role: String((row as { role?: string }).role ?? "collaborator"),
    access_scope,
  };
};

/** Allineato a followup-3.0: collaborator/viewer con righe in tz_workspace_user_projects → solo assegnati. */
export function shouldRestrictToAssignments(
  membershipRole: string | undefined,
  accessScope: AccessScope | undefined,
  hasWorkspaceAssignments: boolean
): boolean {
  if (accessScope === "assigned") return true;
  const role = (membershipRole || "").toLowerCase();
  if ((role === "collaborator" || role === "viewer") && hasWorkspaceAssignments) return true;
  if (accessScope === "all") return false;
  return hasWorkspaceAssignments;
}

async function fetchMergedProjectsForIds(
  projectsCollection: ReturnType<ReturnType<typeof getDb>["collection"]>,
  projectIds: string[]
): Promise<ProjectDoc[]> {
  if (projectIds.length === 0) return [];
  const objectIds = projectIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const [fromProjectDb, fromTz] = await Promise.all([
    projectsCollection
      .find({
        $or: [{ _id: { $in: objectIds } }, { _id: { $in: projectIds as unknown as ObjectId[] } }],
        archived: { $ne: true },
      } as Record<string, unknown>)
      .project({ _id: 1, name: 1, displayName: 1, mode: 1, broker: 1, legacyProjectId: 1 })
      .toArray() as Promise<ProjectDoc[]>,
    fetchTzProjects(projectIds).catch(() => []),
  ]);
  const byId = new Map<string, ProjectDoc>();
  for (const p of [...fromProjectDb, ...fromTz]) {
    const id = normalizeId(p._id ?? "");
    if (!id) continue;
    const prev = byId.get(id);
    byId.set(id, prev ? { ...prev, ...p, _id: prev._id ?? p._id } : p);
  }
  return [...byId.values()];
}

function filterProjectsToWorkspace(
  projects: ReturnType<typeof buildProjectOutput>[],
  merged: ProjectDoc[],
  workspaceProjectIds: string[]
): ReturnType<typeof buildProjectOutput>[] {
  if (workspaceProjectIds.length === 0) return projects;
  const wsSet = new Set(workspaceProjectIds);
  return projects.filter((p) => {
    if (wsSet.has(p.id)) return true;
    const matchedById = merged.find((m) => normalizeId(m._id ?? "") === p.id);
    return typeof matchedById?.legacyProjectId === "string" && wsSet.has(matchedById.legacyProjectId);
  });
}

const loadWorkspaceProjectIds = async (workspaceId: string): Promise<string[]> => {
  const wid = workspaceId.trim();
  if (!wid) return [];
  const db = getDb();
  const docs = await db
    .collection(WORKSPACE_PROJECTS_COLLECTION)
    .find({ workspaceId: wid })
    .project({ projectId: 1 })
    .toArray();
  return docs.map((d) => String((d as { projectId?: unknown }).projectId ?? "")).filter(Boolean);
};

const buildProjectOutput = (project: ProjectDoc) => {
  const rawId = project._id || "";
  const id = typeof rawId === "string" || rawId instanceof ObjectId ? normalizeId(rawId) : "";
  const mode = project.mode === "rent" ? "rent" : "sell";
  return {
    id,
    name: project.displayName || project.name || id,
    displayName: project.displayName || project.name || id,
    mode
  };
};

/** Progetti da tz_projects (main DB, creati da Followup). Uniti con project DB in getProjectAccessByEmail. */
const fetchTzProjects = async (filterIds?: string[]): Promise<ProjectDoc[]> => {
  const db = getDb();
  const coll = db.collection("tz_projects");
  const query: Record<string, unknown> = { archived: { $ne: true } };
  if (filterIds && filterIds.length > 0) {
    const objectIds = filterIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    query.$or = [{ _id: { $in: filterIds } }, { _id: { $in: objectIds } }, { legacyProjectId: { $in: filterIds } }];
  }
  const docs = await coll
    .find(query)
    .project({ _id: 1, legacyProjectId: 1, name: 1, displayName: 1, mode: 1 })
    .toArray();
  return docs as ProjectDoc[];
};

export const getProjectAccessByEmail = async (rawInput: unknown) => {
  const { email, workspaceId: rawWorkspaceId } = InputSchema.parse(rawInput);
  const workspaceId = rawWorkspaceId?.trim() || undefined;
  const db = getDb();

  const usersCollection = db.collection<UserDoc>(USERS_COLLECTION);
  const projectsCollection = db.collection<ProjectDoc>(PROJECTS_COLLECTION);

  const user = await usersCollection.findOne({
    email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });

  if (!user) {
    return {
      found: false,
      email,
      role: null,
      isAdmin: false,
      projects: []
    };
  }

  const role = String(user.role || "").toLowerCase();
  const isTecmaAdmin = user.system_role === "tecma_admin";
  const isAdmin = role === "admin" || isTecmaAdmin;

  let projectsFromProjectDb: ProjectDoc[] = [];
  let projectsFromTz: ProjectDoc[] = [];

  if (isAdmin) {
    const [fromProjectDb, fromTz] = await Promise.all([
      projectsCollection
        .find({ archived: { $ne: true }, isCommercialDemo: { $ne: true } })
        .project({ _id: 1, name: 1, displayName: 1, mode: 1, broker: 1 })
        .toArray() as Promise<ProjectDoc[]>,
      fetchTzProjects().catch(() => []),
    ]);
    projectsFromProjectDb = fromProjectDb;
    projectsFromTz = fromTz;
  } else {
    const projectIds = (user.project_ids || []).map(normalizeId);
    if (projectIds.length > 0) {
      const objectIds = projectIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const [fromProjectDb, fromTz] = await Promise.all([
        projectsCollection
          .find({
            $or: [{ _id: { $in: objectIds } }, { _id: { $in: projectIds } }],
            archived: { $ne: true }
          })
          .project({ _id: 1, name: 1, displayName: 1, mode: 1, broker: 1 })
          .toArray() as Promise<ProjectDoc[]>,
        fetchTzProjects(projectIds).catch(() => []),
      ]);
      projectsFromProjectDb = fromProjectDb;
      projectsFromTz = fromTz;
    }
  }

  const byId = new Map<string, ProjectDoc>();
  for (const p of [...projectsFromProjectDb, ...projectsFromTz]) {
    const id = normalizeId(p._id ?? "");
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, p);
      continue;
    }
    // Prefer fields from tz_projects when duplicate ids exist.
    byId.set(id, {
      ...prev,
      ...p,
      _id: prev._id ?? p._id,
    });
  }
  const merged = [...byId.values()];

  const allNormalizedProjects = merged.map(buildProjectOutput).sort((a, b) => a.displayName.localeCompare(b.displayName));
  let normalizedProjects = allNormalizedProjects;

  const emailKey = email.trim().toLowerCase();
  let effectiveWorkspaceId = workspaceId;
  if (!effectiveWorkspaceId) {
    const membershipWorkspaceIds = await listWorkspaceIdsForUser(emailKey);
    if (membershipWorkspaceIds.length === 1) {
      effectiveWorkspaceId = membershipWorkspaceIds[0];
    }
  }

  if (effectiveWorkspaceId) {
    const inWorkspace = await loadWorkspaceProjectIds(effectiveWorkspaceId);
    const membership = await loadMembershipForWorkspace(effectiveWorkspaceId, emailKey);
    const { data: userProjectIds } = await listWorkspaceUserProjects(effectiveWorkspaceId, emailKey);
    const hasAssignments = userProjectIds.length > 0;
    const restrict = !isAdmin && shouldRestrictToAssignments(membership?.role, membership?.access_scope, hasAssignments);

    if (restrict) {
      const assignmentMerged = await fetchMergedProjectsForIds(projectsCollection, userProjectIds);
      const assignmentNormalized = assignmentMerged.map(buildProjectOutput);
      normalizedProjects = filterProjectsToWorkspace(assignmentNormalized, assignmentMerged, inWorkspace);
    } else if (inWorkspace.length > 0) {
      normalizedProjects = filterProjectsToWorkspace(allNormalizedProjects, merged, inWorkspace);
      if (!isAdmin && normalizedProjects.length === 0 && allNormalizedProjects.length > 0) {
        normalizedProjects = allNormalizedProjects;
      }
    }

    if (isAdmin && normalizedProjects.length === 0 && allNormalizedProjects.length > 0) {
      normalizedProjects = allNormalizedProjects;
    }
  }

  return {
    found: true,
    email,
    role: role || null,
    isAdmin,
    projects: normalizedProjects,
    defaultWorkspaceId: effectiveWorkspaceId ?? null,
  };
};
