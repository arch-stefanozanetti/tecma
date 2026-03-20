import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { listWorkspaceUserProjects } from "../workspaces/workspace-user-projects.service.js";

const InputSchema = z.object({
  email: z.string().email(),
  /** Se valorizzato, i progetti restituiti sono intersecati con quelli associati al workspace (tz_workspace_projects). */
  workspaceId: z.string().min(1).optional(),
});

type ProjectDoc = {
  _id?: ObjectId | string;
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
    query._id = { $in: filterIds };
  }
  const docs = await coll
    .find(query)
    .project({ _id: 1, name: 1, displayName: 1, mode: 1 })
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
  const isAdmin = role === "admin";

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

  const seenIds = new Set<string>();
  const merged: ProjectDoc[] = [];
  for (const p of [...projectsFromProjectDb, ...projectsFromTz]) {
    const id = normalizeId(p._id ?? "");
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      merged.push(p);
    }
  }

  let normalizedProjects = merged.map(buildProjectOutput).sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (workspaceId) {
    const inWorkspace = await loadWorkspaceProjectIds(workspaceId);
    if (inWorkspace.length > 0) {
      const wsSet = new Set(inWorkspace);
      normalizedProjects = normalizedProjects.filter((p) => wsSet.has(p.id));
    }
    if (!isAdmin && inWorkspace.length > 0) {
      const emailKey = email.trim().toLowerCase();
      const { data: userProjectIds } = await listWorkspaceUserProjects(workspaceId, emailKey);
      if (userProjectIds.length > 0) {
        const allowed = new Set(userProjectIds);
        normalizedProjects = normalizedProjects.filter((p) => allowed.has(p.id));
      }
    }
  }

  return {
    found: true,
    email,
    role: role || null,
    isAdmin,
    projects: normalizedProjects
  };
};
