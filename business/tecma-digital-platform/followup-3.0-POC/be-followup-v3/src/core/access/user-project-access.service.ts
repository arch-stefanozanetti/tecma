import { getDb } from "../../config/db.js";
import type { AccessScope } from "../../types/models.js";

const COLLECTION = "tz_user_project_access";

export type UserProjectAccessDoc = {
  workspaceId: string;
  userId: string;
  projectId: string;
  role?: string;
  access_scope?: AccessScope;
  permissions_override?: string[];
  permissions_deny?: string[];
  updatedAt?: string;
};

export type UserProjectAccessInput = {
  role?: string;
  access_scope?: AccessScope;
  permissions_override?: string[];
  permissions_deny?: string[];
};

function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

const coll = () => getDb().collection<UserProjectAccessDoc>(COLLECTION);

export async function getUserProjectAccess(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<UserProjectAccessDoc | null> {
  return coll().findOne({
    workspaceId: workspaceId.trim(),
    userId: normalizeUserId(userId),
    projectId: projectId.trim(),
  });
}

export async function listUserProjectAccessForUser(
  workspaceId: string,
  userId: string
): Promise<UserProjectAccessDoc[]> {
  return coll()
    .find({ workspaceId: workspaceId.trim(), userId: normalizeUserId(userId) })
    .toArray();
}

export async function upsertUserProjectAccess(
  workspaceId: string,
  userId: string,
  projectId: string,
  input: UserProjectAccessInput
): Promise<UserProjectAccessDoc> {
  const doc: UserProjectAccessDoc = {
    workspaceId: workspaceId.trim(),
    userId: normalizeUserId(userId),
    projectId: projectId.trim(),
    ...(input.role !== undefined && { role: input.role }),
    ...(input.access_scope !== undefined && { access_scope: input.access_scope }),
    ...(input.permissions_override !== undefined && { permissions_override: input.permissions_override }),
    ...(input.permissions_deny !== undefined && { permissions_deny: input.permissions_deny }),
    updatedAt: new Date().toISOString(),
  };
  await coll().updateOne(
    { workspaceId: doc.workspaceId, userId: doc.userId, projectId: doc.projectId },
    { $set: doc },
    { upsert: true }
  );
  return (await getUserProjectAccess(workspaceId, userId, projectId))!;
}

export async function bulkReplaceUserProjectAccess(
  workspaceId: string,
  userId: string,
  rows: Array<{ projectId: string } & UserProjectAccessInput>
): Promise<UserProjectAccessDoc[]> {
  const wid = workspaceId.trim();
  const uid = normalizeUserId(userId);
  await coll().deleteMany({ workspaceId: wid, userId: uid });
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const docs: UserProjectAccessDoc[] = rows.map((r) => ({
    workspaceId: wid,
    userId: uid,
    projectId: r.projectId.trim(),
    ...(r.role !== undefined && { role: r.role }),
    ...(r.access_scope !== undefined && { access_scope: r.access_scope }),
    ...(r.permissions_override !== undefined && { permissions_override: r.permissions_override }),
    ...(r.permissions_deny !== undefined && { permissions_deny: r.permissions_deny }),
    updatedAt: now,
  }));
  await coll().insertMany(docs);
  return listUserProjectAccessForUser(wid, uid);
}

export async function deleteUserProjectAccess(
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<boolean> {
  const r = await coll().deleteOne({
    workspaceId: workspaceId.trim(),
    userId: normalizeUserId(userId),
    projectId: projectId.trim(),
  });
  return (r.deletedCount ?? 0) > 0;
}

/** Migrazione legacy: crea righe da tz_workspace_user_projects + membership. */
export async function migrateLegacyUserProjectAccess(workspaceId: string, userId: string): Promise<number> {
  const { listWorkspaceUserProjects } = await import("../workspaces/workspace-user-projects.service.js");
  const db = getDb();
  const membership = await db.collection("tz_user_workspaces").findOne({
    workspaceId: workspaceId.trim(),
    userId: normalizeUserId(userId),
  });
  const { data: projectIds } = await listWorkspaceUserProjects(workspaceId, userId);
  let created = 0;
  for (const projectId of projectIds) {
    const existing = await getUserProjectAccess(workspaceId, userId, projectId);
    if (existing) continue;
    await upsertUserProjectAccess(workspaceId, userId, projectId, {
      role: membership ? String((membership as { role?: string }).role ?? "") : undefined,
      access_scope:
        (membership as { access_scope?: string })?.access_scope === "assigned" ? "assigned" : "all",
    });
    created += 1;
  }
  return created;
}
