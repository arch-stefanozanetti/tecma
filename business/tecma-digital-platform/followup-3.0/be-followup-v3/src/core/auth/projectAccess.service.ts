import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

const InputSchema = z.object({
  email: z.string().email()
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
  const { email } = InputSchema.parse(rawInput);
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

  const normalizedProjects = merged.map(buildProjectOutput).sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    found: true,
    email,
    role: role || null,
    isAdmin,
    projects: normalizedProjects
  };
};
